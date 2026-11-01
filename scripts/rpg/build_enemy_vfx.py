"""Pack already-recovered approximate Unity particle GIF bakes for runtime. No AI redraws."""
from PIL import Image,ImageSequence
from pathlib import Path
import hashlib,json,statistics

def unmatte(frame):
 # Existing preview GIFs have an opaque viewer backdrop, not native particle alpha.
 # Recover an approximate alpha and remove the backdrop before runtime compositing.
 im=frame.convert("RGBA");w,h=im.size
 corners=[im.getpixel((x,y)) for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]]
 bg=tuple(statistics.median(p[c] for p in corners) for c in range(3));pixels=[]
 for r,g,b,a in im.getdata():
  rgb=(r,g,b);contrast=max(abs(rgb[c]-bg[c]) for c in range(3))
  alpha=min(1,max(0,(contrast-2)/36))*a/255
  pixels.append((0,0,0,0) if alpha==0 else tuple(round(max(0,min(255,(rgb[c]-bg[c]*(1-alpha))/alpha))) for c in range(3))+(round(alpha*255),))
 im.putdata(pixels);return im
root=Path('public/rpg/vfx');out=root/'enemy';out.mkdir(exist_ok=True)
selected={'dark':'FX_DarkShot_Projectile_02','poison':'FX_PoisonCloud_01','pillar':'FX_DarkPillarHit_01','fire':'FX_ElementalBall_01_RE','water':'FX_ElementalBall_01_BL','earth':'FX_ElementalBall_01_GR','sonic':'FX_Pulse_Projectile_01','meteor':'FX_RockMeteoArea_01','explosion':'FX_CoreElementalExplosion_RE'}
rows=[]
for key,name in selected.items():
 src=root/'previews'/(name+'.gif');im=Image.open(src);frames=[f.convert('RGBA') for f in ImageSequence.Iterator(im)];sheet=Image.new('RGBA',(128*8,128*4))
 for i in range(32):
  frame=unmatte(frames[min(len(frames)-1,int(i/32*len(frames)))]).resize((128,128),Image.Resampling.LANCZOS);sheet.paste(frame,((i%8)*128,(i//8)*128))
 sheet.save(out/(key+'.webp'),lossless=True,method=4)
 rows.append({'id':key,'prefab':name,'sourcePreview':str(src),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sheet':'/rpg/vfx/enemy/'+key+'.webp','cell':128,'columns':8,'frames':32,'seconds':2,'alphaRecovery':'approximate corner-backdrop unmatting from opaque preview GIF; not original particle alpha','mapping':'thematic preview selection; not verified GUID resolution'})
(out/'manifest.json').write_text(json.dumps({'scope':'Existing approximate XY Unity particle bakes, not exact Unity shaders. Yellow warning is code-native reconstruction; source warning texture not present locally.','effects':rows},indent=2)+'\n');print('ENEMY_VFX_PACKED',len(rows))
