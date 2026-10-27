"""Bounded, token-free recovery/verification loop. Never pushes or deploys.
Stops on a stable compiler result or an error; unknown data is not synthesized.
"""
import argparse,hashlib,json,os,signal,subprocess,sys,time
from pathlib import Path


def seconds(value):
 n=int(value)
 if not 1<=n<=3600:raise argparse.ArgumentTypeError('Budget must be 1..3600 seconds')
 return n

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--stages',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--native',type=Path);p.add_argument('--legacy-root',type=Path);p.add_argument('--action-source',type=Path,action='append',default=[]);p.add_argument('--seconds',type=seconds,default=3300);p.add_argument('--rounds',type=int,default=3);a=p.parse_args()
 if not 1<=a.rounds<=10:p.error('--rounds must be 1..10')
 repo=Path(__file__).resolve().parents[2];a.output=a.output.resolve()
 if a.output.exists() and any(a.output.iterdir()):p.error('Choose a new empty output directory to avoid stale verification reports')
 a.output.mkdir(parents=True,exist_ok=True)
 started=time.monotonic();deadline=started+a.seconds;records=[];status='round-limit';previous=None
 runtime=repo/'src/components/rpg/data/labyrinth-runtime.json';growth=repo/'src/components/rpg/data/recovered-growth.json'
 def fingerprint():return hashlib.sha256(runtime.read_bytes()+growth.read_bytes()).hexdigest()
 def run(name,cmd):
  remaining=deadline-time.monotonic()
  if remaining<=0:raise TimeoutError('Recovery budget exhausted')
  before=time.monotonic();env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1');log=a.output/(name+'.log')
  with log.open('w') as f:
   child=subprocess.Popen(cmd,cwd=repo,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=os.name!='nt',creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=='nt' else 0)
   try:child.wait(timeout=min(remaining,300))
   except subprocess.TimeoutExpired:
    if os.name=='nt':subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=f,stderr=f,timeout=5)
    else:os.killpg(child.pid,signal.SIGKILL)
    child.wait(timeout=5);raise
   result=child
  records.append({'step':name,'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-before,3)})
  print(name, 'PASS' if result.returncode==0 else 'FAIL',flush=True)
  if result.returncode:raise RuntimeError(name+' failed; inspect '+str(log))
 py=sys.executable
 try:
  for iteration in range(1,a.rounds+1):
   run(f'round-{iteration}-compile',[py,'scripts/rpg/compile_combat_runtime.py','--source',str(a.source),'--stages',str(a.stages),'--repo',str(repo)])
   current=fingerprint()
   if previous==current:status='stable-with-blockers';break
   previous=current
   command=[py,'scripts/rpg/audit_recovery_state.py','--source',str(a.source),'--runtime',str(runtime),'--output',str(a.output/'recovery-state.json')]
   for source in a.action_source:command+=['--action-source',str(source)]
   run(f'round-{iteration}-audit',command)
   if a.legacy_root:run(f'round-{iteration}-scenes',[py,'scripts/rpg/recover_scene_links.py','--legacy-root',str(a.legacy_root),'--actors',str(a.source/'ActorData.json'),'--output',str(a.output/'scenes')])
   run(f'round-{iteration}-reference-tests',[py,'-m','unittest','discover','-s','scripts/rpg','-p','test_reference*.py'])
   if a.native:
    for script in ['verify_final_damage_native','verify_conditions_native','verify_critical_native','verify_damage_application_native','verify_shield_layers_native','verify_weighted_selection_native']:
     run(f'round-{iteration}-'+script,[py,'scripts/rpg/'+script+'.py','--native',str(a.native),'--output',str(a.output/(script+'.json'))])
   if a.native:
    run(f'round-{iteration}-reward-scaling',[py,'scripts/rpg/verify_reward_scaling_native.py','--native',str(a.native),'--source',str(a.source/'LabyrinthData.json'),'--output',str(a.output/'reward-scaling-native.json')])
   run(f'round-{iteration}-types',['npm','run','check:rpg'])
   run(f'round-{iteration}-runtime-tests',['npm','run','test:rpg'])
 except (TimeoutError,subprocess.TimeoutExpired) as e:status='budget-exhausted';print(str(e),file=sys.stderr)
 except Exception as e:status='failed';print(str(e),file=sys.stderr)
 result={'status':status,'elapsedSeconds':round(time.monotonic()-started,3),'budgetSeconds':a.seconds,'steps':records,'runtimeSha256':fingerprint(),'scope':'Deterministic extraction and validation only. Stable does not mean all original content restored. No LLM calls, push, or deployment.'}
 (a.output/'loop-summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return 0 if status=='stable-with-blockers' else 1
if __name__=='__main__':raise SystemExit(main())
