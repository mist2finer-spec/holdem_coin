"""Import projected world-angle deltas using a reviewed bone map; never guesses joint identities."""
import argparse,json,math,copy
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--motion',type=Path,required=True);p.add_argument('--rig',type=Path,required=True);p.add_argument('--map',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--foreshorten',action='store_true');a=p.parse_args();m=json.loads(a.motion.read_text());sk=json.loads(a.rig.read_text());mapping=json.loads(a.map.read_text());names=m['jointNames'];frames=m['frames'];fps=m['fps'];bones={b['name']:b for b in sk['bones']};world={};wrap=lambda x:(x+180)%360-180
for target,source in mapping.items():
 if target not in bones or source not in names:raise ValueError('Unresolved reviewed mapping: '+target+' -> '+source)
 j=names.index(source);start=frames[0]['joints'][j]['angle'];rows=[];prev=0
 for frame in frames:
  delta=wrap(frame['joints'][j]['angle']-start);prev=prev+wrap(delta-prev);rows.append(prev)
 world[target]=rows
anim={'bones':{}}
for target,source in mapping.items():
 parent=bones[target].get('parent');parent_values=world.get(parent,[0]*len(frames));r=[]
 for i,v in enumerate(world[target]):r.append({'time':round(i/fps,6),'value':round(v-parent_values[i],5)})
 for x,y in zip(r,r[1:]):
  dt=y['time']-x['time'];dv=y['value']-x['value'];x['curve']=[x['time']+dt*.25,x['value'],x['time']+dt*.75,y['value']]
 anim['bones'][target]={'rotate':r}
 if a.foreshorten:
  source_index=names.index(source);first=max(.25,frames[0]['joints'][source_index]['foreshortening']);child=next((b for b in sk['bones']if b.get('parent')==target),None)
  theta=math.atan2(child.get('y',0),child.get('x',1))if child else 0;co,si=math.cos(theta),math.sin(theta);scales=[];shears=[]
  for i,frame in enumerate(frames):
   ratio=max(.35,min(1.25,frame['joints'][source_index]['foreshortening']/first));aa=ratio*co*co+si*si;bb=(ratio-1)*co*si;dd=ratio*si*si+co*co;rotation=math.degrees(math.atan2(bb,aa));sx=math.hypot(aa,bb);sy=math.hypot(bb,dd);shear_y=math.degrees(math.atan2(dd,bb))-rotation-90
   r[i]['value']+=rotation;scales.append({'time':round(i/fps,6),'x':sx,'y':sy});shears.append({'time':round(i/fps,6),'x':0,'y':shear_y})
  for rows in [r,scales,shears]:
   props=['value']if rows is r else ['x','y']
   for x,y in zip(rows,rows[1:]):
    dt=y['time']-x['time'];x['curve']=[v for prop in props for v in [x['time']+dt*.25,x[prop],x['time']+dt*.75,y[prop]]]
  anim['bones'][target].update(scale=scales,shear=shears)
sk['animations']['imported-bvh-motion']=anim;a.out.write_text(json.dumps(sk,separators=(',',':')));print('IMPORTED_BVH',len(mapping),'reviewed bone mappings')
