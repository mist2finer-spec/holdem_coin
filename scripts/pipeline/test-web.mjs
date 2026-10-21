// Token-free integration: authenticated HTTP -> worker dry run -> validator.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const token=randomBytes(32).toString('hex'),port=18787;
const server=spawn(process.execPath,['scripts/pipeline_web.mjs'],{env:{...process.env,AUTO_PIPELINE_WEB_TOKEN:token,AUTO_PIPELINE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const url=`http://127.0.0.1:${port}`;
try{
 for(let i=0;i<50&&!logs.includes('receiver:');i++)await new Promise(r=>setTimeout(r,100));
 assert.equal((await fetch(url+'/tasks')).status,401);
 const response=await fetch(url+'/tasks',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({command:'Verify Dry-Run',dryRun:true})});
 assert.equal(response.status,202);const {id}=await response.json();
 let job;for(let i=0;i<180;i++){
  job=await (await fetch(url+'/tasks/'+id,{headers:{authorization:'Bearer '+token}})).json();
  if(job.status!=='running')break;await new Promise(r=>setTimeout(r,1000));
 }
 assert.equal(job.status,'passed');console.log('WEB_DRY_RUN_PASSED (auth + worker + 20 hands, no LLM or Git writes)');
}finally{server.kill('SIGTERM');}
