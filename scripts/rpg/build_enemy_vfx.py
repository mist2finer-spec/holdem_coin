"""Pack already-recovered approximate Unity particle GIF bakes for runtime. No AI redraws."""
from PIL import Image,ImageSequence
from pathlib import Path
import hashlib,json
root=Path('public/rpg/vfx');out=root/'enemy';out.mkdir(exist_ok=True)
selected={'dark':'FX_DarkShot_Projectile_01','poison':'FX_PoisonCloud_01','pillar':'FX_DarkPillarHit_01','fire':'FX_ElementalBall_01_RE','water':'FX_ElementalBall_01_BL','earth':'FX_ElementalBall_01_GR','sonic':'FX_Pulse_Projectile_01','meteor':'FX_RockMeteoArea_01','explosion':'FX_CoreElementalExplosion_RE'}
rows=[]
for key,name in selected.items():
 src=root/'previews'/(name+'.gif');im=Image.open(src);frames=[f.convert('RGBA') for f in ImageSequence.Iterator(im)];sheet=Image.new('RGBA',(128*8,128*4))
 for i in range(32):
  frame=frames[min(len(frames)-1,int(i/32*len(frames)))].resize((128,128),Image.Resampling.LANCZOS);sheet.paste(frame,((i%8)*128,(i//8)*128))
 sheet.save(out/(key+'.webp'),lossless=True,method=4)
 rows.append({'id':key,'prefab':name,'sourcePreview':str(src),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sheet':'/rpg/vfx/enemy/'+key+'.webp','cell':128,'columns':8,'frames':32,'seconds':2,'mapping':'thematic preview selection; not verified GUID resolution'})
(out/'manifest.json').write_text(json.dumps({'scope':'Existing approximate XY Unity particle bakes, not exact Unity shaders. Yellow warning is code-native reconstruction; source warning texture not present locally.','effects':rows},indent=2)+'\n');print('ENEMY_VFX_PACKED',len(rows))
