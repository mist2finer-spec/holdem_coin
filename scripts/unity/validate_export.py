import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'unity/IslandGame/Assets/Island/Resources'
index=json.loads((root/'AssetIndex.json').read_text());rows=json.loads((root/'asset-export.json').read_text())
for row in rows:
 p=root/row['destination'];assert p.is_file(),p;assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],p
for name in set(index['heroes'].values())|{m['skeleton'] for m in index['monsters'].values()}:
 p=root/'WebAssets/rpg'/name
 assert p.with_suffix('.json').is_file(),p
 d=json.loads(p.with_suffix('.json').read_text());assert d['skeleton']['spine'].startswith('4.2'),(p,d['skeleton']['spine'])
 assert p.with_suffix('.atlas.txt').is_file(),p
print('UNITY_EXPORT_PASSED',len(rows),'files; unresolved source monster assets:',len(index['unresolvedMonsterAssets']))
