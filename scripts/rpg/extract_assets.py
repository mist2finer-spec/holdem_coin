"""Extract only the prototype selection. Source ZIP is never modified.
Usage: python scripts/rpg/extract_assets.py "/path/to/asset bundle.zip"
Requires UnityPy and Pillow. Unity object IDs are scoped to their bundle.
"""
import hashlib,json,sys,zipfile
from pathlib import Path
import UnityPy
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/rpg'
SELECTION={
 'map': ['BG_Forest01','BG_Tree01'],
 'uicommon': ['FrameCombatArtSkillFrame'],
 'uiicons': ['Portrait_Hero_005','mat_gold','mat_arcanegem','SkillIcon_GroundRift','SkillIcon_DarkHole','SkillIcon_Blizzard3','SkillIcon_HolyWrath2','SkillIcon_Whirlwind','SkillIcon_VitalRecovery'],
 'model': ['Hero_Axe01','Hero_Axe01.atlas','Enemy_Slime_01_R','Enemy_Slime_01_R.atlas'],
}
manifest=[]
with zipfile.ZipFile(sys.argv[1]) as z:
 for group,names in SELECTION.items():
  bundle=next(n for n in z.namelist() if n.startswith(group+'_assets_'))
  raw=z.read(bundle);env=UnityPy.load(raw)
  for obj in env.objects:
   if obj.type.name not in ['Texture2D','TextAsset']:continue
   data=obj.read()
   if data.m_Name not in names:continue
   name=data.m_Name
   if obj.type.name=='Texture2D':
    dest=OUT/(name+'.png');dest.parent.mkdir(parents=True,exist_ok=True);data.image.save(dest)
   else:
    dest=OUT/(name if name.endswith('.atlas') else name+'.json');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data.m_Script.encode('utf-8',errors='surrogateescape'))
   manifest.append({'file':dest.name,'bundle':bundle,'object_id':str(obj.path_id),'bundle_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Extracted',len(manifest),'files')
