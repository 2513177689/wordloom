// Named fields can collide with collection properties such as `length`.
export function restoreFormValues(form,values) {
  if(!form || !values)return;
  for(const [name,value] of Object.entries(values)) {
    const control=form.elements.namedItem(name);
    if(control && 'value' in control)control.value=value;
  }
}

export function selectWords(items,count,{weakFirst=false,random=Math.random}={}) {
  count=Number(count);
  if(!Number.isInteger(count)||count<1||count>1000)throw new Error('选词数量请输入 1–1000 的整数');
  const shuffled=[...new Map(items.map(item=>[item.word,item])).values()];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  if(weakFirst){const rank=item=>({FORGET:0,VAGUE:1,FAMILIAR:3}[item.response]??2);shuffled.sort((a,b)=>rank(a)-rank(b));}
  return shuffled.slice(0,count).map(item=>item.word);
}

export function createBatch(words,options,id) {
  const unique=[...new Set(words.map(w=>w.trim()).filter(Boolean))];
  if(!unique.length)throw new Error('请先选择要练习的单词');
  if(unique.length>1000)throw new Error('每次最多处理 1000 个目标词');
  if(options.mode!=='batch' && unique.length>80)throw new Error('请选择分批生成，或将单篇目标词减少到 80 个以内');
  const size=options.mode==='batch'?Number(options.batchSize??20):80;
  if(!Number.isInteger(size)||size<1||size>80)throw new Error('每篇目标词数量请输入 1–80 的整数');
  return {id,options:{...options},batches:Array.from({length:Math.ceil(unique.length/size)},(_,i)=>unique.slice(i*size,i*size+size)),completed:[],error:null,running:false};
}
export async function runBatch(task,generate,{onProgress=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  if(task.running)return;
  task.running=true;task.error=null;
  try {
    for(let i=task.completed.length;i<task.batches.length;i++) {
      for(let retry=0;;retry++) {
        onProgress(task);
        try { const article=await generate({...task.options,words:task.batches[i],requestId:`${task.id}:${i}`});task.completed.push({id:article.id,coverage:article.coverage});task.waiting=null;onProgress(task);break; }
        catch(error) {
          if(retry<2 && ((error.status===429 && error.retryAfter) || error.status===503 || error.status===504)) {
            const seconds=Math.min(120,Math.max(2,error.retryAfter || 3*(retry+1)));task.waiting=`服务繁忙，${seconds} 秒后重试当前批次`;onProgress(task);await sleep(seconds*1000);task.waiting=null;continue;
          }
          throw error;
        }
      }
    }
  }catch(error){task.error=error.message;}
  finally{task.running=false;onProgress(task);}
  return task;
}

// At most one lookup is in flight. Intermediate selections are discarded;
// the newest selection runs next without racing stale results.
export function latestQueue(worker) {
  let pending=null,active=false,revision=0;
  async function drain(){if(active)return;active=true;try{while(pending){const job=pending;pending=null;await worker(job.value,()=>job.revision===revision);}}finally{active=false;}}
  return {push(value){pending={value,revision:++revision};void drain();},clear(){revision++;pending=null;}};
}

export function generationSummary(count,mode,batchSize){
 if(!count)return '尚未选择目标词，请先在左侧抽取或勾选单词。';
 if(mode!=='batch')return count>80?`已选 ${count} 个目标词，超过单篇 80 个上限，请切换分批生成。`:`已选 ${count} 个目标词 → 生成 1 篇，使用全部 ${count} 个目标词。`;
 const size=Number(batchSize);
 if(!Number.isInteger(size)||size<1||size>80)return `已选 ${count} 个目标词，请填写每篇 1–80 个。`;
 const pages=Math.ceil(count/size),last=count%size;
 return `已选 ${count} 个目标词 → 生成 ${pages} 篇，每篇最多 ${size} 个${last?`，最后一篇 ${last} 个`:''}。`;
}

export function isPassage(selection){
 return /[.!?;\n]/.test(selection)||selection.trim().split(/\s+/).length>6;
}
