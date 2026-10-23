"""Create a Unity-importable Assets folder ZIP without redistributing Spine runtimes."""
import argparse,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();dest=Path(args.output);dest.parent.mkdir(parents=True,exist_ok=True)
roster=json.loads((ROOT/'public/rpg/characters/roster.json').read_text())
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
 for c in roster:
  folder=ROOT/'public/rpg/characters'/c['id']/'rig'
  for name in ['character.json','character.atlas.txt','character.png','rig-manifest.json','original-art.json']:
   z.write(folder/name,f"Assets/IslandCombat/Characters/{c['id']}/{name}")
 for f in (ROOT/'unity/IslandCombat/Runtime').glob('*.cs'):z.write(f,'Assets/IslandCombat/Runtime/'+f.name)
 z.write(ROOT/'docs/rpg/UNITY_SPINE_IMPORT.md','README.md')
 z.write(ROOT/'public/rpg/SPINE-RUNTIME-LICENSE.txt','SPINE-RUNTIME-LICENSE.txt')
with zipfile.ZipFile(dest) as z:assert z.testzip() is None
print('UNITY_SPINE_PACKAGE',dest.name,dest.stat().st_size)
