import { resolve } from 'node:path';
import { createApp } from './app.mjs';
const port=Number(process.env.PORT || 4173), host=process.env.HOST || '127.0.0.1';
const {server,db}=createApp({dataDir:resolve(process.env.DATA_DIR || '.data')});
server.listen(port,host,()=>console.log(`词间已启动：http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
