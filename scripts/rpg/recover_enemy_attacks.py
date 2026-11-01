"""Enrich existing verified action runtime with present trace fields. Missing values stay null.
Thematic prefab candidates from string adjacency are NOT verified Addressables GUID links.
"""
import argparse,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--trace',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('src/components/rpg/data/enemy-attack-metadata.json'));a=p.parse_args();trace=json.loads(a.trace.read_text(encoding='utf-8-sig'));rows={}
keys=['AssetGuid','StartOriginRange','TargetOriginRange','StartOnGround','TargetOnGround','ColliderHeight','ArriveHitRange','ReleaseHitRange','MovingReleaseOnArrive','MovingHitMethod','TargetTrackSpeed','TrackMaxTime','ScaleValue']
for actor in trace['actors']:
 if actor['actorType']<1000:continue
 for skill in actor['skills']:
  if not skill['actions']:continue
  action=skill['actions'][0]
  basics=action['children']['ActionBasicData'];rows[str(skill['skillType'])]=[{'at':next((b['fields'].get('Time') for b in basics if b['fields'].get('Type')==33 and b['fields'].get('DataId')==c['fields'].get('DataId')),None),**{k:c['fields'].get(k) for k in keys}} for c in action['children']['ActionImpactorData']]
out={'sourceSha256':hashlib.sha256(a.trace.read_bytes()).hexdigest(),'scope':'Present scalar accessor fields only. Per-action row indexes match original impactor child order; native defaults and GUID-to-prefab mapping are not inferred.','skills':rows};a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('RECOVERED_ENEMY_METADATA',len(rows))
