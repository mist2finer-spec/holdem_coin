"""Reproducible current-source coverage report; no claims of full Unity behavioral equivalence."""
import json,hashlib
from pathlib import Path
r=json.loads(Path('src/components/rpg/data/labyrinth-runtime.json').read_text());meta=json.loads(Path('src/components/rpg/data/enemy-attack-metadata.json').read_text());out=[]
for actor,m in r['monsters'].items():
 if int(actor)>=2000:continue
 if not (1103==int(actor) or 1151<=int(actor)<=1155 or 1251<=int(actor)<=1253 or 1301<=int(actor)<=1323 or len(m['skills'])>=3):continue
 skills=[]
 for id in m['skills']:
  a=r['actions'].get(str(id));skills.append({'id':id,'missing':a is None} if not a else {'id':id,'clip':a['clip'],'rangeWorld':a['range'],'cooldown':a['cooldown'],'cooldownDomain':'default-attack-count' if a['cooldownMethod']==1 else 'seconds','hold':a['duration'],'emissions':sum(c['count'] for c in a['commands']),'commands':a['commands'],'pending':a['pending'],'hasNativeSpatialMetadata':str(id) in meta['skills']})
 out.append({'actor':int(actor),'name':m['name'],'asset':m['asset'],'visualFallback':m['visualFallback'],'skills':skills})
p=Path('docs/rpg/enemy-attack-coverage.json');p.write_text(json.dumps({'sourceTraceSha256':meta['sourceSha256'],'scope':'All locally compiled requested families and multi-skill monster/boss profiles; command recovery is not native shader/3D physics parity.','actors':out},ensure_ascii=False,indent=2)+'\n');print('AUDITED_ENEMY_PROFILES',len(out),'skills',sum(len(x['skills']) for x in out))
