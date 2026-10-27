"""Minimal independent BVH forward kinematics -> 2D angle/depth/foreshortening drivers.
Projection convention follows standard orthographic xy/xz/zy geometry. No rendering stack needed.
"""
import argparse,json,math,hashlib,re
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--bvh',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--plane',choices=['xy','xz','zy'],default='xy');p.add_argument('--frames',type=int,default=120);a=p.parse_args()
text=a.bvh.read_text();hier,motion=text.split('MOTION',1);tokens=re.findall(r'[{}]|[^\s{}]+',hier);index=1;nodes=[];channels=0

def node(parent):
 global index,channels
 kind=tokens[index];index+=1
 if kind=='End':index+=1;name=nodes[parent]['name']+'_End'+str(len(nodes))
 else:name=tokens[index];index+=1
 assert tokens[index]=='{';index+=1;info={'name':name,'parent':parent,'offset':[0,0,0],'channels':[],'channelStart':channels};i=len(nodes);nodes.append(info)
 while tokens[index]!='}':
  word=tokens[index]
  if word=='OFFSET':info['offset']=list(map(float,tokens[index+1:index+4]));index+=4
  elif word=='CHANNELS':
   n=int(tokens[index+1]);info['channels']=tokens[index+2:index+2+n];info['channelStart']=channels;channels+=n;index+=2+n
  elif word in ['JOINT','End']:node(i)
  else:raise ValueError('Unexpected BVH token '+word)
 index+=1
node(None)
lines=[x.strip()for x in motion.splitlines()if x.strip()];frame_count=int(lines[0].split(':')[1]);frame_time=float(lines[1].split(':')[1]);values=[list(map(float,x.split()))for x in lines[2:2+min(a.frames,frame_count)]];children={i:[]for i in range(len(nodes))}
for i,n in enumerate(nodes):
 if n['parent']is not None:children[n['parent']].append(i)
axes={'x':0,'y':1,'z':2};xy=[axes[x]for x in a.plane];depth=({0,1,2}-set(xy)).pop();frames=[];first=None
for v in values:
 assert len(v)==channels
 transforms=[];world=[]
 for n in nodes:
  m=np.eye(4);m[:3,3]=n['offset']
  for j,c in enumerate(n['channels']):
   axis=axes[c[0].lower()];val=v[n['channelStart']+j];part=np.eye(4)
   if c.endswith('position'):part[axis,3]=val
   else:
    theta=math.radians(val);s=math.sin(theta);co=math.cos(theta);other=[x for x in range(3)if x!=axis];i,k=other
    # Right-handed X/Y/Z rotations. Y uses the opposite off-diagonal sign.
    sign=-1 if axis==1 else 1;part[i,i]=part[k,k]=co;part[i,k]=-s*sign;part[k,i]=s*sign
   m=m@part
  if n['parent']is not None:m=transforms[n['parent']]@m
  transforms.append(m);world.append(m[:3,3])
 world=np.asarray(world);root=world[0,xy];first=root.copy()if first is None else first;entries=[]
 for i,n in enumerate(nodes):
  child=next((c for c in children[i]if np.linalg.norm(world[c]-world[i])>1e-5),None);delta=world[child]-world[i]if child is not None else np.array([1.,0.,0.]);projected=delta[xy];l3=float(np.linalg.norm(delta));l2=float(np.linalg.norm(projected));entries.append({'xy':world[i,xy].tolist(),'depth':float(world[i,depth]),'angle':float(math.degrees(math.atan2(projected[1],projected[0]))),'foreshortening':max(.25,min(1,l2/max(l3,1e-6)))})
 frames.append({'rootDelta':(root-first).tolist(),'joints':entries})
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps({'source':a.bvh.name,'sha256':hashlib.sha256(a.bvh.read_bytes()).hexdigest(),'plane':a.plane,'fps':1/frame_time,'jointNames':[n['name']for n in nodes],'parents':[n['parent']for n in nodes],'frames':frames,'status':'PROJECTED_DRIVERS_NOT_AUTOMATIC_WEAPON_RETARGET'},separators=(',',':')));print('BVH_PROJECTED',len(frames),'frames',len(nodes),'joints')
