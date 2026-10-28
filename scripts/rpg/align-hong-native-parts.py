"""Deterministic UV registration of existing cutouts; no new character art."""
from pathlib import Path
from PIL import Image,ImageOps
import math
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'archive/rpg/hong-native-v1';OUT=ROOT/'public/rpg/characters/hong/native-axe/parts';OUT.mkdir(parents=True,exist_ok=True)
for p in (SRC/'parts').glob('*.png'):Image.open(p).save(OUT/p.name)
def spans(im):
 a=im.getchannel('A');rows=[]
 for y in range(im.height):
  xs=[x for x in range(im.width)if a.getpixel((x,y))>40];rows.append((min(xs),max(xs)+1)if xs else None)
 return rows
def arm(name):
 im=Image.open(SRC/'parts'/('hong_'+name+'.png')).convert('RGBA')
 if name=='B_Rarm':im=ImageOps.mirror(im)
 ref=Image.open(SRC/'reference-parts'/('cos15_'+name+'.png')).convert('RGBA');s=spans(im);dest=spans(ref);out=Image.new('RGBA',im.size)
 # Register each row to the native UV envelope. This puts the elbow at the
 # native .47/.52 bend and retains the native 28.68-degree forearm rest curve.
 valid=[y for y,r in enumerate(s)if r]
 for y,d in enumerate(dest):
  if not d:continue
  sy=min(valid,key=lambda v:abs(v-y));l,r=s[sy];strip=im.crop((l,sy,r,sy+1)).resize((d[1]-d[0],1),Image.Resampling.BICUBIC);out.paste(strip,(d[0],y))
 out.save(OUT/('hong_'+name+'.png'))
for n in ['B_Rarm','Rarm','Larm','B_Larm']:arm(n)
# The alternate straight-arm frame shares the corrected curve.
Image.open(OUT/'hong_Larm.png').resize(Image.open(SRC/'parts/hong_Larm_S.png').size,Image.Resampling.LANCZOS).save(OUT/'hong_Larm_S.png')
for n in ['Lleg1','Lleg2','B_Lleg1','B_Lleg2','Rleg','B_Rleg']:
 im=Image.open(SRC/'parts'/('hong_'+n+'.png')).convert('RGBA');rows=spans(im);w,h=im.size
 center=lambda y:sum(rows[y])/2 if rows[y]else w/2
 shaft=sum(center(y)for y in range(h//4,h*3//5))/(h*3//5-h//4);foot=sum(center(y)for y in range(h*4//5,h))/(h-h*4//5)
 if foot<shaft:im=ImageOps.mirror(im);rows=spans(im)
 out=Image.new('RGBA',im.size);center=lambda y:sum(rows[y])/2 if rows[y]else w/2
 ankle=sum(center(y)for y in range(h*3//5,h*3//4))/(h*3//4-h*3//5)
 for y,r in enumerate(rows):
  if not r:continue
  # Straight thigh/shin; retain the boot's +X toe flare in the bottom quarter.
  shift=w*.48-(center(y)if y<h*.72 else ankle);left=round(r[0]+shift);right=round(r[1]+shift)
  if y>=h*.78:left=round(w*.28);right=round(w*.96)
  left=max(0,left);right=min(w,max(left+1,right));out.paste(im.crop((r[0],y,r[1],y+1)).resize((right-left,1),Image.Resampling.BICUBIC),(left,y))
 out.save(OUT/('hong_'+n+'.png'))
print('NATIVE_PARTS_REGISTERED',len(list(OUT.glob('*.png'))))
