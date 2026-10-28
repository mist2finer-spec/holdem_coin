import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-canvas';
import {hongMotionName,hongMotionTime,hongVisualContact,HONG_BODY_SLOTS,HONG_FOOT_SLOTS} from '../../src/components/rpg/hong-combat-motion';
import {groundSkeleton,attachmentBottom} from '../../src/components/rpg/hunt-ground';
import {WEAPON_TYPES} from '../../src/components/rpg/hunt-weapons';
const root='public/rpg/characters/hong/spine/';
const raw=JSON.parse(fs.readFileSync(root+'hong.json','utf8'));
function rig(){const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:512,height:512} as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);}
function equip(sk:Skeleton,type:string){sk.setSkinByName(type);sk.setSlotsToSetupPose();sk.findSlot('weapon-front')!.setAttachment(type==='unarmed'?null:sk.getAttachmentByName('weapon-front','held-'+type));sk.findSlot('weapon-back')!.setAttachment(type==='dual'?sk.getAttachmentByName('weapon-back','held-dual'):null);}
test('all five Hong loadouts have complete, distinct motion families and hand-mounted weapons',()=>{
 const data=rig();assert.equal(data.bones.length,25);assert.ok(!data.slots.find(s=>s.name==='unassigned-source'));
 for(const type of WEAPON_TYPES){const sk=new Skeleton(data);equip(sk,type);
  assert.equal(!!sk.findSlot('weapon-front')!.getAttachment(),type!=='unarmed');assert.equal(!!sk.findSlot('weapon-back')!.getAttachment(),type==='dual');
  assert.equal(sk.findBone('weapon-front')!.parent!.parent!.data.name,'near-hand');assert.equal(sk.findBone('weapon-back')!.parent!.data.name,'far-hand');
  for(const action of ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','skill1','skill2','skill3','skill4','skill5','skill6','defeat1','die1','victory1'])assert.ok(data.findAnimation(hongMotionName(action,type)));
 }
 assert.equal(hongMotionName('damage1','axe'),'axe-defeat1');assert.equal(hongMotionName('skill3','spear'),'spear-skill3');
 assert.notDeepEqual(raw.animations['sword-attack1'].bones['near-forearm'],raw.animations['spear-attack1'].bones['near-forearm']);
});
test('server contact and end time match across every weapon tempo, including delayed snapshots',()=>{
 for(const duration of [.15,.33,.5,1.2])for(const hit of [0,duration*.2,duration*.8]){
  assert.equal(hongMotionTime(0,duration,hit,.3667,.2),hit===0?.2:0);
  assert.ok(Math.abs(hongMotionTime(hit,duration,hit,.3667,.2)-.2)<1e-8);
  assert.equal(hongMotionTime(duration,duration,hit,.3667,.2),.3667);
  assert.equal(hongMotionTime(duration+10,duration,hit,.3667,.2),.3667);
 }
 for(const n of [NaN,Infinity])assert.equal(hongMotionTime(n,1,.2,.36,.2),0);
});
test('every equipped clip stays finite, mirrors correctly and grounds the body independently of weapons',()=>{
 const data=rig();Skeleton.yDown=true;
 for(const type of WEAPON_TYPES)for(const action of ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','skill1','skill2','skill3','skill4','skill5','skill6','defeat1','die1'])for(const facing of [-1,1]){
  const sk=new Skeleton(data);equip(sk,type);const st=new AnimationState(new AnimationStateData(data));const entry=st.setAnimation(0,hongMotionName(action,type),false);
  for(let i=0;i<=20;i++){
   entry.trackTime=entry.animation!.duration*i/20;st.apply(sk);sk.x=180;sk.y=250;sk.scaleX=.465*facing;sk.scaleY=.465;sk.updateWorldTransform(Physics.update);
   assert.ok(sk.bones.every(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite)));
   const slots=/avoid|die|defeat/.test(action)?HONG_BODY_SLOTS:HONG_FOOT_SLOTS;groundSkeleton(sk,250,slots);assert.ok(Math.abs(attachmentBottom(sk,slots)!-250)<.001);
   const mount=sk.findBone('weapon-front')!,hand=mount.parent!;
   assert.ok(Math.abs(mount.worldX-(hand.a*mount.x+hand.b*mount.y+hand.worldX))<.001);
   assert.ok(Math.abs(mount.worldY-(hand.c*mount.x+hand.d*mount.y+hand.worldY))<.001);
  }
 }
});
test('weapon switches clear the previous off-hand and animation mixing progresses without extra damage events',()=>{
 const data=rig(),sk=new Skeleton(data),ad=new AnimationStateData(data);ad.defaultMix=.1;const st=new AnimationState(ad);
 equip(sk,'dual');st.setAnimation(0,'dual-run1',true);st.update(.1);st.apply(sk);
 equip(sk,'spear');const entry=st.setAnimation(0,'spear-attack1',false);st.update(.12);st.apply(sk);
 assert.ok(entry.mixTime>=.1);assert.equal(sk.findSlot('weapon-back')!.getAttachment(),null);assert.equal(sk.findSlot('weapon-front')!.getAttachment()!.name,'held-spear');
 equip(sk,'unarmed');assert.equal(sk.findSlot('weapon-front')!.getAttachment(),null);
});

