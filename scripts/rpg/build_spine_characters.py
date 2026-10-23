"""Build articulated Spine 4.2 cutout rigs from original character design-board cutouts.
Pillow required. Inputs: JSON mapping roster id -> raw transparent 4x4 parts PNG.
No pose sprite swaps: each region is attached to an independently animated joint.
"""
import argparse,hashlib,json,shutil
from pathlib import Path
from PIL import Image
from build_character_assets import grid_boundaries,ROSTER
ROOT=Path(__file__).resolve().parents[2]
PARTS=['head','torso','pelvis','front-upper-arm','front-forearm','front-hand','back-upper-arm','back-forearm','back-hand','front-thigh','front-shin','front-foot','back-thigh','back-shin','back-foot','hair-back']
DIMS=[(55,55),(40,43),(40,25),(19,32),(18,32),(16,15),(19,32),(18,32),(16,15),(20,33),(17,32),(28,16),(20,33),(17,32),(28,16),(56,94)]
def bone(name,parent=None,x=0,y=0,rotation=0,length=0):
 b={'name':name}
 if parent:b['parent']=parent
 for k,v in [('x',x),('y',y),('rotation',rotation),('length',length)]:
  if v:b[k]=v
 return b
def animations():
 return json.loads((ROOT/'scripts/rpg/vardian-retarget.json').read_text())['animations']

