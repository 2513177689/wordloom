export class AppError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export const assert = (condition, message, status = 400) => { if (!condition) throw new AppError(message, status); };
export const text = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function today(zone = 'Asia/Shanghai') {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
  catch { throw new AppError('时区无效'); }
}
export function classify(items) {
  const known = new Set(['FAMILIAR','VAGUE','FORGET','WELL_FAMILIAR','CANCEL_WELL_FAMILIAR']);
  return [...new Map(items.filter(x => x.voc_spelling).map(x => [x.voc_id || x.voc_spelling.toLowerCase(), {
    word: x.voc_spelling, isNew: !!x.is_new, finished: !!x.is_finished,
    response: known.has(x.first_response) ? x.first_response : null,
    touched: !!x.is_finished || known.has(x.first_response),
  }])).values()];
}
const irregular = { went:'go', gone:'go', took:'take', taken:'take', made:'make', saw:'see', seen:'see', ran:'run', bought:'buy', thought:'think', brought:'bring', felt:'feel', knew:'know', known:'know', wrote:'write', written:'write', children:'child', men:'man', women:'woman', better:'good' };
export function variants(word) {
  const w = word.toLowerCase(); const out = new Set([w, irregular[w]].filter(Boolean));
  if (w.endsWith('ies')) out.add(w.slice(0,-3)+'y');
  if (w.endsWith('s')) out.add(w.slice(0,-1));
  if (w.endsWith('es')) out.add(w.slice(0,-2));
  for (const suffix of ['ed','ing']) if (w.endsWith(suffix)) { const stem = w.slice(0,-suffix.length); out.add(stem); out.add(stem+'e'); if (/(.)\1$/.test(stem)) out.add(stem.slice(0,-1)); if (suffix==='ed' && stem.endsWith('i')) out.add(stem.slice(0,-1)+'y'); }
  return out;
}
export function coverage(body, targets) {
  const words = body.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) || [];
  const normalized = words.join(' ');
  return targets.map(word => {
    const target = word.toLowerCase().trim();
    const exact = target.includes(' ') ? (` ${normalized} `).includes(` ${target} `) : words.includes(target);
    const inflected = !exact && !target.includes(' ') && words.some(w => variants(w).has(target));
    return { word, covered: exact || inflected, match: exact ? 'exact' : inflected ? 'inflection' : 'missing' };
  });
}
export function parseJSON(output) {
  try { return JSON.parse(output.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'')); }
  catch { throw new AppError('模型未返回可读取的结构化内容，请重试或更换模型。', 502); }
}
