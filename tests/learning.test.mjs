import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatch,runBatch,latestQueue,restoreFormValues,selectWords,generationSummary} from '../public/learning.js';
import {LEVELS,validColor} from '../public/preferences.js';
import {complete,modelRequest} from '../server/models.mjs';

test('restoring saved generation settings resolves length as a named field, not the collection count',()=>{
 const controls={length:{value:'short'},mode:{value:'single'},level:{value:'cet4'}};
 const form={elements:{length:6,namedItem:name=>controls[name]??null}};
 const saved=JSON.parse('{"length":"long","mode":"batch","level":"cet6","removedField":"old"}');
 restoreFormValues(form,saved);
 assert.equal(controls.length.value,'long');assert.equal(form.elements.length,6);
 assert.equal(controls.mode.value,'batch');assert.equal(controls.level.value,'cet6');
 assert.doesNotThrow(()=>restoreFormValues(null,saved));
 assert.doesNotThrow(()=>restoreFormValues(form,null));
});

test('full selection of 1000 words splits into complete, unique batches',()=>{
 const words=Array.from({length:1000},(_,i)=>'word'+i);
 const task=createBatch(words,{mode:'batch',level:'cet4'},'test');
 assert.equal(task.batches.length,50);assert.deepEqual(task.batches.flat(),words);assert.ok(task.batches.every(b=>b.length<=20));
 assert.throws(()=>createBatch(words,{mode:'single'},'test'),/分批/);
});

test('batch retry preserves completed articles and stable request IDs across reload',async()=>{
 const task=createBatch(Array.from({length:41},(_,i)=>'word'+i),{mode:'batch'},'run');
 const calls=[];let fail=true;
 const generate=async input=>{calls.push(input.requestId);if(input.requestId==='run:1'&&fail)throw new Error('模型响应不完整');return{id:input.requestId,coverage:input.words.map(word=>({word,covered:true}))};};
 await runBatch(task,generate);assert.equal(task.completed.length,1);assert.equal(task.error,'模型响应不完整');assert.equal(task.running,false);
 const restored=JSON.parse(JSON.stringify(task));fail=false;await runBatch(restored,generate);
 assert.deepEqual(calls,['run:0','run:1','run:1','run:2']);assert.equal(restored.completed.length,3);assert.equal(restored.error,null);
});

test('rate limit waits and resumes same batch without restarting earlier articles',async()=>{
 const task=createBatch(['pear'],{mode:'batch'},'rate');let count=0;const waits=[];
 await runBatch(task,async input=>{if(!count++){const e=new Error('频率限制');e.status=429;e.retryAfter=17;throw e;}return{id:input.requestId,coverage:[]};},{sleep:async ms=>waits.push(ms)});
 assert.deepEqual(waits,[17000]);assert.equal(count,2);assert.equal(task.completed.length,1);
});

test('latest translation queue discards intermediate selections and invalidates stale results',async()=>{
 const called=[],current=[];let release;
 const queue=latestQueue(async(value,isCurrent)=>{called.push(value);if(value==='first')await new Promise(r=>release=r);current.push([value,isCurrent()]);});
 queue.push('first');queue.push('middle');queue.push('last');release();await new Promise(r=>setImmediate(r));
 assert.deepEqual(called,['first','last']);assert.deepEqual(current,[['first',false],['last',true]]);
});

test('learning goals are distinct exam profiles and include existing CEFR values',()=>{
 for(const id of ['cet4','cet6','postgrad','ielts-basic','ielts-advanced','toefl','B1'])assert.ok(LEVELS[id]);
 assert.notEqual(LEVELS.cet4.prompt,LEVELS.cet6.prompt);assert.equal(validColor('#Aa123F'),true);assert.equal(validColor('red;display:none'),false);
});

test('DeepSeek generation reserves reasoning room; translation skips long thinking; truncation is explicit',async()=>{
 const config={provider:'deepseek',model:'deepseek-flash'};
 const generation=modelRequest({...config,task:'article'},'test','JSON');assert.equal(generation.body.max_tokens,16000);assert.equal(generation.body.response_format.type,'json_object');
 const translation=modelRequest({...config,task:'translation'},'test','JSON');assert.equal(translation.body.thinking.type,'disabled');
 await assert.rejects(complete(config,'test','JSON',async()=>({choices:[{finish_reason:'length',message:{content:'{"title":'}}]})),/截断/);
});


test('custom batch size preserves every word and survives task serialization',()=>{
 const words=Array.from({length:95},(_,i)=>'word'+i);
 for(const size of [20,30,35,40,80]){
  const task=JSON.parse(JSON.stringify(createBatch(words,{mode:'batch',batchSize:String(size)},'custom')));
  assert.equal(task.batches.length,Math.ceil(words.length/size));assert.deepEqual(task.batches.flat(),words);
  assert.ok(task.batches.every(batch=>batch.length<=size));assert.equal(task.options.batchSize,String(size));
 }
 for(const size of [0,81,1.5,'', 'oops'])assert.throws(()=>createBatch(words,{mode:'batch',batchSize:size},'invalid'),/1–80/);
});

test('random selection uses requested count, deduplicates, and does not mutate candidates',()=>{
 const items=Array.from({length:50},(_,i)=>({word:'word'+i,response:'FAMILIAR'}));
 const before=structuredClone(items);
 const first=selectWords([...items,items[0]],35,{random:()=>0});
 const second=selectWords(items,35,{random:()=>0.999});
 assert.equal(first.length,35);assert.equal(new Set(first).size,35);assert.notDeepEqual(first,second);
 assert.deepEqual(items,before);assert.equal(selectWords(items,100).length,50);assert.deepEqual(selectWords([],20),[]);
 for(const count of [0,-1,1.5,1001,''])assert.throws(()=>selectWords(items,count),/1–1000/);
});

test('weak selection ranks forgotten then vague words and randomizes ties',()=>{
 const items=[{word:'known',response:'FAMILIAR'},{word:'vague',response:'VAGUE'},...['a','b','c'].map(word=>({word,response:'FORGET'}))];
 const first=selectWords(items,4,{weakFirst:true,random:()=>0.5});
 const second=selectWords(items,4,{weakFirst:true,random:()=>0.999});
 assert.deepEqual(new Set(first.slice(0,3)),new Set(['a','b','c']));assert.equal(first[3],'vague');
 assert.notDeepEqual(first,second);
});


test('generation preview reflects actual selection and mode rather than requested draw count',()=>{
 assert.match(generationSummary(30,'single',20),/生成 1 篇，使用全部 30/);
 assert.match(generationSummary(30,'batch',20),/生成 2 篇.*最后一篇 10/);
 assert.match(generationSummary(60,'batch',20),/生成 3 篇/);
 assert.match(generationSummary(0,'single',20),/尚未选择/);
 assert.match(generationSummary(90,'single',20),/切换分批/);
 assert.match(generationSummary(30,'batch',''),/请填写/);
});
