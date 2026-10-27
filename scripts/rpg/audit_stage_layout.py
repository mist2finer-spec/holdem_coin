"""Audit existing web adapter vs original scene-reactor evidence without guessing links."""
import argparse,collections,hashlib,json
from pathlib import Path

def audit(legacy,stages,runtime):
 raw=json.loads(runtime.read_text());waves=[];names=collections.Counter();stage_maps={};map_counts=collections.Counter()
 for p in sorted((legacy/'objects').glob('map_scenes*__mono.json')):
  row=json.loads(p.read_text(encoding='utf-8-sig'))
  if '_waveNo' in row:waves.append(row)
  if '_monsterInfoName' in row:names[row['_monsterInfoName']]+=1
 with stages.open(encoding='utf-8') as stream:
  for line in stream:
   row=json.loads(line)
   if row['category']!='Labyrinth':continue
   d=row['data'];map_counts[d['MapType']]+=1
   if row['stageId'] in [101,102,103,104,105,201,701]:stage_maps[str(row['stageId'])]={'mapType':d['MapType'],'victoryCondition':d['VictoryCondition'],'goal':d['VictoryConditionValue'],'monsterDefinitionCount':len(d['MonsterDatas'])}
 return {'webEncounterLayout':raw.get('encounterLayout'),'webStageCount':len(raw['stages']),'originalMapTypeCounts':dict(map_counts),'stageExamples':stage_maps,'legacyWaveCandidates':len(waves),'reactorsPerWaveHistogram':dict(sorted(collections.Counter(len(w['_spawnReactors']) for w in waves).items())),'trigger1Histogram':dict(collections.Counter(w['_triggerType1'] for w in waves)),'repeatCandidates':sum(bool(w['_repeat']) for w in waves),'spawnNameCounts':dict(names),'sourceHashes':{'runtime':hashlib.sha256(runtime.read_bytes()).hexdigest(),'stages':hashlib.sha256(stages.read_bytes()).hexdigest()},'conclusion':'Fixed normal-count then boss is a WEB ADAPTER, not the original scene rule. MonsterDatas lists definitions, not counts or spawn order.','runtimeReady':False,'blocker':'Legacy exports lost serialized-file identity; original map bundle/split APK required for scene-to-reactor/transform linkage.'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--legacy-root',type=Path,required=True);p.add_argument('--stages',type=Path,required=True);p.add_argument('--runtime',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();result=audit(a.legacy_root,a.stages,a.runtime);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['legacyWaveCandidates','repeatCandidates','runtimeReady','conclusion']}))
