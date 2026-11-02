"""Validate prepared import data. This is not a Unity compile or PlayMode test."""
import argparse,hashlib,json
from pathlib import Path
from map_contract import CONTRACT_RESOURCE, MAP_RESOURCE, validate_contract, validate_scene
ROOT=Path(__file__).resolve().parents[2]
def validate(project):
 root=Path(project)/'Assets/Island/Resources'
 index=json.loads((root/'AssetIndex.json').read_text(encoding='utf-8'));rows=json.loads((root/'asset-export.json').read_text(encoding='utf-8'))
 assert len({r['destination'] for r in rows})==len(rows),'Duplicate output asset'
 for row in rows:
  relative=Path(row['destination']);assert not relative.is_absolute() and '..' not in relative.parts,'Unsafe manifest path'
  p=root/relative;assert p.is_file(),p;assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],p
 manifest={r['destination'] for r in rows}
 assert {'AssetIndex.json','RpgCatalog.json',CONTRACT_RESOURCE,MAP_RESOURCE+'/scene.json'}<=manifest,'Missing generated/native map hash'
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
 native=root/MAP_RESOURCE
 scene=json.loads((native/'scene.json').read_text(encoding='utf-8'))
 contract=json.loads((root/CONTRACT_RESOURCE).read_text(encoding='utf-8'))
 counts=validate_scene(scene,native);triangle_count=validate_contract(scene,contract)
 assert hashlib.sha256((native/'scene.json').read_bytes()).hexdigest()==contract['sourceFilesSha256']['scene.json'],'Original scene bytes changed'
 for texture in scene['textures'].values():assert MAP_RESOURCE+'/'+texture['file'] in manifest,'Native texture missing from manifest'
 for actor in contract['actorAssets']:
  assert actor['monsterId'] in index['monsters'] and index['monsters'][actor['monsterId']]['skeleton']==actor['skeleton'],'Boss actor resolution'
  assert index['bossTrials']['nativeActorSubstitutes'][actor['bossId']]==actor['monsterId'],'Boss actor index'
 assert index['bossTrials']['mapContract']==Path(CONTRACT_RESOURCE).with_suffix('').as_posix()
 definitions=index['bossTrials']['definitions']+'.json';assert definitions in manifest,'Boss definitions missing from manifest'
 bosses=json.loads((root/definitions).read_text(encoding='utf-8'))['bosses']
 assert len(bosses)==len(contract['actorAssets']),'Boss definition count'
 assert {boss['id']:str(boss['monsterId']) for boss in bosses}==index['bossTrials']['nativeActorSubstitutes'],'Boss definition/native actor mismatch'
 print('UNITY_EXPORT_PASSED',len(rows),'asset hashes, 35 active / 30 support / 780 nodes,',len(catalog.get('jewels',[])),'exported jewels (baseline snapshot retained), empty starter slots, Spine4.2 files')
 print('UNITY_NATIVE_MAP_PASSED',counts,triangle_count,'floor triangles, original physical camera, 10 resolved native substitute actors')
 print('Unresolved original monster graphics:',len(index['unresolvedMonsterAssets']))
 return len(rows)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--project-path',default=str(ROOT/'unity/IslandGame'));a=p.parse_args();validate(a.project_path)