test('jointed Hong uses independent parts, live leg IK, five distinct loadouts and exact server contact mapping',()=>{
 const data=rig();assert.equal(data.ikConstraints.length,3);
 assert.ok(fs.statSync(root+'hong.json').size<3_000_000,'Mobile payload regressed');
 for(const a of Object.values(raw.animations) as any[])for(const slot of Object.keys(a.slots??{}))assert.ok(['weapon-front','weapon-back','shield'].includes(slot),'Body pose swaps must not return');
 for(const type of WEAPON_TYPES)for(let i=1;i<=5;i++){
  const name=hongMotionName('attack'+i,type),clip=data.findAnimation(name)!;
  const contact=hongVisualContact(name);assert.ok(contact>0&&contact<clip.duration);
  assert.equal(hongMotionTime(.2,.6,.2,clip.duration,contact),contact);
 }
 assert.notDeepEqual(raw.animations['dual-attack1'].bones['near-upper-arm'],raw.animations['dual-attack2'].bones['near-upper-arm']);
 assert.notDeepEqual(raw.animations['sword-attack1'].bones['near-forearm'],raw.animations['sword-attack2'].bones['near-forearm']);
 assert.notDeepEqual(raw.animations.skill1.bones.torso,raw.animations.skill2.bones.torso);
});

test('spear support palm follows the shaft without disconnected joints, including movement and buffs',()=>{
 const data=rig();Skeleton.yDown=false;
 let samples=0,maxPalmGap=0;
 for(const a of data.animations.filter(a=>a.name.startsWith('spear-')))for(let i=0;i<=60;i++){
  const sk=new Skeleton(data);equip(sk,'spear');a.apply(sk,0,a.duration*i/60,false,[],1,MixBlend.replace,MixDirection.mixIn);sk.updateWorldTransform(Physics.pose);
  const w=sk.findBone('weapon-front')!,hand=sk.findBone('far-hand')!,p={x:7,y:0};hand.localToWorld(p);w.worldToLocal(p);
  // Local shaft is +Y. Palm slides 4..24px toward the butt while remaining on it.
  const gap=Math.hypot(p.x,Math.max(0,-24-p.y,p.y+4));maxPalmGap=Math.max(maxPalmGap,gap);assert.ok(gap<.12,`Shaft grip gap ${a.name}: ${gap}`);
  for(const side of ['near','far'])for(const [upper,lower,len] of [['upper-arm','forearm',15],['forearm','hand',17],['thigh','shin',16],['shin','foot',17]] as const){
   const u=sk.findBone(side+'-'+upper)!,v=sk.findBone(side+'-'+lower)!;
   assert.ok(Math.abs(Math.hypot(v.worldX-u.worldX,v.worldY-u.worldY)-len)<.001);
  }
  samples++;
 }
 assert.ok(samples>1000);assert.ok(maxPalmGap<.12);
});
