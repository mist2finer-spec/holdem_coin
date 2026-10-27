/** Native Spine runtime evaluated world-motion -> compact Hong local timelines.
 * Build-only adapter; uses the installed official Spine runtime, never ships its code.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);function opt(k){const i=args.indexOf(k);if(i<0||!args[i+1])throw Error('Required '+k);return path.resolve(args[i+1]);}
const runtime=opt('--runtime'),native=opt('--native'),out=opt('--out');
const S=await import(pathToFileURL(path.join(runtime,'node_modules/@esotericsoftware/spine-canvas/dist/index.js')));
const {Skeleton,SkeletonJson,TextureAtlas,CanvasTexture,AtlasAttachmentLoader,AnimationState,AnimationStateData,Physics}=S;
function load(json,atlas){const a=new TextureAtlas(fs.readFileSync(atlas,'utf8'));for(const p of a.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height}));return new SkeletonJson(new AtlasAttachmentLoader(a)).readSkeletonData(JSON.parse(fs.readFileSync(json,'utf8')));}
const source=load(native,native.replace(/\.json$/,'.atlas'));const targetPath=path.join(out,'hong.json');const target=JSON.parse(fs.readFileSync(targetPath));const fps=60;
const baseNames=['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','defeat1','die1','victory1'];
const weapons=['sword','axe','dual','spear'];const names=[...baseNames,...weapons.flatMap(w=>baseNames.map(n=>w+'-'+n))];
const roles={pelvis:'center',torso:'bone2',head:'head','front-upper-arm':'Rarm','front-forearm':'Rarm2','back-upper-arm':'Larm','back-forearm':'Larm2','front-thigh':'Rleg','front-shin':'Rleg2','front-foot':'Rleg3','back-thigh':'Lleg','back-shin':'Lleg2','back-foot':'Lleg3'};
const gains={pelvis:.55,torso:.70,head:.75,'front-upper-arm':.75,'back-upper-arm':.75,'front-forearm':.80,'back-forearm':.80,'front-thigh':.65,'back-thigh':.65,'front-shin':.65,'back-shin':.65,'front-foot':.50,'back-foot':.50};
function sample(name,t){const sk=new Skeleton(source),state=new AnimationState(new AnimationStateData(source));state.setAnimation(0,name,false);state.update(t);state.apply(sk);sk.updateWorldTransform(Physics.update);return sk;}
const rest=sample('stay1',0),restRot=Object.fromEntries(Object.entries(roles).map(([role,n])=>[role,rest.findBone(n).getWorldRotationX()]));const rootRest=rest.findBone('center');
// A bent source drawing cannot accept straight-limb native deltas literally.
// Use native clip clocks/body accents, then solve compact limbs against authored endpoints.
const cfg=JSON.parse(fs.readFileSync(path.join(out,'parts-preparation.json'))).config;
const point=n=>{const p=cfg.parts.find(p=>p.name===n).pivot;return [p[0]*256,-p[1]*256]};
const atan=(y,x)=>Math.atan2(y,x)*180/Math.PI;
function ik(upper,lower,end,desired){
 const a=point(upper),b=point(lower),c=point(end),l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]);
 let dx=desired[0]-a[0],dy=desired[1]-a[1],originalDistance=Math.hypot(dx,dy);const d=Math.max(Math.abs(l1-l2)+.1,Math.min(l1+l2-.1,originalDistance));
 const destination=[a[0]+dx*d/Math.max(.001,originalDistance),a[1]+dy*d/Math.max(.001,originalDistance)];
 const alpha=Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d)))),base=Math.atan2(dy,dx);
 // Fixed source bend side avoids a 150-degree knee flip when foot targets cross.
 const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);const q=base+(cross>0?-alpha:alpha),elbow=[a[0]+l1*Math.cos(q),a[1]+l1*Math.sin(q)];
 return [q*180/Math.PI-atan(b[1]-a[1],b[0]-a[0]),atan(destination[1]-elbow[1],destination[0]-elbow[0])-atan(c[1]-b[1],c[0]-b[0])];
}
function compactPose(name,t,duration,nativeWorld,weapon='unarmed'){
 const phase=t/duration,w={root:0,pelvis:0,torso:0,head:0};
 // Native torso accent remains, but avoids importing the axe rig's deep crouch.
 w.torso=Math.max(-9,Math.min(9,nativeWorld.torso*.30));w.head=w.torso*.2;
 const ends={};for(const s of ['front','back']){ends[s+'-hand']=point(s+'-hand').slice();ends[s+'-foot']=point(s+'-foot').slice();}
 if(name==='run1'){
  const q=phase*Math.PI*2;
  for(const [s,offset]of [['front',0],['back',Math.PI]]){const wave=Math.sin(q+offset);ends[s+'-foot'][0]+=wave*12;ends[s+'-foot'][1]+=6+Math.max(0,Math.cos(q+offset))*10;ends[s+'-hand'][0]-=wave*7;ends[s+'-hand'][1]+=wave*4;}
  w.torso=-5;w.head=-1;
 }else if(name.startsWith('attack')){
  const n=Number(name.slice(-1)),hit=n===5?.30:.20;const attack=Math.max(0,1-Math.abs(t-hit)/(t<hit?hit*.8:(duration-hit)*.85));const ease=attack*attack*(3-2*attack);
  const side=weapon==='dual'||weapon==='unarmed'?(n%2?'front':'back'):'front';
  const original={1:[164,-100],2:[187,-94],3:[158,-119],4:[177,-70],5:[157,-69]};
  const paths={sword:{1:[162,-100],2:[160,-90],3:[156,-116],4:[158,-76],5:[157,-69]},axe:{1:[157,-91],2:[160,-108],3:[158,-112],4:[158,-76],5:[157,-69]},dual:original,spear:{1:[166,-101],2:[167,-97],3:[164,-104],4:[165,-91],5:[166,-100]}};
  const goal=(paths[weapon]||original)[n],p=ends[side+'-hand'];p[0]+=(goal[0]-p[0])*ease;p[1]+=(goal[1]-p[1])*ease;w.torso=-(weapon==='axe'?9:6)*ease;w.head=-2*ease;
  if(weapon==='spear'){const support=ends['back-hand'];support[0]+=(174-support[0])*ease;support[1]+=(-96-support[1])*ease;}

 }else if(name==='dash'){w.torso=-12;w.head=-4;ends['front-foot'][0]+=9;ends['back-foot'][0]-=7;}
 else if(name==='avoid1'){
  w.pelvis=-360*(phase*phase*(3-2*phase));w.torso=0;w.head=0;
  for(const s of ['front','back']){ends[s+'-foot'][1]+=Math.sin(Math.PI*phase)*14;ends[s+'-hand'][0]-=Math.sin(Math.PI*phase)*6;}
 }else if(name==='defeat1'){w.torso=Math.sin(phase*Math.PI)*10;w.head=w.torso*.4;}
 else if(name==='die1'){w.pelvis=80*Math.min(1,phase*2);w.torso=5;w.head=5;}
 else if(name==='victory1'){ends['front-hand'][0]+=6*Math.sin(Math.PI*phase);ends['front-hand'][1]+=22*Math.sin(Math.PI*phase);}
 for(const side of ['front','back']){
  const [arm,fore]=ik(side+'-upper-arm',side+'-forearm',side+'-hand',ends[side+'-hand']);w[side+'-upper-arm']=arm;w[side+'-forearm']=fore;
  const [thigh,shin]=ik(side+'-thigh',side+'-shin',side+'-foot',ends[side+'-foot']);w[side+'-thigh']=thigh;w[side+'-shin']=shin;w[side+'-foot']=0;
 }
 // Native source is right-facing; rotations about a zero-angle cutout keep its original bone vectors.
 const roll=w.pelvis;for(const k of Object.keys(w))if(k!=='root'&&k!=='pelvis')w[k]+=roll;
 return w;
}
const phaseOrZero=(t,d)=>d?t/d:0;
const wrap=v=>((v+180)%360+360)%360-180;const round=v=>+v.toFixed(4);const raw={},motionEvidence={};
for(const name of names){
 const weapon=weapons.find(w=>name.startsWith(w+'-'))||'unarmed',clip=weapon==='unarmed'?name:name.slice(weapon.length+1);
 const duration=source.findAnimation(clip).duration;const times=Array.from({length:Math.ceil(duration*fps)+1},(_,i)=>Math.min(i/fps,duration));const bones={};const previous={};
 for(const role of Object.keys(roles))bones[role]={rotate:[]};bones.pelvis.translate=[];
 // Secondary hair follows the torso through hierarchy, with small delayed counter-rotation.
 bones['hair-back']={rotate:[]};
 for(const t of times){const sk=sample(clip,t);const world={root:0};
  for(const [role,n]of Object.entries(roles)){
   let angle=wrap(sk.findBone(n).getWorldRotationX()-restRot[role]);
   if(previous[role]!==undefined)angle=previous[role]+wrap(angle-previous[role]);previous[role]=angle;
   world[role]=angle*gains[role];
  }
  const authored=compactPose(clip,t,duration,world,weapon);Object.assign(world,authored);
  for(const role of Object.keys(roles)){
   const parent=target.bones.find(b=>b.name===role).parent;const parentWorld=world[parent]||0;bones[role].rotate.push({time:round(t),value:round((bones[role].rotate.length?bones[role].rotate.at(-1).value:0)+wrap(world[role]-parentWorld-(bones[role].rotate.length?bones[role].rotate.at(-1).value:0)))});
  }
  for(const side of ['front','back']){
   const mount='weapon-'+side;bones[mount]??={rotate:[]};let angle=weapon==='spear'?-65:weapon==='axe'?-55:side==='back'?-20:-45;
   if(clip==='run1')angle+=(side==='front'?1:-1)*Math.sin(t/duration*Math.PI*2)*7;
   if(clip==='dash')angle=weapon==='spear'?-85:-35;
   if(clip.startsWith('attack')){
    const hit=clip==='attack5'?.30:.20;
    const q=t<hit?t/Math.max(.01,hit):1-Math.min(1,(t-hit)/Math.max(.01,duration-hit));
    const power=q*q*(3-2*q),strike=weapon==='spear'?-90:weapon==='axe'?-115:weapon==='dual'?(side==='front'?-100:95):-100;
    angle+=(strike-angle)*power;
   }
   // The wrist rotates independently so a rigid weapon always remains in its grip.
   const desired=world.pelvis+angle,fore=world[side+'-forearm'];
   const rows=bones[mount].rotate,prev=rows.length?rows.at(-1).value:0;
   rows.push({time:round(t),value:round(prev+wrap(desired-fore-prev))});
  }
  const b=sk.findBone('center');let x=(b.worldX-rootRest.worldX)*2.1,y=(b.worldY-rootRest.worldY)*2.1;
  // Root displacement belongs to game movement, not animation. Keep local anticipation only.
  x=Math.max(-12,Math.min(12,x));y=Math.max(-24,Math.min(16,y));
  if(clip==='avoid1')y=-18*Math.sin(Math.PI*t/duration);
  if(clip==='stay1')y=Math.sin(phaseOrZero(t,duration)*Math.PI*2)*1.2;
  if(clip.startsWith('attack')||clip==='run1'||clip==='dash')y=0;
  bones.pelvis.translate.push({time:round(t),x:round(x),y:round(y)});
  const hair=-Math.sin(t*Math.PI*2/(clip==='run1'?.5333:1.3333))*(clip==='run1'?5:2);bones['hair-back'].rotate.push({time:round(t),value:round(hair)});
 }
 raw[name]={bones};motionEvidence[name]={duration,frames:times.length,sourceClip:clip,weapon,footCorrection:true};
}
// Actual damage events are not present in the source animations. Keep adapter events distinct.
const eventTimes={attack1:.20,attack2:.20,attack3:.20,attack4:.20,attack5:.30};
for(const [name,t]of Object.entries(eventTimes))for(const prefix of ['',...weapons.map(w=>w+'-')])raw[prefix+name].events=[{time:t,name:'hit-window',int:Number(name.slice(-1))}];
target.events={'hit-window':{int:0}};target.animations={setup:{},...raw};
fs.writeFileSync(targetPath,JSON.stringify(target,null,2));
// Ground contact correction evaluated with the actual target skeleton and trimmed attachments.
let data=load(targetPath,path.join(out,'hong.atlas'));let base=new Skeleton(data);base.updateWorldTransform(Physics.update);
function footFloor(sk,all=false){let low=Infinity;for(const n of (all?sk.slots.filter(s=>s.getAttachment()).map(s=>s.data.name):['front-foot','back-foot'])){const slot=sk.findSlot(n),a=slot.getAttachment(),v=new Float32Array(8);a.computeWorldVertices(slot,v,0,2);for(let i=1;i<8;i+=2)low=Math.min(low,v[i]);}return low;}
const floor=footFloor(base);
for(const name of names){const clip=motionEvidence[name].sourceClip;const anim=data.findAnimation(name),samples=target.animations[name].bones.pelvis.translate;
 for(const row of samples){const sk=new Skeleton(data),st=new AnimationState(new AnimationStateData(data));st.setAnimation(0,name,false);st.update(row.time);st.apply(sk);sk.updateWorldTransform(Physics.update);const delta=floor-footFloor(sk,['avoid1','die1','defeat1'].includes(clip));
  // Feet contact the floor during grounded actions; dodge/death only prevent floor penetration.
  row.y=round(row.y+(['avoid1','die1','defeat1'].includes(clip)?Math.max(0,delta):delta));
 }
}
// Friendly aliases retain native names for integration with existing combat clocks.
for(const [alias,n]of Object.entries({idle:'stay1',run:'run1',rush:'dash',dodge:'avoid1',hit:'defeat1',death:'die1'}))target.animations[alias]=structuredClone(target.animations[n]);
fs.writeFileSync(targetPath,JSON.stringify(target,null,2));
data=load(targetPath,path.join(out,'hong.atlas'));
const preview={fps,ground:floor,clips:{},atlas:'hong.png',slots:[]};
for(const name of names){const frames=[],duration=data.findAnimation(name).duration;const sk=new Skeleton(data),state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,name,false);let prev=0;
 const steps=Math.ceil(duration*fps);
 for(let i=0;i<=steps;i++){const t=Math.min(i/fps,duration);state.update(t-prev);prev=t;state.apply(sk);sk.updateWorldTransform(Physics.update);
  const sprites=[];for(const slot of sk.drawOrder){const a=slot.getAttachment();if(!a)continue;const b=slot.bone,r=a.region;const row={name:slot.data.name,m:[b.a,b.c,b.b,b.d,b.worldX,b.worldY],x:a.x,y:a.y,width:a.width,height:a.height,u:r.x,v:r.y,sw:r.width,sh:r.height};if(!row.m.every(Number.isFinite))throw Error('Nonfinite bone '+row.name);sprites.push(row);}
  frames.push(sprites);
 }
 preview.clips[name]={duration,frames};
}
fs.writeFileSync(path.join(out,'preview-poses.json'),JSON.stringify(preview));
const report={format:'Spine 4.2 JSON + atlas; region attachments',status:'RETARGETED_PROTOTYPE_REQUIRES_SPINE_UNITY_VISUAL_QA',originalAnimationSha256:crypto.createHash('sha256').update(fs.readFileSync(native)).digest('hex'),sourceVideo:'1.mp4, 1080x2340, 30fps, 14.577667s; visually reviewed overview. Effects obscure pose; no frame-exact motion capture claimed.',sourceVideoSha256:args.includes('--video')?crypto.createHash('sha256').update(fs.readFileSync(opt('--video'))).digest('hex'):null,method:'Original runtime clip durations and restrained torso accents; authored compact-limb endpoint paths solved by analytical 2-bone IK at build time; baked to Spine local rotation keys at 60fps; evaluated foot contact correction. Not a literal full-body motion reconstruction.',roles,gains,rootMotion:false,animations:motionEvidence,hitEvents:{status:'WEB_ADAPTER_TIMES_NOT_NATIVE_ANIMATION_EVENTS',times:eventTimes},limitations:['Single-view cutout cannot reconstruct unseen artwork. Hidden surfaces/joint padding are explicit artistic approximations.','No mesh weights or IK; 2D region cutout hierarchy.','Forward-only facing: left-facing is mirrored.','Weapon-specific compact arm paths and wrist angle timelines are authored web adaptations, not recovered original weapon animations.','Spine Editor and spine-unity 4.2 import require user-side validation; no .spine editor project generated.','Compact arm/leg paths, dodge roll, secondary hair and torso damping are authored adaptations, not recovered original curves.']};
fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify(report,null,2));console.log('RETARGETED',names.length,'adapted motion clips;',Object.keys(target.animations).length,'including aliases/setup.');
