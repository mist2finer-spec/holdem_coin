"""Audit legacy scene exports without silently joining colliding Unity PathIDs."""
import argparse,collections,csv,hashlib,json
from pathlib import Path

def audit(root,actors_path,output):
 actors={a['ActorType']:a for a in json.loads(actors_path.read_text())['ActorDatas']}
 with (root/'objects_index.csv').open(encoding='utf-8-sig') as f:
  index=[r for r in csv.DictReader(f) if r['bundle'].startswith('map_scenes')]
 counts=collections.Counter((r['bundle'],r['path_id']) for r in index)
 waves=[];npcs=[];spawns=[];rows=0
 for p in sorted((root/'objects').glob('map_scenes*__mono.json')):
  tree=json.loads(p.read_text(encoding='utf-8-sig'));bundle,pid,_=p.name.rsplit('__',2);rows+=1
  identity={'bundle':bundle,'pathId':pid,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source':p.name,'serializedFile':None,'identityAmbiguous':counts[(bundle,pid)]>1}
  if '_waveNo' in tree:
   refs=[{**r,'resolution':'AMBIGUOUS_SERIALIZED_FILE' if counts[(bundle,str(r['m_PathID']))]>1 else 'MISSING_SERIALIZED_FILE_IDENTITY'} for r in tree.get('_spawnReactors',[])]
   waves.append({**identity,'wave':tree['_waveNo'],'delay':tree['_spawnDelay'],'repeat':tree['_repeat'],'repeatInterval':tree['_repeatInterval'],'repeatCount':tree['_repeatCount'],'spawns':refs,'runtimeReady':False})
  if '_monsterInfoName' in tree:spawns.append({**identity,'monsterInfoName':tree['_monsterInfoName'],'range':tree.get('_range'),'runtimeReady':False})
  if '_actorType' in tree and '_lookAtType' in tree:
   actor=actors.get(tree['_actorType']);npcs.append({**identity,'actorType':tree['_actorType'],'lookAtType':tree['_lookAtType'],'block':tree.get('_block'),'actorProfile':{k:actor[k] for k in ['AssetGuid','Size','Height','TagFlag','StartAIType','MainAttrType'] if k in actor} if actor else None,'skillTypes':actor.get('SkillTypes') if actor else None,'stagePositionVerified':False})
 summary={'legacyMapIndexRows':len(index),'legacyMapFiles':rows,'collidingBundlePathIds':sum(v>1 for v in counts.values()),'maximumCollisionMultiplicity':max(counts.values(),default=0),'waveDefinitions':len(waves),'spawnDefinitions':len(spawns),'npcDefinitions':len(npcs),'distinctNpcActors':len({n['actorType'] for n in npcs}),'npcActorProfilesJoined':sum(n['actorProfile'] is not None for n in npcs),'runtimeReadyWaves':0,'blocker':'Legacy filenames omit serialized-file identity and overwrite scene-local PathIDs. References and transforms must be re-exported with (bundle,serialized_file,path_id). NPC ActorData join alone does not recover native NPC HP or stage placement.'}
 output.mkdir(parents=True,exist_ok=True)
 for name,data in [('summary',summary),('wave-candidates',waves),('npc-actor-candidates',npcs),('spawn-candidates',spawns)]:
  (output/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 return summary
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--legacy-root',type=Path,required=True);p.add_argument('--actors',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(audit(a.legacy_root,a.actors,a.output)))
