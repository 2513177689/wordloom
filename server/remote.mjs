import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError, assert } from './domain.mjs';

export function publicIP(ip) {
  if (isIP(ip) === 4) { const [a,b] = ip.split('.').map(Number); return !(a===0 || a===10 || a===127 || a>=224 || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0)) || (a===100 && b>=64 && b<=127) || (a===198 && (b===18 || b===19))); }
  // IPv6 calls use only global-unicast addresses; reject mapped and local ranges.
  return isIP(ip)===6 && /^[23][0-9a-f]{3}:/i.test(ip) && !ip.toLowerCase().startsWith('2001:db8:');
}
export async function requestJSON(address, { body, headers = {}, timeout = 90000 } = {}) {
  const url = new URL(address);
  assert(url.protocol==='https:' && !url.username && !url.password && (!url.port || url.port==='443'), '接口必须使用 HTTPS 默认端口，且不能含账号信息');
  const addresses = await lookup(url.hostname, {all:true}).catch(() => { throw new AppError('无法解析服务地址，请检查网络或接口地址。',502); });
  assert(addresses.length && addresses.every(x => publicIP(x.address)), '接口地址必须指向公网服务');
  const selected = addresses.find(x => x.family===4) || addresses[0];
  return await new Promise((resolve,reject) => {
    const raw = body === undefined ? null : JSON.stringify(body);
    const req = https.request(url, { method: raw ? 'POST' : 'GET', headers: {Accept:'application/json', ...(raw ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)} : {}), ...headers}, lookup: (_host, options, cb) => options.all ? cb(null,[selected]) : cb(null,selected.address,selected.family) }, res => {
      let chunks=[]; let size=0;
      res.on('data', chunk => { size+=chunk.length; if(size>4_000_000) req.destroy(new AppError('服务返回内容过大',502)); else chunks.push(chunk); });
      res.on('end', () => {
        if (res.statusCode<200 || res.statusCode>=300) {
          const messages={401:'凭证无效或已过期，请更新后重试',403:'此凭证无权访问服务，请检查权限',429:'服务请求过于频繁或额度不足，请稍后重试'};
          return reject(new AppError(messages[res.statusCode] || `远程服务返回 ${res.statusCode}，请核对模型名称、接口地址及账号余额`,502));
        }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new AppError('服务返回了非 JSON 数据',502)); }
      });
      res.on('error', () => reject(new AppError('服务连接中断，请重试',502)));
    });
    const timer=setTimeout(() => req.destroy(new AppError('请求超时，请稍后重试',504)),timeout);
    req.on('close',() => clearTimeout(timer));
    req.on('error',e => reject(e instanceof AppError ? e : new AppError('无法连接远程服务，请检查网络或系统证书。',502)));
    req.end(raw);
  });
}
