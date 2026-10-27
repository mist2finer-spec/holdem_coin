"""Attach existing inventory weapon art to Hong wrist mounts; no image generation."""
import argparse,copy,hashlib,json,math,shutil
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--weapons',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
sk=json.loads((a.work/'hong.json').read_text());images={p.stem:Image.open(p).convert('RGBA') for p in (a.work/'parts').glob('*.png')}
meta={};specs={'sword':(79,(84,300)),'axe':(85,(89,287)),'spear':(118,(160,225)),'dual':(58,(84,300))}
for weapon,(height,grip) in specs.items():
 source=a.weapons/('sword.png' if weapon=='dual' else weapon+'.png');im=Image.open(source).convert('RGBA');w,h=im.size;rot=im.rotate(45,Image.Resampling.BICUBIC,expand=True);ang=math.pi/4
 pivot=(rot.width/2+(grip[0]-w/2)*math.cos(ang)+(grip[1]-h/2)*math.sin(ang),rot.height/2-(grip[0]-w/2)*math.sin(ang)+(grip[1]-h/2)*math.cos(ang));box=rot.getbbox();tile=rot.crop(box);scale=height/tile.height;ww=max(1,round(tile.width*scale));im=tile.resize((ww,height),Image.Resampling.LANCZOS);pivot=((pivot[0]-box[0])*ww/tile.width,(pivot[1]-box[1])*height/tile.height)
 name='held-'+weapon;images[name]=im;meta[weapon]={'attachment':name,'type':'region','path':name,'x':round(im.width/2-pivot[0],4),'y':round(pivot[1]-im.height/2,4),'width':im.width,'height':im.height,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceGrip':list(grip),'source':'/rpg/weapons/'+source.name}
for b in sk['bones']:
 if b['name']=='weapon-front':b.update(x=4,y=1)
 if b['name']=='weapon-back':b.update(x=0,y=2)
# Render the grip under its hand instead of drawing the whole weapon on top of fingers.
slots={s['name']:s for s in sk['slots']};order=[s['name']for s in sk['slots']if not s['name'].startswith('weapon-')]
for side in ['front','back']:order.insert(order.index(side+'-hand'),'weapon-'+side)
sk['slots']=[slots[n] for n in order];body=sk['skins'][0]['attachments'];sk['skins']=[{'name':'default','attachments':copy.deepcopy(body)}]
for weapon in ['unarmed','sword','axe','dual','spear']:
 attachments=copy.deepcopy(body)
 if weapon!='unarmed':
  art={k:v for k,v in meta[weapon].items()if k in ['type','path','x','y','width','height']};name=meta[weapon]['attachment'];attachments['weapon-front']={name:art}
  if weapon=='dual':attachments['weapon-back']={name:copy.deepcopy(art)}
 sk['skins'].append({'name':weapon,'attachments':attachments})
# Spine finds attachments by matching the slot attachment name, so set it per selected skin in the runtime.
# The JSON setup pose remains unarmed. Runtime sets held-X on the two weapon slots explicitly.
atlas=Image.new('RGBA',(512,512));x=y=4;row=0;lines=['hong.png','size:512,512','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false']
for name,im in images.items():
 if x+im.width+4>512:x=4;y+=row+4;row=0
 if y+im.height+4>512:raise ValueError('Atlas full')
 atlas.alpha_composite(im,(x,y));lines.extend([name,f'bounds:{x},{y},{im.width},{im.height}']);x+=im.width+4;row=max(row,im.height)
atlas.save(a.out/'hong.png');(a.out/'hong.atlas').write_text('\n'.join(lines)+'\n')
# Reduce repeated constant keys while retaining the endpoint/duration of every clip.
for anim in sk['animations'].values():
 for bone in anim.get('bones',{}).values():
  for kind,rows in list(bone.items()):
   if not isinstance(rows,list) or len(rows)<3:continue
   def value(r):return {k:v for k,v in r.items() if k!='time'}
   bone[kind]=[r for i,r in enumerate(rows)if i==0 or i==len(rows)-1 or value(r)!=value(rows[i-1]) or value(r)!=value(rows[i+1])]
(a.out/'hong.json').write_text(json.dumps(sk,separators=(',',':')))
report=json.loads((a.work/'motion-report.json').read_text());report.update(weapons=meta,renderMode='hong-spine-weapons-v1',runtimeHitAuthority='Server HuntEngine remains authoritative; visual time remapped to server hitAt/duration; no damage from Spine events.',scope='Hong only; other eight characters retain their sprite packs.')
(a.out/'manifest.json').write_text(json.dumps(report,indent=2));print('HONG_WEAPON_RIG_READY',a.out)
