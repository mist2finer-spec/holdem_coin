"""Read only the original Unity model bundle; extract native hero weapon exports."""
import sys,zipfile,hashlib,json
from pathlib import Path
import UnityPy
root=Path(__file__).resolve().parents[2];out=root/'archive/rpg/vardian-native-weapons';out.mkdir(parents=True,exist_ok=True)
names=['Hero_Sword01','Hero_Spear01','Hero_Dagger01'];records=[]
with zipfile.ZipFile(sys.argv[1])as z:
 name=next(n for n in z.namelist()if n.startswith('model_assets_'));raw=z.read(name);env=UnityPy.load(raw)
 for obj in env.objects:
  if obj.type.name not in ['TextAsset','Texture2D']:continue
  data=obj.read();n=data.m_Name
  if not any(n==name or n==name+'.atlas' for name in names):continue
  p=out/(n+'.png'if obj.type.name=='Texture2D'else n if n.endswith('.atlas')else n+'.json')
  if obj.type.name=='Texture2D':data.image.save(p)
  else:p.write_bytes(data.m_Script.encode('utf-8',errors='surrogateescape'))
  records.append({'file':p.name,'pathId':str(obj.path_id),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()});print('EXTRACTED',p.name)
 for base in names:
  assert all((out/(base+ext)).exists()for ext in ['.json','.atlas','.png']),base
(out/'source.json').write_text(json.dumps({'bundle':name,'bundleSha256':hashlib.sha256(raw).hexdigest(),'files':records},indent=2))