def build(inputs):
 for key,label,portrait in ROSTER:
  if key not in inputs:continue
  dest=ROOT/'archive/rpg/spine-characters'/key;dest.mkdir(parents=True,exist_ok=True);(dest/'parts').mkdir(exist_ok=True)
  source=Path(inputs[key]);im=Image.open(source).convert('RGBA');shutil.copyfile(source,dest/'parts-source.png')
  mask=im.getchannel('A').point(lambda a:255 if a>=40 else 0)
  try:
   rows=grid_boundaries(mask,'y');columns=[grid_boundaries(mask.crop((0,rows[y],im.width,rows[y+1])),'x') for y in range(4)]
   rectangles=[(columns[y][x],rows[y],columns[y][x+1],rows[y+1]) for y in range(4) for x in range(4)]
  except ValueError:
   # Some atlases stagger tall hair/shoes across a nominal row. Use column-local
   # transparent gutters instead, preserving the complete part without clipping.
   cols=grid_boundaries(mask,'x');localrows=[grid_boundaries(mask.crop((cols[x],0,cols[x+1],im.height)),'y') for x in range(4)]
   rectangles=[(cols[x],localrows[x][y],cols[x+1],localrows[x][y+1]) for y in range(4) for x in range(4)]
  atlas=Image.new('RGBA',(1024,1024));atlaslines=['character.png','size:1024,1024','format:RGBA8888','filter:Linear,Linear','repeat:none','pma:false'];sizes={}
  for i,part in enumerate(PARTS):
   x,y=i%4,i//4;cell=im.crop(rectangles[i]);box=cell.getchannel('A').point(lambda a:255 if a>=40 else 0).getbbox()
   if not box:raise ValueError(f'{key}: empty {part}')
   partim=cell.crop(box)
   w,h=DIMS[i]
   if part=='head':w,h=(52,46) if key=='boy-hoodie' else (43,42)
   if part.endswith('upper-arm') or part.endswith('forearm'):w,h=18,27
   if part.endswith('hand'):w,h=13,14
   if part=='pelvis' and key in ('white-bob','gold-dress'):w,h=(53,70 if key=='gold-dress' else 48)
   if part=='hair-back' and portrait in (1,2,3,4):w,h=43,40
   if part=='hair-back' and portrait in (5,6,7,9):w,h=(80,76) if portrait==6 else (47,{5:76,7:82,9:42}[portrait])
   if part=='pelvis' and key in ('white-bob','gold-dress') or part=='hair-back' and portrait in (5,6,7,9):partim=partim.resize((round(w*2),round(h*2)),Image.Resampling.NEAREST)
   elif any(part.endswith(v) for v in ('thigh','shin','upper-arm','forearm')):
    partim=partim.resize((min(round(w*2),max(2,round(partim.width*h*2/partim.height))),round(h*2)),Image.Resampling.NEAREST)
   else:
    s=min(w*2/partim.width,h*2/partim.height);partim=partim.resize((max(1,round(partim.width*s)),max(1,round(partim.height*s))),Image.Resampling.NEAREST)
   partim.save(dest/'parts'/f'{part}.png',optimize=True);px=x*256+8;py=y*256+8;atlas.alpha_composite(partim,(px,py));pw,ph=partim.size;sizes[part]=(pw/2,ph/2)
   atlaslines.extend([part,f'bounds:{px},{py},{pw},{ph}'])
  atlas.save(dest/'character.png',optimize=True);atlastext='\n'.join(atlaslines)+'\n';(dest/'character.atlas').write_text(atlastext);(dest/'character.atlas.txt').write_text(atlastext)
  bones=[bone('root'),bone('center','root',0,75),bone('hips','center',0,-17),bone('torso','hips',0,9),bone('head','torso',0,39),bone('hair','head')]
  for side,x in [('back',-9),('front',9)]:
   bones.extend([bone(f'{side}-thigh','hips',x,0,-90,27),bone(f'{side}-shin',f'{side}-thigh',27,0,0,26),bone(f'{side}-foot',f'{side}-shin',26,0,90,20)])
  for side,x,rotation,elbow in [('back',-13,-116,29),('front',13,-55,23)]:
   bones.extend([bone(f'{side}-upper-arm','torso',x,32,rotation,25),bone(f'{side}-forearm',f'{side}-upper-arm',25,0,elbow,25),bone(f'{side}-hand',f'{side}-forearm',25,0,0,12)])
  order=['hair-back','back-thigh','back-shin','back-foot','front-thigh','front-shin','front-foot','back-upper-arm','back-forearm','back-hand','torso','pelvis','head','front-upper-arm','front-forearm','front-hand']
  slots=[];attachments={}
  for part in order:
   bn={'hair-back':'hair','pelvis':'hips'}.get(part,part);w,h=sizes[part];x,y,rotation=0,0,0
   if part=='head':y=h/2-5
   elif part=='torso':y=h/2-3
   elif part=='pelvis':y=-h/2+10
   elif part=='hair-back':y=sizes['head'][1]-7-h/2
   elif part.endswith('foot'):x,y=7,h/2-5
   elif part.endswith('hand'):x=5;rotation=90
   else:x=13;rotation=90
   slots.append({'name':part,'bone':bn,'attachment':part})
   attachments[part]={part:{'type':'region','path':part,'x':x,'y':y,'rotation':rotation,'width':w,'height':h}}
  sk={'skeleton':{'spine':'4.2.43','hash':hashlib.sha256(source.read_bytes()).hexdigest()[:12],'images':'parts/','audio':''},'bones':bones,'slots':slots,'skins':[{'name':'default','attachments':attachments}],'events':{'contact':{}},'animations':animations()}
  (dest/'character.json').write_text(json.dumps(sk,ensure_ascii=False,separators=(',',':'))+'\n')
  (dest/'rig-manifest.json').write_text(json.dumps({'id':key,'version':'original-art-vardian-motion-v2','spine':'4.2','bones':len(bones),'parts':PARTS,'animations':list(sk['animations']),'hitEvents':'contact; metadata only in web, HuntEngine owns damage','alpha':'straight','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'artProvenance':'original-art.json','motionProvenance':{k:v for k,v in json.loads((ROOT/'scripts/rpg/vardian-retarget.json').read_text()).items() if k!='animations'},'limitations':['Region attachments, not weighted meshes or IK.','Original Hero_Axe01 motion retargeted to common cutout proportions; not a native character rig.','No native .spine editor project or Unity-generated .meta/material assets.']},ensure_ascii=False,indent=2)+'\n')
  print('SPINE_RIG_BUILT',key,len(bones),'bones',len(sk['animations']),'animations')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);a=p.parse_args();build(json.loads(Path(a.inputs).read_text()))
