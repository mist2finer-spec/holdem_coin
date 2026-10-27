/** Authored 0.6s heavy-axe motion, Spine 4.2 absolute Bezier coordinates.
 * Independent implementation of generic animation principles; no Genielabs code imported.
 */
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);if(i<0)throw Error('Missing '+k);return path.resolve(args[i+1])};const root=arg('--rig'),project=arg('--project');
const {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,Physics}=await import(pathToFileURL(project+'/node_modules/@esotericsoftware/spine-canvas/dist/index.js'));
const raw=JSON.parse(fs.readFileSync(root+'/hong.json')),atlas=new TextureAtlas(fs.readFileSync(root+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:1024,height:512}));const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
const deg=r=>r*180/Math.PI,wrap=v=>((v+180)%360+360)%360-180,round=v=>+v.toFixed(5),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));const reference={reliableSegments:0,rejectedSegments:0,lift:25,used:false};
if(args.includes('--poses')){
 const poses=JSON.parse(fs.readFileSync(arg('--poses'))),ratios=[];
 for(const f of poses.frames)for(const side of ['left','right']){
  const arm=f.angles[side+'_upper_arm'],fore=f.angles[side+'_forearm'];
  if(!arm.accepted||!fore.accepted||f.meanCoreConfidence<.45){reference.rejectedSegments++;continue;}
  const k=f.keypoints,s=k[side+'_shoulder'],h=k[side+'_hip'],w=k[side+'_wrist'],len=Math.hypot(s.x-h.x,s.y-h.y);
  if(len>3){ratios.push((s.y-w.y)/len);reference.reliableSegments++;}
 }
 if(ratios.length){ratios.sort((a,b)=>a-b);reference.lift=clamp(20+ratios[Math.floor(ratios.length*.75)]*8,20,29);reference.used=true;}
}
const footRest=new Skeleton(data);footRest.updateWorldTransform(Physics.update);const feet=Object.fromEntries(['front','back'].map(s=>{const b=footRest.findBone(s+'-foot');return[s,[b.worldX,b.worldY]]}));
const handRest=Object.fromEntries(['front','back'].map(s=>{const b=footRest.findBone(s+'-hand');return[s,[b.worldX,b.worldY]]}));let clampedTargets=0;
function localAxis(parent,angle){const x=Math.cos(angle*Math.PI/180),y=Math.sin(angle*Math.PI/180),det=parent.a*parent.d-parent.b*parent.c;return deg(Math.atan2((-parent.c*x+parent.a*y)/det,(parent.d*x-parent.b*y)/det));}
function solve(sk,upperName,lowerName,endName,goal){
 const u=sk.findBone(upperName),lo=sk.findBone(lowerName),end=sk.findBone(endName),parent=u.parent;const p={x:goal[0],y:goal[1]};parent.worldToLocal(p);
 const dx=p.x-u.x,dy=p.y-u.y,l1=Math.hypot(lo.data.x,lo.data.y),l2=Math.hypot(end.data.x,end.data.y),distance=Math.hypot(dx,dy),d=clamp(distance,Math.abs(l1-l2)+.2,l1+l2-.2);if(Math.abs(d-distance)>.5)clampedTargets++;
 const gx=dx*d/Math.max(.001,distance),gy=dy*d/Math.max(.001,distance);const alpha=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
 const cross=lo.data.x*end.data.y-lo.data.y*end.data.x,theta=Math.atan2(dy,dx)+(cross>0?-alpha:alpha),ex=Math.cos(theta)*l1,ey=Math.sin(theta)*l1;
 u.rotation=deg(theta-Math.atan2(lo.data.y,lo.data.x));lo.rotation=deg(Math.atan2(gy-ey,gx-ex)-Math.atan2(end.data.y,end.data.x))-u.rotation;sk.updateWorldTransform(Physics.update);
}
const keys=[
 {t:0,w:0,i:0,recover:0,blade:45,hair:0,skirt:0},
 {t:.13,w:.78,i:0,recover:0,blade:90,hair:0,skirt:0},
 {t:.22,w:1,i:0,recover:0,blade:108,hair:-6,skirt:-2},
 {t:.25,w:1,i:0,recover:0,blade:110,hair:-12,skirt:-4},
 {t:.30,w:0,i:1,recover:0,blade:-70,hair:-18,skirt:-7},
 {t:.38,w:0,i:1,recover:0,blade:-70,hair:-18,skirt:-7},
 {t:.43,w:0,i:.88,recover:.8,blade:-80,hair:14,skirt:13},
 {t:.44,w:0,i:.80,recover:1,blade:-82,hair:22,skirt:11},
 {t:.52,w:0,i:.30,recover:.3,blade:-15,hair:-8,skirt:6},
 {t:.60,w:0,i:0,recover:0,blade:45,hair:0,skirt:0}
];const snapshots=[];
for(const k of keys){
 const sk=new Skeleton(data),hip=sk.findBone('pelvis'),chest=sk.findBone('torso'),head=sk.findBone('head');
 hip.x+=-15*k.w+45*k.i;hip.y+=8*k.w-25*k.i;hip.rotation=8*k.w-10*k.i;
 chest.rotation=25*k.w-35*k.i;chest.scaleX=1-.12*k.w+.15*k.i;chest.scaleY=1+.03*k.w-.06*k.i;chest.shearX=-12*k.w+15*k.i;
 head.rotation=-18*k.w+27*k.i;sk.findBone('front-shoulder').rotation=6*k.w-10*k.i;sk.findBone('back-shoulder').rotation=-5*k.w-13*k.i;
 sk.findBone('hair-back').rotation=k.hair;sk.findBone('skirt').rotation=k.skirt;sk.updateWorldTransform(Physics.update);
 for(const side of ['front','back']){
  const end=[feet[side][0]+(side==='front'?49:36)*k.i,feet[side][1]];
  solve(sk,side+'-thigh',side+'-shin',side+'-foot',end);const foot=sk.findBone(side+'-foot');foot.rotation=localAxis(foot.parent,0);sk.updateWorldTransform(Physics.update);
 }
 const h=sk.findBone('head'),headPoint=[h.worldX,h.worldY],hipPoint=[hip.worldX,hip.worldY];
 for(const side of ['front','back']){
  const rest=handRest[side],wind=[headPoint[0]-(side==='front'?15:7),headPoint[1]+reference.lift+(side==='back'?3:0)],strike=[hipPoint[0]+(side==='front'?53:45),hipPoint[1]+(side==='front'?13:18)];
  const goal=[rest[0]+(wind[0]-rest[0])*k.w+(strike[0]-rest[0])*k.i,rest[1]+(wind[1]-rest[1])*k.w+(strike[1]-rest[1])*k.i];
  solve(sk,side+'-upper-arm',side+'-forearm',side+'-hand',goal);
  const mount=sk.findBone('weapon-'+side);mount.rotation=localAxis(mount.parent,k.blade-90);sk.updateWorldTransform(Physics.update);
 }
 const rows={};for(const b of sk.bones)rows[b.data.name]={rotate:[b.rotation-b.data.rotation],translate:[b.x-b.data.x,b.y-b.data.y],scale:[b.scaleX/b.data.scaleX,b.scaleY/b.data.scaleY],shear:[b.shearX-b.data.shearX,b.shearY-b.data.shearY]};snapshots.push({t:k.t,rows});
}
// Explicit curve coordinates are absolute TIME/VALUE. 2-property timelines take 8 values.
function controls(t0,t1,a,b,shape){return [t0+(t1-t0)*shape[0],a+(b-a)*shape[1],t0+(t1-t0)*shape[2],a+(b-a)*shape[3]].map(round)}
const ease=[.18,.72,.38,1],snap=[.90,0,.995,.08],recovery=[.22,0,.55,1];
function timeline(name,kind){const props=kind==='rotate'?['value']:['x','y'],rows=snapshots.map(s=>{const row={time:s.t};props.forEach((p,i)=>row[p]=round(s.rows[name][kind][i]));return row;});
 // Keep rotation continuous, including the 180-degree axe sweep.
 if(kind==='rotate')for(let i=1;i<rows.length;i++)rows[i].value=round(rows[i-1].value+wrap(rows[i].value-rows[i-1].value));
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1];if(props.every(p=>a[p]===b[p])){a.curve='stepped';continue;}
  const shape=a.time===.25?snap:a.time>=.38?recovery:ease;a.curve=props.flatMap(p=>controls(a.time,b.time,a[p],b[p],shape));
 }
 return rows;
}
const animation={bones:{},slots:{},events:[{time:.30,name:'hit-window',int:1}]};
for(const b of raw.bones){animation.bones[b.name]={};for(const kind of ['rotate','translate','scale','shear'])animation.bones[b.name][kind]=timeline(b.name,kind);}
// Hold every rotation .30..38; shake is translation only, with zero endpoints.
for(const name of ['torso','weapon-front']){
 const rows=animation.bones[name].translate,at=rows.findIndex(x=>x.time===.30),base=rows[at],shake=[];
 for(let j=0;j<7;j++){const t=round(.31+j*.01),d=j===6?0:(j%2?-3:3);shake.push({time:t,x:round(base.x+d),y:round(base.y-d*.35),curve:'stepped'});}
 base.curve='stepped';rows.splice(at+1,0,...shake);
}
animation.slots['slash-fx']={attachment:[{time:0,name:null},{time:.25,name:'slash-1'},{time:.275,name:'slash-2'},{time:.30,name:'slash-3'},{time:.35,name:null}],alpha:[{time:0,value:0,curve:'stepped'},{time:.25,value:1,curve:controls(.25,.30,1,.80,ease)},{time:.30,value:.8,curve:controls(.30,.35,.8,0,recovery)},{time:.35,value:0,curve:'stepped'},{time:.60,value:0}]};
raw.animations['heavy-axe-slash']=animation;raw.animations['axe-attack1']=structuredClone(animation);fs.writeFileSync(root+'/hong.json',JSON.stringify(raw));
const report={duration:.60,contact:.30,phases:{windup:[0,.25],snap:[.25,.30],hold:[.30,.38],recovery:[.38,.60]},angleConvention:'User chest screen-clockwise signs converted to Spine Y-up: windup +25deg, impact -35deg. Blade standard world angle +110 to -70 (art points +Y, so mount local compensates -90).',rotationHold:true,shakeBones:['torso','weapon-front'],shakeTranslationAmplitude:3,secondaryDelaySeconds:{hair:.06,skirt:.05},secondary:'Delayed windup + 0.44s release overshoot; all rotations freeze in .30-.38.',referencePose:reference,clampedIKTargets:clampedTargets,curves:'Spine 4.2 absolute time/value control points; 4 numbers per scalar, 8 per vector. Stepped constant/hold segments.',nativeSlashSlot:true,noFullBodyBackViewInvented:true,productionChanged:false};fs.writeFileSync(path.dirname(root)+'/heavy-axe-report.json',JSON.stringify(report,null,2));console.log('HEAVY_AXE_BUILT',report);
