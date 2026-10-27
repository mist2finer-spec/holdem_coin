"""Rebuild Hong's weapon-mounted Spine rig from preserved inputs; no AI/API key needed."""
import subprocess,sys,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2];tool=root/'scripts/rpg/hong-motion'
with tempfile.TemporaryDirectory(prefix='hong-motion-') as tmp:
 work=Path(tmp)/'work'
 commands=[
  [sys.executable,str(tool/'prepare_motion_parts.py'),'--work',str(tool/'input-work'),'--out',str(work)],
  ['node',str(tool/'retarget_motion.mjs'),'--runtime',str(root),'--native',str(root/'public/rpg/Hero_Axe01.json'),'--out',str(work)],
  [sys.executable,str(tool/'attach_weapons.py'),'--work',str(work),'--weapons',str(root/'public/rpg/weapons'),'--out',str(root/'public/rpg/characters/hong/spine')]]
 for command in commands:subprocess.run(command,cwd=root,check=True)
 dest=root/'public/rpg/characters/hong/spine';(dest/'hong.atlas.txt').write_bytes((dest/'hong.atlas').read_bytes())
print('HONG_WEAPON_ASSETS_REBUILT')
