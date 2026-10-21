import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {git,remote,loadEnv,credentialEnv,provider,contextFor,applyDiff,complete} from './pipeline/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');loadEnv(root);
const args=process.argv.slice(2),dry=args.includes('--dry-run');
const targets=[];let command=[];
for(let i=0;i<args.length;i++){if(args[i]==='--target')targets.push(args[++i]);else if(args[i]!=='--dry-run'&&args[i]!=='--')command.push(args[i]);}
command=command.join(' ').trim();
const tail=s=>String(s).trim().split('\n').slice(-15).join('\n');
function validate(cwd){const r=spawnSync(process.execPath,[path.join(cwd,'scripts/validate_holdem.js')],{cwd,encoding:'utf8',timeout:210000,maxBuffer:64000});if(r.status!==0)throw Error(tail(r.stderr||r.error?.message||'Validation failed'));if(r.stdout.trim()!=='VALIDATION_PASSED')throw Error('Validator did not return success sentinel');}
let work,branch,lock;
try{
 if(git(root,['remote','get-url','origin'])!==remote)throw Error('Unexpected Git remote');
 const env=credentialEnv();
 console.log('CONNECTED '+git(root,['branch','--show-current']));
 git(root,['ls-remote','origin','refs/heads/main'],env);
 if(dry){validate(root);console.log('VALIDATION_PASSED');console.log('DRY_RUN_PASSED (no LLM, commit, or push)');process.exit(0);}
 if(!command||command.length>4000)throw Error('Supply a task of 1–4000 characters');
 provider();
 if(git(root,['status','--porcelain']))throw Error('Working tree is dirty; commit your changes before an automatic task');
 lock=path.join(git(root,['rev-parse','--absolute-git-dir']),'auto-pipeline.lock');fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
 git(root,['fetch','origin','main'],env);
 // Actual upload is still fast-forward only. Dry push checks credentials/protection where supported.
 git(root,['push','--dry-run','origin','refs/remotes/origin/main:refs/heads/main'],env);
 work=fs.mkdtempSync(path.join(os.tmpdir(),'holdem-task-'));branch='auto/task-'+Date.now();
 git(root,['worktree','add','-b',branch,work,'origin/main']);
 for(const rel of ['node_modules','mini-services/poker-server/node_modules'])fs.symlinkSync(path.join(root,rel),path.join(work,rel),'dir');
 if(!targets.length){const match=command.match(/(?:src\/|mini-services\/poker-server\/)[\w/.-]+\.(?:tsx?|css)(?:#[\w]+)?/g);targets.push(...(match||['src/lib/poker-live.ts#decideLiveBot']));}
 const {context,files}=contextFor(work,targets);
 const map=git(work,['ls-files','src/lib','src/components/poker','mini-services/poker-server']).split('\n').filter(f=>/\.(tsx?|css)$/.test(f)).join('\n').slice(0,5000);
 let diff=await complete(`TASK: ${command}\nREPO MAP (paths only):\n${map}\nTARGET BLOCKS:\n${context}`);
 let success=false;
 for(let attempt=0;attempt<=2;attempt++){
  try{applyDiff(work,diff,files);validate(work);success=true;break;}
  catch(e){if(attempt===2)throw e;diff=await complete(`Repair the previous patch against its resulting state. If SEARCH failed, the patch was not applied. Return only SEARCH/REPLACE.\nLAST ERROR (15 lines):\n${tail(e.message)}\nPREVIOUS DIFF:\n${diff}`);}
 }
 if(!success)throw Error('Validation did not pass');
 const changed=git(work,['diff','--name-only']).split('\n').filter(Boolean);
 if(!changed.length)throw Error('No code changes; no commit or push');
 if(changed.some(f=>!files.has(f)))throw Error('Unexpected changed file');
 git(work,['add','-A']);git(work,['commit','-m','auto: '+command.replace(/[\r\n]/g,' ').slice(0,100)]);
 git(work,['push','origin','HEAD:main'],env);
 console.log('PIPELINE_PUSHED '+git(work,['rev-parse','HEAD']));
}catch(e){console.error(tail(e.message));if(branch)console.error('Recovery branch: '+branch);process.exitCode=1;}
finally{if(work){try{git(root,['worktree','remove','--force',work]);}catch{}}if(lock&&fs.existsSync(lock)&&fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}
