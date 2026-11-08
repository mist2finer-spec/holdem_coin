from pathlib import Path
import re,json,hashlib
P=Path('G:/new_project/IslandGame');W=Path(__file__).parent
guid={}
for p in (P/'Assets').rglob('*.meta'):
 m=re.search(r'guid: ([a-f0-9]{32})',p.read_text(encoding='utf-8',errors='replace')[:1000])
 if m:guid[m[1]]=Path(str(p)[:-5])
queue=list((P/'Assets/Island/MountRuntime/Scenes').glob('*.unity'));seen=set();missing=set()
while queue:
 p=queue.pop()
 if p in seen or not p.is_file():continue
 seen.add(p)
 if p.suffix in ['.unity','.asset','.mat','.prefab','.controller','.anim']:
  for g in set(re.findall(rb'guid: ([a-f0-9]{32})',p.read_bytes())):
   g=g.decode();target=guid.get(g)
   if target:queue.append(target)
   elif not g.startswith('000000'):missing.add(g)
out=[{'path':str(p.relative_to(P)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sorted(seen)]
(W/'evidence/runtime-dependencies.json').write_text(json.dumps({'files':out,'externalGuids':sorted(missing)},indent=2))
print(json.dumps({'files':len(out),'bytes':sum(x['bytes']for x in out),'externalGuids':list(missing),'largest':sorted(out,key=lambda x:x['bytes'],reverse=True)[:8]},indent=2))
