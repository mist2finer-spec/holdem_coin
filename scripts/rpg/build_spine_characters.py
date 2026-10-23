"""Build articulated Spine 4.2 cutout rigs from AI-generated detached part atlases.
Pillow required. Inputs: JSON mapping roster id -> raw transparent 4x4 parts PNG.
No pose sprite swaps: each region is attached to an independently animated joint.
"""
import argparse,copy,hashlib,json,shutil
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
def keys(values,end,field='value'):
 return [{'time':round(t*end,5),field:v} for t,v in values]
def rot(values,end):return {'rotate':keys(values,end)}
def translate(values,end):return {'translate':[{'time':round(t*end,5),'x':x,'y':y} for t,x,y in values]}
def animations():
 durations=json.loads((ROOT/'src/components/rpg/motion-profile.json').read_text())['durations']
 profile=json.loads((ROOT/'src/components/rpg/combat-profile.json').read_text())
 out={}
 idle=durations['stay1']
 out['stay1']={'bones':{'center':translate([(0,0,0),(.5,0,1.5),(1,0,0)],idle),'torso':rot([(0,-1),(.5,1),(1,-1)],idle),'head':rot([(0,1),(.5,-1),(1,1)],idle),'front-upper-arm':rot([(0,0),(.5,3),(1,0)],idle),'hair':rot([(0,-1),(.5,1),(1,-1)],idle)}}
 d=durations['run1']
 out['run1']={'bones':{'center':translate([(0,0,0),(.25,0,3),(.5,0,0),(.75,0,3),(1,0,0)],d),'torso':rot([(0,-8),(1,-8)],d),'head':rot([(0,7),(1,7)],d),'front-thigh':rot([(0,-30),(.5,32),(1,-30)],d),'back-thigh':rot([(0,32),(.5,-30),(1,32)],d),'front-shin':rot([(0,20),(.25,55),(.5,8),(.75,8),(1,20)],d),'back-shin':rot([(0,8),(.25,8),(.5,20),(.75,55),(1,8)],d),'front-upper-arm':rot([(0,-35),(.5,35),(1,-35)],d),'back-upper-arm':rot([(0,35),(.5,-35),(1,35)],d),'hair':rot([(0,4),(.5,-4),(1,4)],d)}}
 for idx,stage in enumerate(profile['combo'],1):
  end=stage['duration'];hit=stage['hitAt']/end
  before=max(0,hit-.18);after=min(.9,hit+.18)
  bs={'center':translate([(0,0,0),(hit,5,0),(1,0,0)],end),'torso':rot([(0,8),(hit,-12),(1,0)],end),'head':rot([(0,-4),(hit,8),(1,0)],end),'front-upper-arm':rot([(0,-20),(before,-25),(hit,65),(after,65),(1,0)],end),'front-forearm':rot([(0,0),(before,15),(hit,-110),(after,-110),(1,0)],end),'back-upper-arm':rot([(0,0),(hit,15),(1,0)],end),'hair':rot([(0,0),(hit,6),(1,0)],end)}
  if idx==2:
   bs['back-upper-arm']=rot([(0,0),(before,-25),(hit,110),(after,110),(1,0)],end)
   bs['back-forearm']=rot([(0,0),(hit,-130),(after,-130),(1,0)],end)
   bs['front-upper-arm']=rot([(0,0),(hit,-8),(1,0)],end);bs['front-forearm']=rot([(0,0),(1,0)],end)
  if idx==3:
   bs.update({'front-thigh':rot([(0,0),(before,20),(hit,95),(after,95),(1,0)],end),'front-shin':rot([(0,0),(before,35),(hit,-5),(after,-5),(1,0)],end),'front-foot':rot([(0,0),(hit,-90),(after,-90),(1,0)],end)})
  if idx in (4,5):
   bs['back-upper-arm']=rot([(0,0),(before,-20),(hit,110),(after,110),(1,0)],end)
   bs['back-forearm']=rot([(0,0),(hit,-130),(after,-130),(1,0)],end)
   bs['torso']=rot([(0,12),(hit,-18),(1,0)],end)
   if idx==5:bs['center']=translate([(0,-5,-5),(hit,10,3),(1,0,0)],end)
  out[stage['animation']]={'bones':bs,'events':[{'time':stage['hitAt'],'name':'contact','int':idx}]}
 d=durations['avoid1'];out['avoid1']={'bones':{'center':{'rotate':keys([(0,0),(.25,-80),(.75,-280),(1,-360)],d),'translate':[{'time':0,'y':-18},{'time':d/2,'y':-27},{'time':d,'y':-18}]},'front-thigh':rot([(0,65),(1,65)],d),'back-thigh':rot([(0,65),(1,65)],d),'front-shin':rot([(0,-95),(1,-95)],d),'back-shin':rot([(0,-95),(1,-95)],d),'front-upper-arm':rot([(0,30),(1,30)],d),'back-upper-arm':rot([(0,40),(1,40)],d)}}
 d=durations['dash'];out['dash']={'bones':{'center':translate([(0,0,-6),(1,0,-6)],d),'torso':rot([(0,-18),(1,-18)],d),'head':rot([(0,15),(1,15)],d),'front-thigh':rot([(0,25),(1,25)],d),'back-thigh':rot([(0,-30),(1,-30)],d),'hair':rot([(0,12),(1,12)],d)}}
 for name in ['skill1','skill2','skill3','skill4','skill5','skill5_loop','skill5_end','rest1','damage1','die1']:
  d=durations.get(name,.3)
  bs={'center':translate([(0,0,0),(.5,0,1),(1,0,0)],d)}
  if name=='die1':bs={'center':{'rotate':keys([(0,0),(.4,90),(1,90)],d)}}
  elif name=='damage1':bs={'torso':rot([(0,0),(.3,15),(1,0)],d)}
  elif name.startswith('skill'):bs.update({'front-upper-arm':rot([(0,0),(.3,135),(.8,135),(1,0)],d),'front-forearm':rot([(0,0),(.3,-80),(.8,-80),(1,0)],d),'back-upper-arm':rot([(0,0),(.3,145),(.8,145),(1,0)],d)})
  out[name]={'bones':bs}
 return out

