/** Evaluate user-provided Spine 4.2 reference with the matching 4.2 runtime.
 * Export numeric motion only: no source textures, attachments, meshes or effects. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as R from '@esotericsoftware/spine-canvas';
const source=process.argv[2],output=process.argv[3];
if(!source||!output)throw Error('Usage: node extract-eirika-motion.mjs <Eirika_01.json> <motion.json>');
const bytes=fs.readFileSync(source),raw=JSON.parse(bytes),version=raw.skeleton.spine;
if(!version?.startsWith('4.2.'))throw Error('Expected Spine 4.2 source');
raw.slots=[];raw.skins=[];
for(const a of Object.values(raw.animations))for(const k of ['slots','attachments','drawOrder'])delete a[k];
R.Skeleton.yDown=false;
const data=new R.SkeletonJson({}).readSkeletonData(raw),names=['bone','body01','head02','arm01','arm02','arm04','bone2','hand01','hand02','wep_sw017','waist01','foot01_01','foot01_02','foot02_01','foot02_02'];
const round=x=>+x.toFixed(4),wrap=x=>((x+180)%360+360)%360-180;
const out={source:{file:'Eirika_01.json',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),spine:version,evaluator:'@esotericsoftware/spine-canvas 4.2.120',fps:120,bones:names,notes:'Only evaluated world positions and axes are retained; source art/effects are not shipped.'},clips:{}};
for(const a of data.animations){
 const count=Math.ceil(a.duration*120),samples=[],previous={},times=new Set(Array.from({length:count+1},(_,i)=>a.duration*i/count));
 const collect=v=>{if(Array.isArray(v))for(const k of v){if(k&&typeof k==='object'&&'time'in k)times.add(k.time);collect(k);}else if(v&&typeof v==='object')for(const k of Object.values(v))collect(k);};collect(raw.animations[a.name]);
 for(const time of [...times].sort((a,b)=>a-b)){
  const s=new R.Skeleton(data);a.apply(s,0,time,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.updateWorldTransform(R.Physics.pose);
  const bones={};for(const name of names){const b=s.findBone(name),angle=Math.atan2(b.c,b.a)*180/Math.PI;const axis=previous[name]===undefined?angle:previous[name]+wrap(angle-previous[name]);previous[name]=axis;
   bones[name]={x:round(b.worldX),y:round(b.worldY),axis:round(axis)};
  }
  samples.push({time:round(time),bones});
 }
 out.clips[a.name]={duration:round(a.duration),events:raw.animations[a.name].events??[],samples};
}
fs.writeFileSync(output,JSON.stringify(out));console.log('EIRIKA_MOTION_EVALUATED',Object.keys(out.clips).join(', '));
