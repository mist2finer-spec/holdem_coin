"""Deterministic combat/growth gap accounting; unresolved rows remain explicit."""
import argparse,collections,hashlib,json
from pathlib import Path
from reference_monsters import action_timeline
from reference_conditions import unconditional_filter

def audit(source,runtime_path,output,action_sources=()):
 load=lambda name:json.loads((source/(name+'.json')).read_text())
 actions=load('ActionData')['ActionDatas'];actors=load('ActorData')['ActorDatas'];present={a['SkillType'] for a in actions}
 missing=[{'actorType':a['ActorType'],'skillType':s} for a in actors for s in a.get('SkillTypes',[]) if s not in present]
 effects=[]
 for a in actions:
  for event in action_timeline(a)['events']:
   for e in ([event['child']] if event['type']==8 else [v['effect'] for v in event.get('effects',[])]):effects.append((a['SkillType'],e))
 filters=[{'skillType':s,'dataId':e['DataId'],'filterOp':e.get('FilterOp',0),'constantResult':unconditional_filter(e),'requiresSkillParameters':any(e.get('P'+str(i),0)>1 for i in range(1,6))} for s,e in effects if e.get('FilterDatas')]
 sources=[]
 for p in dict.fromkeys([source/'ActionData.json',*action_sources]):
  raw=p.read_bytes();j=json.loads(raw)
  rows=j.get('ActionDatas',[]) if isinstance(j,dict) else j
  if not isinstance(rows,list):raise ValueError('Not an action table: '+str(p))
  found={r.get('SkillType') for r in rows if isinstance(r,dict)}
  sources.append({'source':p.name,'sha256':hashlib.sha256(raw).hexdigest(),'actionRows':len(rows),'matchingMissingSkills':sorted({m['skillType'] for m in missing}&found)})
 runtime=json.loads(runtime_path.read_text());pending=collections.Counter(p['kind'] for a in runtime['actions'].values() for p in a['pending'])
 result={'rawActionRecords':len(actions),'uniqueSkillActions':len(present),'missingActorActions':missing,'actionSourcesChecked':sources,'uniqueActionSourceHashes':len({s['sha256'] for s in sources}),'filteredEffects':filters,'filterCasesReduced':sum(x['constantResult'] is not None for x in filters),'filterCasesStillRequiringSkillLevel':sum(x['requiresSkillParameters'] for x in filters),'runtimePending':dict(pending),'effectTypes':dict(collections.Counter(str(e['Type']) for _,e in effects)),
 'additionalRequired':['Active effect expiry, stacking, immunity and proc-state dispatcher before enabling complete final damage','Actual equipped skill levels, not hardcoded level one','Native shield absorption/backlash and groggy effect ordering','Per-scene qualified Unity identities plus Transform hierarchy and MapType-to-scene mapping','NPC ActorData profiles are not authoritative HP or growth profiles','Original reward event/drop routing and atomic stage settlement','Persistent in-progress battle state beyond the current checkpoint'],
 'status':'partial-recovery-with-explicit-blockers'}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--runtime',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--action-source',type=Path,action='append',default=[]);a=p.parse_args();r=audit(a.source,a.runtime,a.output,a.action_source);print(json.dumps({k:r[k] for k in ['missingActorActions','filterCasesReduced','filterCasesStillRequiringSkillLevel','runtimePending','status']}))