def build(inputs):
 for key,label,portrait in ROSTER:
  if key not in inputs:continue
  dest=ROOT/'public/rpg/characters'/key/'rig';dest.mkdir(parents=True,exist_ok=True);(dest/'parts').mkdir(exist_ok=True)
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
   # Remove baked joint caps/extra hand from the supplied atlas region bounds.
   if part.endswith('shin') and portrait in (1,4,5):partim=partim.crop((0,round(partim.height*.08),partim.width,partim.height))
   if part=='front-forearm' and portrait==3:partim=partim.crop((0,0,partim.width,round(partim.height*.66)))
   w,h=DIMS[i]
   if part=='pelvis' and portrait in (2,3):w,h=(53,68 if portrait==3 else 48)
   if part=='hair-back' and portrait in (1,2,3,4):w,h=55,48
   if part=='hair-back' and portrait in (5,6,7,9):w,h=56,{5:65,6:95,7:110,9:100}[portrait]
   if part=='pelvis' and portrait in (2,3) or part=='hair-back' and portrait in (5,6,7,9):partim=partim.resize((round(w*2),round(h*2)),Image.Resampling.NEAREST)
   else:
    s=min(w*2/partim.width,h*2/partim.height);partim=partim.resize((max(1,round(partim.width*s)),max(1,round(partim.height*s))),Image.Resampling.NEAREST)
   partim.save(dest/'parts'/f'{part}.png',optimize=True);px=x*256+8;py=y*256+8;atlas.alpha_composite(partim,(px,py));pw,ph=partim.size;sizes[part]=(pw/2,ph/2)
   atlaslines.extend([part,f'bounds:{px},{py},{pw},{ph}'])
  atlas.save(dest/'character.png',optimize=True);atlastext='\n'.join(atlaslines)+'\n';(dest/'character.atlas').write_text(atlastext);(dest/'character.atlas.txt').write_text(atlastext)
  bones=[bone('root'),bone('center','root',0,75),bone('hips','center',0,-17),bone('torso','hips',0,9),bone('head','torso',0,39),bone('hair','head')]
  for side,x in [('back',-9),('front',9)]:
   bones.extend([bone(f'{side}-thigh','hips',x,0,-90,27),bone(f'{side}-shin',f'{side}-thigh',27,0,0,26),bone(f'{side}-foot',f'{side}-shin',26,0,90,20)])
  for side,x,rotation,elbow in [('back',-13,-110,130),('front',13,-65,110)]:
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
  (dest/'character.json').write_text(json.dumps(sk,ensure_ascii=False,indent=2)+'\n')
  (dest/'rig-manifest.json').write_text(json.dumps({'id':key,'version':'articulated-cutout-v1','spine':'4.2','bones':len(bones),'parts':PARTS,'animations':list(sk['animations']),'hitEvents':'contact; metadata only in web, HuntEngine owns damage','alpha':'straight','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'limitations':['Region attachments, not weighted meshes or IK.','Procedural common choreography; not recovered original animation.','No native .spine editor project or Unity-generated .meta/material assets.']},ensure_ascii=False,indent=2)+'\n')
  metaPath=dest.parent/'manifest.json'
  meta=json.loads(metaPath.read_text());meta.update({'rig':'rig/character.json','rigAtlas':'rig/character.atlas.txt','renderMode':'spine-4.2-articulated'})
  metaPath.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
  print('SPINE_RIG_BUILT',key,len(bones),'bones',len(sk['animations']),'animations')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);a=p.parse_args();build(json.loads(Path(a.inputs).read_text()))
