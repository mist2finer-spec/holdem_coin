"""Preserve SD Hong art; add procedural native slash attachments and articulated shoulders/skirt."""
import argparse,json,shutil,math
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
sk=json.loads((a.source/'hong.json').read_text());atlas=Image.open(a.source/'hong.png').convert('RGBA');lines=(a.source/'hong.atlas').read_text().splitlines();parts={}
for i,line in enumerate(lines):
 if i+1<len(lines) and lines[i+1].startswith('bounds:'):
  x,y,w,h=map(int,lines[i+1].split(':')[1].split(','));parts[line]=atlas.crop((x,y,x+w,y+h))
for n,(start,end) in enumerate([(-110,-40),(-110,35),(-60,70)],1):
 im=Image.new('RGBA',(224,224));d=ImageDraw.Draw(im)
 # Analytic crescent texture; no borrowed reference-sheet pixels or generated body art.
 for inset,width,color in [(0,19,(255,180,74,45)),(2,11,(255,203,107,110)),(3,6,(255,233,162,210)),(4,2,(255,255,232,255))]:
  d.arc((30+inset,28+inset,198-inset,196-inset),start,end,fill=color,width=width)
 parts['slash-'+str(n)]=im
for side in ['front','back']:
 name=side+'-upper-arm';i=next(i for i,b in enumerate(sk['bones'])if b['name']==name);arm=sk['bones'][i];shoulder={'name':side+'-shoulder','parent':arm['parent'],'x':arm.get('x',0),'y':arm.get('y',0)};arm.update(parent=side+'-shoulder',x=0,y=0);sk['bones'].insert(i,shoulder)
sk['bones'].append({'name':'skirt','parent':'pelvis'});next(s for s in sk['slots'] if s['name']=='pelvis')['bone']='skirt'
sk['bones'].append({'name':'slash-fx','parent':'root','x':55,'y':118});sk['slots'].append({'name':'slash-fx','bone':'slash-fx','color':'ffffff00'})
for skin in sk['skins']:
 skin['attachments']['slash-fx']={n:{'type':'region','path':n,'width':224,'height':224}for n in parts if n.startswith('slash-')}
out=Image.new('RGBA',(1024,512));x=y=4;row=0;lines=['hong.png','size:1024,512','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false']
(a.out/'parts').mkdir(exist_ok=True)
for name,im in parts.items():
 if x+im.width+4>1024:x=4;y+=row+4;row=0
 if y+im.height+4>512:raise ValueError('Atlas exceeded bounds')
 out.alpha_composite(im,(x,y));lines.extend([name,f'bounds:{x},{y},{im.width},{im.height}']);im.save(a.out/'parts'/f'{name}.png');x+=im.width+4;row=max(row,im.height)
out.save(a.out/'hong.png')
for name in ['hong.atlas','hong.atlas.txt']:(a.out/name).write_text('\n'.join(lines)+'\n')
(a.out/'hong.json').write_text(json.dumps(sk));print('HEAVY_AXE_PARTS_READY',len(sk['bones']),'bones')
