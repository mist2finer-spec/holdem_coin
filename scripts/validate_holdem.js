// No network or LLM calls. All diagnostics bounded to the final 15 lines.
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/KEY|TOKEN|SECRET|PASSWORD|GIT_CONFIG/i.test(k)));
env.POKER_TEST_MODE='1';
function run(cmd,args,{timeout=90000,simulation=false}={}){
 return new Promise((resolve,reject)=>{
  let tail='',pending='',done=false,count=0;const child=spawn(cmd,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('Validation process timeout'));},timeout);
  function finish(err){if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve();}
  function receive(data){const s=data.toString();tail=(tail+s).slice(-12000);
   if(simulation){pending+=s;const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(/^HAND_START \d+$/.test(line)){
    count++;clearTimeout(timer);timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error(`Hand ${count}: event loop/OOP/IP timeout (5 seconds)`));},5000);
   }}
  }
  child.stdout.on('data',receive);child.stderr.on('data',receive);child.on('error',finish);
  child.on('exit',(code,signal)=>finish(code===0&&(!simulation||count===20&&tail.includes('SIMULATION_PASSED'))?null:new Error(`Validation failed (${code??signal})\n${tail}`)));
 });
}
(async()=>{
 await run(process.execPath,['node_modules/typescript/bin/tsc','-p','scripts/tsconfig.validate.json']);
 await run('npm',['test','--prefix','mini-services/poker-server']);
 await run(process.execPath,['--import',path.join(root,'mini-services/poker-server/node_modules/tsx/dist/loader.mjs'),'scripts/pipeline/simulate.ts'],{simulation:true,timeout:15000});
 console.log('VALIDATION_PASSED');
})().catch(e=>{console.error(String(e.stack||e).trim().split('\n').slice(-15).join('\n'));process.exitCode=1;});
