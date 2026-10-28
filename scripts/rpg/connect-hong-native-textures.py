"""Pixel-space seam assembly at final 4x resolution, from existing high-res sources.
No generated facial detail: original source cells supply all three views.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,re,runpy,sys,hashlib
ROOT=Path(__file__).resolve().parents[2]
helpers=runpy.run_path(str(ROOT/'scripts/rpg/build-hong-native-hd.py'))
source=Image.open(ROOT/'archive/rpg/hong-native-hd-source/source-parts-1280.png').convert('RGBA')
def cell(i):
 x=i%4*source.width//4;y=i//4*source.height//4
 return helpers['cut_component'](source.crop((max(0,x-18),max(0,y-18),min(source.width,x+source.width//4+18),min(source.height,y+source.height//4+18))))
def skin(c):return c[3]>128 and c[0]>110 and c[0]>c[1]*1.08 and c[1]>c[2]*.9
for weapon in sys.argv[1:]:
 out=ROOT/f'public/rpg/characters/hong/native-{weapon}';page=Image.open(out/'hong.png').convert('RGBA');layout=(out/'hong.atlas').read_text()
 regions={n:tuple(map(int,b.split(',')))for n,b in re.findall(r'([^\n]+)\nbounds:(\d+,\d+,\d+,\d+)',layout)}
 raw=json.loads((out/'hong.json').read_text());skin_data=raw['skins'][0]['attachments']
 # Full-resolution face and bangs are one rigid attachment. Hair below the neck is separate.
 joined=[];xnew=520
 for key,head,hair,index in [('head','hong_head','hair_front',15),('S_head','hong_S_head','hair_side',2),('B_head','hong_B_head','hair_back',3)]:
  x,y,w,h=regions[head];hx,hy,hw,hh=regions[hair]
  im=cell(index).resize((w,h),Image.Resampling.LANCZOS);im=helpers['clean'](im)
  canvas=Image.new('RGBA',(hw,128));longhair=page.crop((hx,hy,hx+hw,hy+hh));canvas.alpha_composite(longhair.crop((0,0,hw,128)))
  # Native head and its surrounding hair share their upper edge and head-bone coordinates.
  offset=round((skin_data['head'][key]['vertices'][5]-(14.19 if key=='head' else 15.19))*4)
  canvas.alpha_composite(im,(max(0,offset),0))
  name=skin_data['head'][key]['name'];page.paste(canvas,(xnew,300));joined.append((name,xnew,300,hw,128));xnew+=hw+8
  # Only the shoulder-length portion is deformable; bangs/crown stay in rigid head.
  alpha=longhair.getchannel('A');alpha.paste(0,(0,0,hw,round(hh*.50)));longhair.putalpha(alpha);page.paste(longhair,(hx,hy))
 # Round the proximal skin into an overlap cap instead of exposing a flat cut edge.
 caps=0;seams=0
 for name,(x,y,w,h) in regions.items():
  if 'leg' in name:
   im=page.crop((x,y,x+w,y+h));colors=[im.getpixel((xx,yy))for yy in range(max(1,int(h*.18)))for xx in range(w)if skin(im.getpixel((xx,yy)))]
   if not colors:continue
   color=tuple(sorted(c[i]for c in colors)[len(colors)//2]for i in range(3))+(255,)
   cap=Image.new('RGBA',(w,h));ImageDraw.Draw(cap).ellipse((w*.27,0,w*.74,h*.18),fill=color);cap.alpha_composite(im);page.paste(cap,(x,y));caps+=1
  if name in ['hong_Larm','hong_B_Larm','hong_Rarm','hong_B_Rarm','hong_Larm_S']:
   im=page.crop((x,y,x+w,y+h));old=im.copy()
   for yy in range(max(1,int(h*.13))):
    for xx in range(w):
     c=old.getpixel((xx,yy))
     if c[3]<128 or max(c[:3])>95:continue
     candidates=[old.getpixel((a,b)) for b in range(max(0,yy-3),min(h,yy+4))for a in range(max(0,xx-3),min(w,xx+4))if skin(old.getpixel((a,b)))]
     if candidates:im.putpixel((xx,yy),tuple(round(sum(c[k]for c in candidates)/len(candidates))for k in range(3))+(c[3],));seams+=1
   page.paste(im,(x,y))
 page.save(out/'hong.png')
 extra=''.join(f'{name}\nbounds:{x},{y},{w},{h}\n' for name,x,y,w,h in joined)
 for suffix in ['', '-linear','-nearest']:
  path=out/f'hong{suffix}.atlas';path.write_text(path.read_text()+extra)
 manifest=json.loads((out/'manifest.json').read_text());
 if 'textureUpgrade' in manifest:
  upgrade=manifest['textureUpgrade'];upgrade['baselineGeometrySha256']=upgrade['geometrySha256'];upgrade['geometrySha256']=hashlib.sha256((out/'hong.json').read_bytes()).hexdigest();upgrade['parts']['hong_head']['runtimeReplacement']='hong_head_joined: source-parts-1280.png cell 15'
 manifest['connections'].update({'roundedLegCaps':caps,'openedShoulderPixels':seams,'joinedHeadRegions':[r[0]for r in joined],'headSourceSize':source.size});(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('HONG_SEAM_TEXTURES',weapon,caps,seams)
