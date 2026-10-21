import http from 'node:http';
import {timingSafeEqual,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from './pipeline/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');loadEnv(root);
const secret=process.env.AUTO_PIPELINE_WEB_TOKEN;
if(!secret||secret.length<32)throw Error('Set AUTO_PIPELINE_WEB_TOKEN (at least 32 characters)');
const jobs=new Map();let busy=false;
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const server=http.createServer((req,res)=>{
 const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(res,401,{error:'Unauthorized'});
 if(req.method==='GET'&&req.url?.startsWith('/tasks/')){const job=jobs.get(req.url.slice(7));return send(res,job?200:404,job||{error:'Not found'});}
 if(req.method!=='POST'||req.url!=='/tasks')return send(res,404,{error:'Not found'});
 if(busy)return send(res,409,{error:'Worker busy'});
 let body='';req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>16000)req.destroy();});
 req.on('end',()=>{
  let task;try{task=JSON.parse(body);}catch{return send(res,400,{error:'Invalid JSON'});}
  if(typeof task.command!=='string'||!task.command.trim()||task.command.length>4000||task.command.startsWith('--')||task.targets!==undefined&&(!Array.isArray(task.targets)||task.targets.length>5||task.targets.some(t=>typeof t!=='string'||t.startsWith('--'))))return send(res,400,{error:'Invalid task'});
  if(busy)return send(res,409,{error:'Worker busy'});
  const id=randomUUID(),job={id,status:'running',exitCode:null};if(jobs.size>=100)jobs.delete(jobs.keys().next().value);jobs.set(id,job);busy=true;
  const args=['scripts/auto_pipeline.mjs',...(task.dryRun===true?['--dry-run']:[]),...(task.targets||[]).flatMap(t=>['--target',t]),'--',task.command];
  const child=spawn(process.execPath,args,{cwd:root,stdio:['ignore','ignore','ignore']});
  child.on('error',()=>{job.status='failed';job.exitCode=1;busy=false;});
  child.on('exit',code=>{job.status=code===0?'passed':'failed';job.exitCode=code;busy=false;});
  send(res,202,{id,status:'running'});
 });
});
server.requestTimeout=10000;
server.listen(Number(process.env.AUTO_PIPELINE_PORT||8787),'127.0.0.1',()=>console.log('Pipeline web receiver: http://127.0.0.1:'+(process.env.AUTO_PIPELINE_PORT||8787)));
