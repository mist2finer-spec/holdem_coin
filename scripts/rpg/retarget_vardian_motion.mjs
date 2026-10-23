/** Sample actual Spine 4.2 timelines (including original curves) onto cutout joints.
 * Rendering only: recovered combat-profile.json remains the single damage clock.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-canvas';
const source='public/rpg/Hero_Axe01.json';
const atlas=new TextureAtlas(fs.readFileSync('public/rpg/Hero_Axe01.atlas','utf8'));
for(const page of atlas.pages)page.setTexture(new CanvasTexture({width:page.width,height:page.height}));
const raw=JSON.parse(fs.readFileSync(source,'utf8'));
const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
const profile=JSON.parse(fs.readFileSync('src/components/rpg/combat-profile.json','utf8'));
const roles={center:'center',torso:'bone2',head:'head','front-upper-arm':'Rarm','front-forearm':'Rarm2','back-upper-arm':'Larm','back-forearm':'Larm2','front-thigh':'Rleg','front-shin':'Rleg2','front-foot':'Rleg3','back-thigh':'Lleg','back-shin':'Lleg2','back-foot':'Lleg3',hair:'head'};
const names=['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','skill1','skill2','skill3','skill4','skill5','skill5_loop','skill5_end','rest1','damage1','die1'];
const reference=new Skeleton(data);reference.updateWorldTransform(Physics.update);
const setup=Object.fromEntries(Object.values(roles).map(n=>[n,reference.findBone(n).arotation]));
const animations={};
for(const name of names){
 const original=data.findAnimation(name==='damage1'?'defeat1':name);if(!original)throw Error(`Missing original motion ${name}`);
 const stage=profile.combo.find(s=>s.animation===name),end=Math.max(original.duration,stage?.duration||0);
 const times=[...new Set([...Array.from({length:Math.ceil(original.duration*60)+1},(_,i)=>Math.min(i/60,original.duration)),end])].sort((a,b)=>a-b);
 const skeleton=new Skeleton(data),state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,original.name,false);
 const bones=Object.fromEntries(Object.keys(roles).map(role=>[role,{rotate:[],...(role==='center'?{translate:[]}: {})}]));
 let previous=0;
 for(const t of times){
  state.update(Math.min(t,original.duration)-previous);previous=Math.min(t,original.duration);state.apply(skeleton);skeleton.updateWorldTransform(Physics.update);
  for(const [role,native]of Object.entries(roles)){
   const b=skeleton.findBone(native);const value=(b.arotation-setup[native])*(role==='hair'?.12:1);
   bones[role].rotate.push({time:+t.toFixed(6),value:+value.toFixed(4)});
   if(role==='center')bones[role].translate.push({time:+t.toFixed(6),x:+((b.x-b.data.x)*2).toFixed(4),y:+((b.y-b.data.y)*2).toFixed(4)});
  }
 }
 animations[name]={bones,...(stage?{events:[{time:stage.hitAt,name:'contact',int:profile.combo.indexOf(stage)+1}]}:{})};
}
const out={source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sampleRate:60,roles,aliases:{damage1:'defeat1'},method:'Original runtime-evaluated post-IK applied-local rotation deltas; center translation x2; hair follows 0.12 of head rotation. Native clips held to the existing combat clock, never changing impact timing.',animations};
fs.writeFileSync('scripts/rpg/vardian-retarget.json',JSON.stringify(out)+'\n');
console.log('VARDIAN_MOTION_RETARGETED',names.length,'clips');
