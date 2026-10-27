"""Import approved transparent per-slot frames into a Spine animation.
Not an image generator: full ToonCrafter video frames must be segmented/reviewed first.
"""
import argparse,copy,json,shutil
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--rig',type=Path,required=True);p.add_argument('--frames',type=Path,required=True);p.add_argument('--slot',default='torso');p.add_argument('--animation',default='heavy-axe-slash');p.add_argument('--start',type=float,default=.25);p.add_argument('--end',type=float,default=.35);p.add_argument('--restore',type=float,default=.38);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
if a.out.resolve()==a.rig.resolve():raise ValueError('Use a separate output folder; preserve the original rig.')
sk=json.loads((a.rig/'hong.json').read_text());source=Image.open(a.rig/'hong.png').convert('RGBA');lines=(a.rig/'hong.atlas').read_text().splitlines();parts={}
for i,n in enumerate(lines):
 if i+1<len(lines)and lines[i+1].startswith('bounds:'):
  x,y,w,h=map(int,lines[i+1].split(':')[1].split(','));parts[n]=source.crop((x,y,x+w,y+h))
slot=next(s for s in sk['slots']if s['name']==a.slot);original=slot['attachment'];template=sk['skins'][0]['attachments'][a.slot][original];paths=sorted(a.frames.glob('*.png'))
if not paths:raise ValueError('No approved frame PNGs')
for i,path in enumerate(paths):
 im=Image.open(path)
 if im.mode!='RGBA' or im.size!=(template['width'],template['height']):raise ValueError('Frame must be RGBA at original part dimensions: '+str(path))
 n=a.slot+'-swap-'+str(i);parts[n]=im.copy()
 for skin in sk['skins']:skin['attachments'].setdefault(a.slot,{})[n]={**template,'path':n}
rows=[{'time':0,'name':original}]+[{'time':a.start+(a.end-a.start)*i/max(1,len(paths)-1),'name':a.slot+'-swap-'+str(i)}for i in range(len(paths))]+[{'time':a.restore,'name':original}]
sk['animations'][a.animation].setdefault('slots',{}).setdefault(a.slot,{})['attachment']=rows
atlas=Image.new('RGBA',(1024,1024));x=y=4;row=0;txt=['hong.png','size:1024,1024','format:RGBA8888','filter:Nearest,Nearest','repeat:none','pma:false'];a.out.mkdir(parents=True,exist_ok=True)
for name,im in parts.items():
 if x+im.width+4>1024:x=4;y+=row+4;row=0
 if y+im.height+4>1024:raise ValueError('Frame sequence exceeds atlas capacity')
 atlas.alpha_composite(im,(x,y));txt.extend([name,f'bounds:{x},{y},{im.width},{im.height}']);x+=im.width+4;row=max(row,im.height)
atlas.save(a.out/'hong.png');(a.out/'hong.atlas').write_text('\n'.join(txt)+'\n');(a.out/'hong.atlas.txt').write_text('\n'.join(txt)+'\n');(a.out/'hong.json').write_text(json.dumps(sk,separators=(',',':')));print('SLOT_SWAP_IMPORTED',len(paths),'approved frames')
