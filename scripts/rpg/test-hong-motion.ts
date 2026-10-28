import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-canvas';
import {hongMotionName,hongMotionTime,hongVisualContact,HONG_BODY_SLOTS,HONG_FOOT_SLOTS} from '../../src/components/rpg/hong-combat-motion';
import {groundSkeleton,attachmentBottom} from '../../src/components/rpg/hunt-ground';
import {WEAPON_TYPES} from '../../src/components/rpg/hunt-weapons';
const root='public/rpg/characters/hong/spine/';
const raw=JSON.parse(fs.readFileSync(root+'hong.json','utf8'));
function rig(){const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:512,height:512} as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);}
function equip(sk:Skeleton,type:string){sk.setSkinByName(type);sk.setSlotsToSetupPose();sk.findSlot('weapon-front')!.setAttachment(type==='unarmed'?null:sk.getAttachmentByName('weapon-front','held-'+type));sk.findSlot('weapon-back')!.setAttachment(type==='dual'?sk.getAttachmentByName('weapon-back','held-dual'):null);}
test('all five Hong loadouts have complete, distinct motion families and hand-mounted weapons',()=>{
 const data=rig();assert.equal(data.bones.length,26);assert.ok(!data.slots.find(s=>s.name==='unassigned-source'));
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

function snappyPose(name:string,t:number){
 const data=rig(),sk=new Skeleton(data),type=name.startsWith('sword-')?'sword':name.startsWith('axe-')?'axe':name.startsWith('dual-')?'dual':name.startsWith('spear-')?'spear':'unarmed';
 Skeleton.yDown=false;equip(sk,type);data.findAnimation(name)!.apply(sk,0,t,false,[],1,MixBlend.replace,MixDirection.mixIn);sk.updateWorldTransform(Physics.pose);return sk;
}
test('snappy attacks use native curves, exact 38% contact and a held impact without stalling the game clock',()=>{
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
 for(const [name,d] of Object.entries(manifest.animations) as [string,any][]){
  if(!d.action?.startsWith('attack')&&name!=='shield-bash')continue;
  assert.ok(Math.abs(d.contact/d.duration-.38)<.00001);
  const anim=raw.animations[name];for(const channels of Object.values(anim.bones) as any[])for(const keys of Object.values(channels) as any[])for(const k of keys.slice(0,-1))assert.ok(k.curve,'Linear attack interpolation: '+name);
  const a=snappyPose(name,d.contact+.00001),b=snappyPose(name,d.contact+Math.min(4/60,d.duration*.17)*.75);
  for(const n of ['pelvis','torso','near-hand','weapon-front']){
   const x=a.findBone(n)!,y=b.findBone(n)!;assert.ok(Math.hypot(x.worldX-y.worldX,x.worldY-y.worldY)<.03,'Impact is not held: '+name+' '+n);
  }
  assert.ok(!anim.bones['hair-back'],'Hair wobble returned');
 }
});
test('Hong anticipates backward, lunges with bending legs, breathes and bounces with hair locked',()=>{
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8')),d=manifest.animations['sword-attack1'];
 const wind=snappyPose('sword-attack1',d.duration*.30),hit=snappyPose('sword-attack1',d.contact);
 assert.ok(wind.findBone('pelvis')!.x<-3);assert.ok(hit.findBone('pelvis')!.x>=17.9);
 assert.ok(wind.findBone('torso')!.rotation>15&&hit.findBone('torso')!.rotation<-20);
 assert.ok(Math.abs(hit.findBone('pelvis')!.y-wind.findBone('pelvis')!.y)>=6);
 for(const name of ['stay1','walk','run1']){
  const duration=manifest.animations[name].duration,heights=[];
  for(let i=0;i<=40;i++){const s=snappyPose(name,duration*i/40);heights.push(s.findBone('pelvis')!.y);for(const side of ['near','far']){const f=s.findBone(side+'-foot')!,t=s.findBone(side+'-foot-target')!;assert.ok(Math.hypot(f.worldX-t.worldX,f.worldY-t.worldY)<.01,'Foot lost IK target');}}
  assert.ok(Math.max(...heights)-Math.min(...heights)>=(name==='stay1'?4.9:name==='walk'?7.9:11.9));
 }
 for(const anim of Object.values(raw.animations) as any[])assert.ok(!anim.bones['hair-back'],'Secondary hair animation must be disabled');
 const combos=JSON.parse(fs.readFileSync('archive/rpg/hong-authoring/eirika-v12-combos.json','utf8'));assert.equal(combos.animations['sword-combo'].events.length,4);
});


test('dynamic weapon attacks sweep over 160 degrees, freeze every joint and keep the face rigid',()=>{
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
 const angle=(s:Skeleton,n:string)=>{const b=s.findBone(n)!;return Math.atan2(b.c,b.a)*180/Math.PI;};
 for(const type of ['sword','dual','spear'])for(let stage=1;stage<=4;stage++){
  const name=type+'-attack'+stage,d=manifest.animations[name];
  const wind=snappyPose(name,d.contact-.04),hit=snappyPose(name,d.contact+.00001),hold=snappyPose(name,d.contact+.095);
  for(const bone of hit.bones){const other=hold.findBone(bone.data.name)!;
   assert.ok(Math.hypot(bone.worldX-other.worldX,bone.worldY-other.worldY)<.04,'Joint moved during freeze: '+name+' '+bone.data.name);
  }
  assert.ok(hit.findBone('torso')!.rotation<=-29);
  assert.ok(Math.abs(angle(hit,'head')+15)<.05);
  assert.equal(hit.findBone('head')!.scaleX,1);assert.equal(hit.findBone('head')!.scaleY,1);
  if(type!=='spear'){
   const side=type==='dual'&&stage%2===0?'weapon-back':'weapon-front';
   let previous=angle(wind,side),arc=0;
   for(let i=1;i<=20;i++){const current=angle(snappyPose(name,d.contact-.04+i*.04/20),side);arc+=((current-previous+540)%360)-180;previous=current;}
   assert.ok(Math.abs(arc)>=160,'Small swing arc: '+name+' '+arc);
  }
 }
 for(const type of ['sword','dual'])for(const action of ['walk','run1']){
  const s=snappyPose(type+'-'+action,.2);
  assert.ok(s.findBone('near-hand')!.worldX<s.findBone('pelvis')!.worldX,'Carried weapon must trail the hips');
 }
 // Contact remains on authoritative damage time, followed by a real-time 100ms pose hold.
 assert.equal(hongMotionTime(.2,.6,.2,.7,.266,true),.266);
 assert.ok(Math.abs(hongMotionTime(.3,.6,.2,.7,.266,true)-.366)<1e-8);
});


test('Eirika reference changes only sword visuals, retains authoritative events and a seamless guard loop',()=>{
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
 const reference=JSON.parse(fs.readFileSync('archive/rpg/hong-authoring/eirika/motion.json','utf8'));
 assert.equal(manifest.version,12);assert.equal(manifest.reference.spine,'4.2.11');
 assert.equal(manifest.reference.sha256,reference.source.sha256);assert.equal(manifest.reference.artworkCopied,false);
 assert.equal(manifest.reference.boneMap['near-upper-arm'],'arm01');assert.equal(manifest.reference.sourceAttacks,2);
 const other=Object.fromEntries(Object.entries(raw.animations).filter(([n])=>!n.startsWith('sword-')));
 assert.equal(createHash('sha256').update(JSON.stringify(other)).digest('hex'),'8516390330d6786fc58429ff8de913952fd131ea76a08915e0063c31e5fbc1ab','Another loadout changed');
 const idleStart=snappyPose('sword-stay1',0),idleEnd=snappyPose('sword-stay1',2),attackStart=snappyPose('sword-attack1',0);
 const delta=(a:number,b:number)=>((a-b+540)%360)-180;
 const angle=(s:Skeleton,n:string)=>{const b=s.findBone(n)!;return Math.atan2(b.c,b.a)*180/Math.PI;};
 for(const n of ['near-upper-arm','near-forearm','far-upper-arm','far-forearm','weapon-front']){
  assert.ok(Math.abs(delta(angle(idleStart,n),angle(idleEnd,n)))<.02,'Idle seam '+n);
  assert.ok(Math.abs(delta(angle(idleStart,n),angle(attackStart,n)))<.02,'Guard-to-attack seam '+n);
 }
 // A planted, sword-up guard derived from Eirika's actual evaluated first idle pose.
 assert.ok(Math.abs(delta(angle(idleStart,'near-upper-arm'),-119.21))<.1);
 assert.ok(Math.abs(delta(angle(idleStart,'near-forearm'),-138.28))<.15);
 for(let stage=1;stage<=5;stage++){
  const name='sword-attack'+stage;
  assert.match(manifest.animations[name].source,/Eirika/);
  assert.deepEqual(raw.animations[name].events.map((e:any)=>e.name),['hit-window']);
 }
 assert.match(manifest.animations['sword-skill1'].source,/Eirika aux/);
 assert.match(manifest.animations['sword-run1'].source,/Eirika move/);
});
