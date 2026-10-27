"""Compile a bounded supported subset of original scene graphs for the web adapter.
Unsupported messages/quest/NPC dispatch stay on the existing encounter adapter.
"""
import argparse,collections,json,hashlib
from pathlib import Path
from reference_monsters import monster_abilities

def name_hash(name):
 a=b=5381
 for i,c in enumerate(name):
  if i%2:b=((b*33)^ord(c))&0xffffffff
  else:a=((a*33)^ord(c))&0xffffffff
 v=(a+b*1566083941)&0xffffffff
 return v-2**32 if v>=2**31 else v

def compile_flow(graph_dir,decoded,repo):
 scenes=json.loads((graph_dir/'scene-graphs.json').read_text());source=json.loads((graph_dir/'summary.json').read_text());runtime=json.loads((repo/'src/components/rpg/data/labyrinth-runtime.json').read_text())
 actors={r['ActorType']:r for r in json.loads((decoded/'ActorData.json').read_text())['ActorDatas']};combat=json.loads((decoded/'CombatData.json').read_text())
 plans={};scene_plans={};rejected=collections.Counter()
 def local_key(ident):return ident['serialized_file']+'#'+ident['path_id']
 def target_key(target):return target[0]+'#'+target[1] if target else None
 for scene in scenes:
  if not scene['mapKeyFromLabel']:continue
  for root in sorted({w['rootName'] for w in scene['waves']} - {None}):
   waves=[w for w in scene['waves'] if w['rootName']==root];spawns=[s for s in scene['spawns'] if s['rootName']==root]
   reactors=[r for r in scene['reactors'] if r['rootName']==root];lookup={local_key(r['identity']):r for r in reactors}
   keys={local_key(w['identity']) for w in waves};spawn_keys={local_key(s['identity']) for s in spawns};failure=None
   if len({w['waveNo'] for w in waves})!=len(waves):failure='duplicate-wave-group-number'
   if any(not w['activeInHierarchy'] or w['deactivated'] for w in waves):failure='inactive-wave'
   if any(w['repeat'] and not 1<=w['repeatCount']<=8 for w in waves):failure='unbounded-or-large-repeat'
   if sum((w['repeatCount'] if w['repeat'] else 1)*len(w['spawnKeys']) for w in waves)>128:failure='encounter-bound'
   used={target_key(k) for w in waves for k in w['spawnKeys']}
   if not used or not used<=spawn_keys or None in used:failure='unresolved-wave-spawns'
   unused={local_key(s['identity']) for s in spawns}-used
   if any(local_key(s['identity']) in unused and any(t['type'] for t in s['triggers']) for s in spawns):failure='standalone-spawner-dispatch'
   if any(target_key(q['target']) in unused and q['field'].startswith(('_targetsToOn','_targetsToActivate')) for r in reactors for q in r['qualifiedReferences']):failure='standalone-spawner-dispatch'
   spawns=[s for s in spawns if local_key(s['identity']) in used]
   if any(not s['activeInHierarchy'] or s['deactivated'] for s in spawns):failure='inactive-spawn'
   if any(any(t['type'] not in [0,10,20,40] or (t['type']!=0 and t['selfMessageType']!=3) for t in w['triggers']) for w in waves):failure='unsupported-wave-trigger'
   # Spawn-point self triggers can create additional actors independently of a wave.
   if any(any(t['type'] for t in s['triggers']) for s in spawns):failure='independent-spawn-trigger'
   points=[s['worldMatrix'] for s in spawns]+[r['worldMatrix'] for r in reactors if r['hierarchy'].rsplit('/',1)[-1] in ['StartPoint','EndPoint']]
   points=[m for m in points if m];axis=max([0,2],key=lambda i:max(m[i][3] for m in points)-min(m[i][3] for m in points)) if points else 2
   lo=min(m[axis][3] for m in points) if points else 0;hi=max(m[axis][3] for m in points) if points else 1
   factor=4400/max(1,hi-lo)
   def project(r):return round(300+(r['worldMatrix'][axis][3]-lo)*factor,4)
   areas=[];relevant_activators=[]
   for r in reactors:
    raw=r['rawFields'];targets=[]
    for suffix in [1,2]:
     on=[target_key(q['target']) for q in r['qualifiedReferences'] if q['field'].startswith('_targetsToOn'+str(suffix)+'[')]
     relevant=[k for k in on if k in keys]
     if not relevant:continue
     if any(q['field'].startswith(('_targetsToOff','_targetsToDeactivate','_targetsToSwitch')) and target_key(q['target']) in keys for q in r['qualifiedReferences']):failure='wave-deactivation-dispatch'
     if not r['activeInHierarchy'] or r['deactivated']:failure='inactive-activator'
     typ=raw.get('_triggerType'+str(suffix),0)
     if typ not in [10,20,40]:failure='unsupported-activation-trigger'
     deps=[target_key(k) for k in r['triggers'][suffix-1]['references']['_waveReactorsToCheck']]
     relevant_activators.append({'type':typ,'targets':relevant,'deps':deps,'x':project(r),'radius':max(30,raw.get('_size'+str(suffix),0)*factor)})
   initial={local_key(w['identity']) for w in waves if any(t['type'] in [10,20] for t in w['triggers'])}
   initial|={k for a in relevant_activators if a['type'] in [10,20] for k in a['targets']}
   reachable=set(initial)
   for _ in range(len(waves)+1):
    for w in waves:
     for t in w['triggers']:
      deps=[target_key(k) for k in t['references']['_waveReactorsToCheck']]
      if t['type']==40 and deps and set(deps)<=reachable:reachable.add(local_key(w['identity']))
    for a in relevant_activators:
     if a['type']==40 and a['deps'] and set(a['deps'])<=reachable:reachable.update(a['targets'])
   if reachable!=keys:failure='unreachable-wave'
   if failure:
    rejected[failure]+=1
    continue
   ids={k:i for i,k in enumerate(sorted(keys))};spid={k:i for i,k in enumerate(sorted(used))}
   def trigger(typ,target,refs,x,radius):return {'type':typ,'targets':[ids[k] for k in target],'deps':[ids[k] for k in refs if k in ids],'x':x,'radius':radius}
   triggers=[]
   for w in waves:
    r=lookup[local_key(w['identity'])]
    for t in w['triggers']:
     if t['type']:triggers.append(trigger(t['type'],[local_key(w['identity'])],[target_key(k) for k in t['references']['_waveReactorsToCheck']],project(r),max(30,r['rawFields'].get('_size'+str(w['triggers'].index(t)+1),0)*factor)))
   for a in relevant_activators:triggers.append(trigger(a['type'],a['targets'],a['deps'],a['x'],a['radius']))
   starts=[r for r in reactors if r['hierarchy'].rsplit('/',1)[-1]=='StartPoint'];start=project(starts[0]) if len(starts)==1 else 300
   plan={'source':'original-scene-graph/web-1d-projection','mapKey':scene['mapKeyFromLabel'],'root':root,'axis':'xz'[axis//2],'startX':start,'unusedSpawnDefinitions':len(unused),
    'spawns':[{'id':spid[local_key(s['identity'])],'name':s['monsterInfoName'],'x':project(s)} for s in sorted(spawns,key=lambda s:spid[local_key(s['identity'])]) if local_key(s['identity']) in used],
    'waves':[{'id':ids[local_key(w['identity'])],'waveNo':w['waveNo'],'spawns':[spid[target_key(k)] for k in w['spawnKeys']], 'delay':w['spawnDelay'],'repeat':bool(w['repeat']),'interval':w['repeatInterval'],'count':w['repeatCount']} for w in waves],'triggers':triggers}
   key='/'.join(map(str,scene['mapKeyFromLabel']))+'/'+root;plans[key]=plan;scene_plans[(tuple(scene['mapKeyFromLabel']),root)]=key
 bindings={};binding_rejections=collections.Counter();stage_by_id={s['id']:s for s in runtime['stages']}
 for line in (decoded/'stages.jsonl').open():
  row=json.loads(line)
  if row['category']!='Labyrinth':continue
  d=row['data'];sid=row['stageId'];root='MapEntityRoot'+(str(d['MapEntityGroupId']) if d['MapEntityGroupId'] else '');key=scene_plans.get(((d['MapTheme'],d['MapType']),root))
  if not key:binding_rejections['unsupported-or-unresolved-layout']+=1;continue
  if d['VictoryCondition'] not in [1,3]:binding_rejections['other-victory-condition']+=1;continue
  definitions={m['MonsterInfoNameHash']:m for m in d['MonsterDatas']};roster={};bad=False
  for name in sorted({s['name'] for s in plans[key]['spawns']}):
   monster=definitions.get(name_hash(name))
   if not monster or monster['HeroAbilityBased'] or str(monster['MonsterType']) not in runtime['monsters']:bad=True;break
   stats=monster_abilities(d,monster,actors[monster['MonsterType']],combat);profile=monster
   roster[name]={'row':[monster['MonsterType'],stats.get(7,1),stats.get(8,1),profile['MonsterAIType'],profile.get('SkillTypes',[]),[stats.get(k,0) for k in [9,10,11,12]]],'boss':bool(monster['MonsterFlag']&1024)}
  if bad:binding_rejections['unresolved-monster-definition']+=1;continue
  bindings[str(sid)]={'layout':key,'roster':roster}
 usedplans={b['layout'] for b in bindings.values()};plans={k:v for k,v in plans.items() if k in usedplans}
 out={'sourceBundleSha256':source['bundleSha256'],'projection':'Original longitudinal X/Z axis mapped to 300..4700 web units; Y/lanes are a visual adapter.','layouts':plans,'stages':bindings}
 target=repo/'src/components/rpg/data/scene-flow-runtime.json';target.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 report={'layouts':len(plans),'stages':len(bindings),'rejectedLayouts':dict(rejected),'rejectedStages':dict(binding_rejections),'firstFive':{str(i):bindings.get(str(i),{}).get('layout') for i in range(101,106)},'dataSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
 (repo/'docs/rpg/scene-flow-runtime-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--graph-dir',type=Path,required=True);p.add_argument('--decoded',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path('.'));a=p.parse_args();compile_flow(a.graph_dir,a.decoded,a.repo)
