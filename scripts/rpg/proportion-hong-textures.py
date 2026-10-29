"""Expand the 4x leg shaft within its existing cell, preserving boot/toe pixels."""
from pathlib import Path
from PIL import Image
import sys,json,re,math
ROOT=Path(__file__).resolve().parents[2]
for weapon in sys.argv[1:]:
 out=ROOT/f'public/rpg/characters/hong/native-{weapon}';page=Image.open(out/'hong.png').convert('RGBA')
 regions={n:tuple(map(int,b.split(',')))for n,b in re.findall(r'([^\n]+)\nbounds:(\d+,\d+,\d+,\d+)',(out/'hong.atlas').read_text())};audit={}
 for name,(x,y,w,h) in regions.items():
  if name not in ['hong_Lleg1','hong_Lleg2','hong_B_Lleg1','hong_B_Lleg2','hong_Rleg','hong_B_Rleg']:continue
  original=page.crop((x,y,x+w,y+h));im=original.copy();before=after=0
  for yy in range(math.ceil(h*.78)):
   xs=[xx for xx in range(w)if original.getpixel((xx,yy))[3]>=128]
   if not xs:continue
   left,right=min(xs),max(xs)+1;span=right-left
   # Full volume through the thigh/shin, then smoothly return to unchanged boots.
   t=max(0,min(1,(yy/h-.68)/.10));gain=1.24-.24*t*t*(3-2*t)
   width=min(w-2,math.ceil(span*gain));center=(left+right)/2;dest=max(1,min(w-1-width,round(center-width/2)))
   strip=original.crop((left,yy,right,yy+1)).resize((width,1),Image.Resampling.LANCZOS)
   strip.putalpha(strip.getchannel('A').point(lambda v:255 if v>=128 else 0));im.paste((0,0,0,0),(0,yy,w,yy+1));im.paste(strip,(dest,yy))
   if .15<=yy/h<.68:before+=span;after+=width
  assert im.crop((0,math.ceil(h*.78),w,h)).tobytes()==original.crop((0,math.ceil(h*.78),w,h)).tobytes(),'Boot pixels changed'
  assert after>=before*1.20,(name,before,after)
  page.paste(im,(x,y));audit[name]={'shaftWidthRatio':after/before,'shaftGain':1.24,'bootStart':math.ceil(h*.78)}
 page.save(out/'hong.png');manifest=json.loads((out/'manifest.json').read_text());manifest['proportions']['textureVolume']=audit;(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('HONG_LEG_VOLUME',weapon,{n:round(v['shaftWidthRatio'],3)for n,v in audit.items()})
