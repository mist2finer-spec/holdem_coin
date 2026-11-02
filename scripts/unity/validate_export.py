"""Validate prepared import data. This is not a Unity compile or PlayMode test."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def validate(project):
 root=Path(project)/'Assets/Island/Resources'
 index=json.loads((root/'AssetIndex.json').read_text(encoding='utf-8'));rows=json.loads((root/'asset-export.json').read_text(encoding='utf-8'))
 assert len({r['destination'] for r in rows})==len(rows),'Duplicate output asset'
 for row in rows:
  p=root/row['destination'];assert p.is_file(),p;assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],p
 for name in set(index['heroes'].values())|{m['skeleton'] for m in index['monsters'].values()}:
  p=root/'WebAssets/rpg'/name
  assert p.with_suffix('.json').is_file(),p
  data=json.loads(p.with_suffix('.json').read_text(encoding='utf-8'));assert data['skeleton']['spine'].startswith('4.2'),(p,data['skeleton']['spine'])
  atlas=p.with_suffix('.atlas.txt');assert atlas.is_file(),p
  lines=atlas.read_text(encoding='utf-8').splitlines()
  for i,line in enumerate(lines):
   if line.endswith('.png') and (i==0 or not lines[i-1].strip()):assert (atlas.parent/line).is_file(),(atlas,line)
 catalog=json.loads((root/'RpgCatalog.json').read_text(encoding='utf-8'))
 assert catalog['schema']==3
 assert (len(catalog['active']),len(catalog['support']),len(catalog['tree']['nodes']))==(35,30,780)
 ids={n['id'] for n in catalog['tree']['nodes']};assert len(ids)==780
 assert all(e['from'] in ids and e['to'] in ids for e in catalog['tree']['edges'])
 assert all('displayX' in n and 'displayY' in n for n in catalog['tree']['nodes'])
 assert all(all(gem is None for gem in item['gems']) for item in catalog['starter']['equipment']['items'])
 assert len(catalog['starter']['gemCollection']['active'])==6
 assert all(n==1 for n in catalog['starter']['gemCollection']['active'].values())
 assert catalog['crafting']['linkChance']==.35
 print('UNITY_EXPORT_PASSED',len(rows),'asset hashes, 35 active / 30 support / 780 nodes, empty starter slots, Spine4.2 files')
 print('Unresolved original monster graphics:',len(index['unresolvedMonsterAssets']))
 return len(rows)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--project-path',default=str(ROOT/'unity/IslandGame'));a=p.parse_args();validate(a.project_path)
