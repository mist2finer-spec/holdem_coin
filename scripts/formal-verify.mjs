/** Development-only integration. No game imports, hooks or automatic model execution. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pin=JSON.parse(fs.readFileSync(path.join(root,'scripts/formal-verify-source.json'),'utf8'));
const checkout=path.join(root,pin.directory),skill=path.join(checkout,'skills/formal-verify');
function run(command,args,cwd=root){return spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});}
function requireCommand(command,args,cwd){const r=run(command,args,cwd);if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr||r.stdout||`${command} failed`);return r.stdout.trim();}
function assertSource(){
 if(!fs.existsSync(path.join(skill,'SKILL.md')))throw Error('Source missing; run npm run formal:setup');
 if(requireCommand('git',['rev-parse','HEAD'],checkout)!==pin.revision)throw Error('External checkout revision differs from the reviewed pin; do not use it');
 if(requireCommand('git',['remote','get-url','origin'],checkout)!==pin.repository)throw Error('Unexpected external Git remote');
 if(requireCommand('git',['status','--porcelain','--untracked-files=all'],checkout))throw Error('External skill has local modifications; inspect before using it');
}
try{
 const [mode,...args]=process.argv.slice(2);
 if(mode==='setup'){
  if(!fs.existsSync(checkout)){
   fs.mkdirSync(path.dirname(checkout),{recursive:true});
   requireCommand('git',['init',checkout]);
   requireCommand('git',['remote','add','origin',pin.repository],checkout);
   requireCommand('git',['fetch','--depth','1','origin',pin.revision],checkout);
   requireCommand('git',['checkout','--detach',pin.revision],checkout);
  }
  assertSource();console.log(`SOURCE_READY ${pin.revision}\nNo models executed. Tool availability is checked separately with formal:doctor.`);
 }else if(mode==='doctor'){
  if(args.length!==2||args[0]!=='--tool'||!['tla','lean','rust'].includes(args[1]))throw Error('Usage: npm run formal:doctor -- --tool tla|lean|rust');
  assertSource();const tool=args[1];
  // Readiness-only: never install a toolchain or create a model from the doctor command.
  const command=tool==='lean'?'elan':'bash';
  const projectPin=path.join(root,'lean/lean-toolchain');
  const leanPin=fs.readFileSync(fs.existsSync(projectPin)?projectPin:path.join(skill,'examples/lean-template/lean-toolchain'),'utf8').trim();
  const parameters=tool==='lean'?['run',leanPin,'lean','--version']:[path.join(skill,'scripts/setup.sh'),tool];
  const r=run(command,parameters);
  if(r.error||r.status!==0){console.error(`UNAVAILABLE ${tool}: ${r.error?.message||r.stdout||r.stderr}\nRemedy: read ${path.join(skill,'references/setup.md')}`.trim());process.exitCode=3;}
  else console.log(`${tool==='lean'?'READY Lean ':''}${r.stdout.trim()}\nREADINESS_ONLY: no project property checked.`);
 }else throw Error('Usage: node scripts/formal-verify.mjs setup|doctor --tool tla|lean|rust');
}catch(e){console.error('FORMAL_SETUP_FAILED: '+e.message);process.exitCode=1;}
