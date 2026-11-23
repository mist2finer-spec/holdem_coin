import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine,KIT_BOSS_SCALE,KIT_BOSS_HEIGHT,KIT_BOSS_LEASH} from '../../src/lib/rpg-unity-boss-engine';
import {BOSS_CONTACT,hookContact,sampleArm,worldPoint} from '../../src/lib/rpg-boss-contact';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI,iaiContact} from '../../src/lib/rpg-hero-kit-iai';
import zoneTenArena from '../../src/lib/generated/zone-ten-arena.json';
import '../../src/lib/training-client-kernel';
// Zone-10 boss with the kit hero (maintenance/boss-kit-hero-20261121, PLAN_KO.md). The boss engine takes the hero kit
// (heroKit/kitTempo) from MountSundayEngine; boot `bossHero:'legacy'` keeps the pre-kit boss fight (the engine's own hero).
// Without a kit the boss engine must not change by a single tick (goldens below).
const G=globalThis as any;
const near=(a:number,b:number,tol=1e-6,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} != ${b} (±${tol})`);
const PRACTICE=['icespear','icenova','frostshot','stormcall','arc','spark'],SUPPORTS=[0,0,0,0,2,4];
const KIT0={...PINK_IAI,switches:{...PINK_IAI.switches,tempo:0}};

// --- no-kit goldens ------------------------------------------------------------------------------------------------------
// Recorded 2026-11-21 with maintenance/boss-kit-hero-20261121/work/boss_golden.mts (these two functions verbatim) on a
// `git archive 1b5675f0 src` copy (work/head) and on the changed tree: both printed the values below. Not to be edited to make
// a run pass; a mismatch means the boss engine without a kit changed.
function bossDigest(withArena:boolean){
 const g:any=withArena?new UnityBossEngine(111,{slimeCount:0,bossHP:2000,playerHP:100000},zoneTenArena):new UnityBossEngine(111);
 g.traversal=p;if(withArena)g.enterArena(true);for(let i=0;i<6;i++){g.skillEnabled[i]=true;g.skillIds[i]=PRACTICE[i];g.skillSupportCounts[i]=SUPPORTS[i];}g.autoSkills=true;
 const h=createHash('sha256');
 for(let t=0;t<6000&&g.status==='playing';t++){
  const input={x:t%500<120?1:t%500<200?-.5:0,y:t%700<150?.6:0,auto:t>=900};
  if(t%37===5)g.command({...input,attack:true});if(t%211===100)g.command({...input,dodge:true});if(t%313===200)g.command({...input,jump:true});
  if(t%401===300)g.command({...input,skill:t%6});if(t%503===50)g.command({...input,slide:true});
  g.step(.02,input);if(t%10===0)h.update(JSON.stringify(g.view()));
 }
 return {digest:h.digest('hex'),status:g.status,elapsed:+g.elapsed.toFixed(2),bossHP:g.boss.hp};
}
// setup(g) runs after the engine is built (used below to give the kit + legacy switch; nothing for the golden itself).
function mountBossDigest(setup:(g:any)=>void=()=>{}){
 const g:any=new MountSundayEngine(111,p,9);setup(g);for(let i=0;i<6;i++){g.skillEnabled[i]=true;g.skillIds[i]=PRACTICE[i];g.skillSupportCounts[i]=SUPPORTS[i];}g.autoSkills=true;
 const h=createHash('sha256');
 for(let t=0;t<6000&&g.status==='playing';t++){
  const input={x:t%500<120?1:0,y:t%700<150?.6:0,auto:t>=900,readyZone:9,readyBoss:true};g.acceptClientHints(input);
  if(t%37===5)g.command({...input,attack:true});if(t%229===90)g.command({...input,dodge:true});if(t%401===300)g.command({...input,skill:t%6});
  g.step(.02,input);if(t%10===0)h.update(JSON.stringify(g.view()));
 }
 return {digest:h.digest('hex'),status:g.status,phase:g.phase};
}
// Brief 3 boulder confine (2026-11-22): a knockback now ends where its straight path meets the walking wall (knockbackTo), instead of
// keeping an unreachable motion.to past the boulders. The arena run's one knockback (tick 1427, motion.to radius 1047 cm > wall 1030)
// changes, so arena 058575e5 -> 156ae8bb; the two rooms (no arena) and mount zone 10 (its knockback ends inside) are unchanged.
// Recorded with maintenance/boss-beam-camera-20261122/v3/work/golden3.mts on a `git archive 1cc4e683 src` copy and the changed tree.
// Instant evade (2026-11-23, maintenance/evade-skillbar-20261123/tools/golden.mts, bossDigest/mountBossDigest verbatim; dacb07ee copy prints the old values, the changed copy
// and the tree the new ones): arena 156ae8bb -> 47fb4c53 (first difference tick 200, a jump during an attack), two rooms 514a468f ->
// d20ca93b (tick 50, slide), mount zone 10 89ae8859 -> 27c2570c (tick 548, roll; the legacy run is the same run and prints the same).
const GOLDEN={arena:'47fb4c53954aa497076dd553cfe4550209efccc5c89fe8016047e5eabb04fd7b',rooms:'d20ca93bd3f5a227f3711c4eb7fd811c12c1199e3f854d6e0eebb2a6dc5d09fe',mount9:'27c2570c2dd80f966309f2f79161fbe277821bc66bc83cb8d4423613e90b2ac4'};
test('1. no kit: the boss engine is tick-for-tick the 1b5675f0 engine (arena, two rooms, mount zone 10)',()=>{
 const a=bossDigest(true),r=bossDigest(false),m=mountBossDigest();
 assert.equal(a.digest,GOLDEN.arena,'arena');assert.equal(r.digest,GOLDEN.rooms,'two rooms');assert.equal(m.digest,GOLDEN.mount9,'mount zone 10');
 assert.equal('heroKit' in new UnityBossEngine(111).view(),false);
});
test('2. bossHero legacy: kit + legacy switch is the pre-kit zone-10 boss fight tick for tick (kept for event maps)',()=>{
 const m=mountBossDigest(g=>{g.heroKit=PINK_IAI;g.bossHeroLegacy=true;g.syncBoss();});
 assert.equal(m.digest,GOLDEN.mount9);assert.equal(m.status,'won');
});

// --- kit contact turned to a ground direction ------------------------------------------------------------------------------
test('3. iaiContact: dir (+-1, 0) gives the lane result exactly (every row, both facings, a grid of targets)',()=>{
 let hits=0,n=0;
 for(const row of Object.values(PINK_IAI.rows))for(const facing of [1,-1])for(let dx=-200;dx<=200;dx+=10)for(let dy=-160;dy<=160;dy+=10)for(let i=0;i<=8;i++){
  const u=i/8,hero={x:0,y:0,facing,elevation:0,airHeight:0},target={x:dx,y:dy,elevation:0,radius:20};
  const lane=iaiContact(row.contact,u,hero,target),turned=iaiContact(row.contact,u,{...hero,dir:{x:facing,y:0}},target);
  assert.deepEqual(turned,lane,`dx ${dx} dy ${dy} u ${u} facing ${facing}`);n++;if(lane)hits++;
 }
 assert.ok(hits>100&&hits<n,'the grid has hits and misses');
});
test('4. iaiContact: a direction turns the same fan (a target straight ahead along dir is cut like one ahead on the lane)',()=>{
 const row=PINK_IAI.rows.iai1,hero={x:0,y:0,facing:1,elevation:0,airHeight:0},body={elevation:0,radius:20};
 for(const deg of [0,37,90,145,200,270,333]){const a=deg*Math.PI/180,dir={x:Math.cos(a),y:Math.sin(a)};
  for(const dist of [60,110,150]){let lane=false,turned=false;for(let i=0;i<=16;i++){const u=i/16;
   lane||=!!iaiContact(row.contact,u,hero,{...body,x:dist,y:0});turned||=!!iaiContact(row.contact,u,{...hero,dir},{...body,x:dir.x*dist,y:dir.y*dist});}
   assert.equal(turned,lane,`deg ${deg} dist ${dist}`);}
 }
});

// --- the boss arena with the kit -------------------------------------------------------------------------------------------
function arena(kit:any=KIT0){const b:any=new UnityBossEngine(111,{slimeCount:0,bossHP:2000,playerHP:100000},zoneTenArena);b.traversal=p;b.enterArena(false);b.heroKit=kit;
 b.bossIdleUntil=b.bossChaseUntil=b.bossAt=1e9;return b;}// boss AI parked (idle) so the hero tests are about the hero
const KIT_BODY=BOSS_CONTACT.bodyRadius*KIT_BOSS_SCALE+BOSS_CONTACT.heroRadius;
function place(b:any,x:number,y:number){b.hero.x=x;b.hero.y=y;b.hero.elevation=b.groundAt(x,y);}
function collect(b:any,seen:Set<number>,out:any[]){for(const f of b.fx)if(f.kind==='damage'&&!seen.has(f.id)){seen.add(f.id);out.push(f);}}
test('5. arena, kit: pressing chains iai1 -> iai2 -> iai3 on the boss with the kit damage 60/60/105, then the recover',()=>{
 const b=arena();place(b,b.boss.x-(KIT_BODY+38),b.boss.y);const hp=b.boss.hp,seen=new Set<number>(),hits:any[]=[],rows:string[]=[];
 for(let t=0;t<200;t++){const input={x:0,y:0,auto:false};b.command({...input,attack:true,x:1});b.step(.02,input);collect(b,seen,hits);const a=b.hero.action;if(rows.at(-1)!==a)rows.push(a);if(a==='iai_recover')break;}
 assert.deepEqual(rows.filter(r=>r.startsWith('iai')),['iai1','iai2','iai3','iai_recover']);
 assert.deepEqual(hits.map(h=>[h.definitionId,h.value,h.target]),[['pink-iai-iai1',60,'boss'],['pink-iai-iai2',60,'boss'],['pink-iai-iai3',105,'boss']]);
 assert.equal(hp-b.boss.hp,225);assert.equal(b.view().heroKit,'pink-iai');
 assert.ok(Math.hypot(b.hero.x-b.boss.x,b.hero.y-b.boss.y)>=KIT_BODY-1e-6,'the advance stops at the (kit-scaled) boss body');
});
test('6. arena, planar: a press toward a boss standing in depth turns the row to it and cuts it (the lane fan would miss)',()=>{
 for(const sy of [1,-1]){
  const b=arena();place(b,b.boss.x,b.boss.y+sy*(KIT_BODY+158));const seen=new Set<number>(),hits:any[]=[];
  b.command({x:0,y:-sy,auto:false,attack:true});const m=b.hero.motion;assert.equal(m.row,'iai1');near(m.dir.x,0,1e-9);near(m.dir.y,-sy,1e-9);
  // the same hero with the lane formula (facing only) never reaches a body straight up/down the depth axis
  const row=PINK_IAI.rows.iai1;let lane=false;for(let i=0;i<=16;i++)lane||=!!iaiContact(row.contact,i/16,{...b.hero,facing:1,dir:undefined,y:b.hero.y-sy*47.17},b.boss);
  assert.equal(lane,false,'lane fan misses the depth target');
  for(let t=0;t<60;t++){b.step(.02,{x:0,y:0,auto:false});collect(b,seen,hits);}
  assert.equal(hits.length,1,'iai1 cut the boss in depth');assert.equal(hits[0].definitionId,'pink-iai-iai1');
  assert.ok(Math.abs(b.hero.x-b.boss.x)<1e-6,'the advance ran along the depth direction only');
 }
});
test('7. arena, kit skill: the kit timing (58/60 s, contact 28/60 s), action skill2, kit key, the skill damages the boss',()=>{
 const b=arena();place(b,b.boss.x-260,b.boss.y);b.skillEnabled[3]=true;b.skillIds[3]='stormcall';const hp=b.boss.hp;
 assert.equal(b.command({x:0,y:0,auto:false,skill:3}),true);const m=b.hero.motion;
 assert.equal(m.kind,'skill');assert.equal(m.kit,'pink-iai');assert.equal(b.hero.action,'skill2');near(m.duration,58/60);near(m.hitAt,28/60);
 for(let t=0;t<80;t++)b.step(.02,{x:0,y:0,auto:false});assert.ok(b.boss.hp<hp,'storm-call hit the boss');
});
test('8. arena: dodge cuts the kit recover (kit cancel) and becomes the engine dodge',()=>{
 const b=arena();place(b,b.boss.x-200,b.boss.y);b.command({x:1,y:0,auto:false,attack:true});
 for(let t=0;t<3;t++)b.step(.02,{x:0,y:0,auto:false});
 let t=0;while(b.hero.action!=='iai_recover'&&t++<200)b.step(.02,{x:0,y:0,auto:false});
 assert.equal(b.hero.action,'iai_recover');assert.equal(b.command({x:-1,y:0,auto:false,dodge:true}),true,'dodge from the recover');
 for(let i=0;i<4;i++)b.step(.02,{x:0,y:0,auto:false});assert.equal(b.hero.motion?.kind,'dodge');
});

// --- the zone-10 boss through MountSundayEngine ----------------------------------------------------------------------------
function zone10(setup:(g:any)=>void){const g:any=new MountSundayEngine(111,p,9);setup(g);g.syncBoss();for(let i=0;i<6;i++){g.skillIds[i]=PRACTICE[i];g.skillSupportCounts[i]=SUPPORTS[i];}return g;}
test('9. zone 10, kit, AUTO (no skills): the kit hero walks in and defeats the boss with 1-2-3 only; the boss still hits it; the view carries heroKit',()=>{
 const g=zone10(x=>{x.heroKit=PINK_IAI;});const seen=new Set<number>(),hits:any[]=[];
 for(let t=0;t<20000&&g.status==='playing';t++){const input={x:0,y:0,auto:true,readyZone:9,readyBoss:true};g.acceptClientHints(input);g.step(.02,input);collect(g.bossEncounter,seen,hits);}
 assert.equal(g.status,'won');assert.equal(g.view().heroKit,'pink-iai');assert.equal(g.bossEncounter.heroKit,PINK_IAI);
 const defs=new Set(hits.filter(h=>h.target==='boss').map(h=>h.definitionId));assert.deepEqual([...defs].sort(),['pink-iai-iai1','pink-iai-iai2','pink-iai-iai3']);
 assert.equal(hits.filter(h=>h.target==='boss').reduce((s,h)=>s+h.value,0)>=2000,true);
 assert.ok(hits.some(h=>h.target==='hero'),'the boss attacks reach the kit hero');
});
test('10. zone 10: the tempo command reaches the boss motion (stage 0 = no clipMap, default stage 1 = clipMap)',()=>{
 const g=zone10(x=>{x.heroKit=PINK_IAI;});const b=g.bossEncounter;g.acceptClientHints({readyBoss:true});
 for(let t=0;t<200&&b.introStage!=='none';t++)g.step(.02,{x:0,y:0,auto:false});
 assert.equal(g.command({x:1,y:0,auto:false,attack:true}),true);assert.ok(b.hero.motion.clipMap,'default stage 1 maps the clip');
 for(let t=0;t<150&&b.hero.motion;t++)g.step(.02,{x:0,y:0,auto:false});
 assert.equal(g.command({kitTempo:0} as any),true);g.step(.02,{x:0,y:0,auto:false});assert.equal(b.kitTempo,0);
 assert.equal(g.command({x:1,y:0,auto:false,attack:true}),true);assert.equal(b.hero.motion.row,'iai1');assert.equal(b.hero.motion.clipMap,undefined,'stage 0: the trial clock');
});
test('11. boot: heroKit reaches the zone-10 boss in the first snapshot; bossHero:"legacy" keeps it out; the boss mode takes it too',()=>{
 const skills=PRACTICE.map(a=>({activeId:a,enabled:true,supportIds:[]}));const base={seed:111,traversalProfile:'source-run-v2',heroKit:'pink-iai',build:{skills},autoSkills:true};
 let v=JSON.parse(G.stageInitialize(JSON.stringify({...base,mode:'mount',referencePreview:true,previewZone:9})));assert.equal(v.heroKit,'pink-iai');assert.equal(v.routeStage,'boss');
 v=JSON.parse(G.stageInitialize(JSON.stringify({...base,mode:'mount',referencePreview:true,previewZone:9,bossHero:'legacy'})));assert.equal('heroKit' in v,false);assert.equal(v.routeStage,'boss');
 v=JSON.parse(G.stageInitialize(JSON.stringify({...base,mode:'mount',referencePreview:true,previewZone:3,bossHero:'legacy'})));assert.equal(v.heroKit,'pink-iai','legacy touches only the boss');
 v=JSON.parse(G.stageInitialize(JSON.stringify({...base,mode:'boss',referencePreview:true,previewArena:true})));assert.equal(v.heroKit,'pink-iai');
 v=JSON.parse(G.stageInitialize(JSON.stringify({...base,mode:'boss',referencePreview:true,previewArena:true,bossHero:'legacy'})));assert.equal('heroKit' in v,false);
});

// Boss hitbox at the kit display size (brief 3): one factor = 3.2 m / 6.5 m for body, hook arms and spacing; legacy stays 1.
test('12. kit boss hitbox: one scale (3.2 m / 6.5 m) for the body, the hook arms and the boss view; legacy and no kit stay 1',()=>{
 near(KIT_BOSS_SCALE,320/650,1e-12);assert.equal(KIT_BOSS_HEIGHT,320);
 const kit=arena();kit.step(.02,{x:0,y:0,auto:false});near(kit.bossScale,KIT_BOSS_SCALE,1e-12);near(kit.boss.radius,140*KIT_BOSS_SCALE,1e-9);
 const v=kit.view();near(v.bossScale,KIT_BOSS_SCALE,1e-12);near(v.bodyRadius,140*KIT_BOSS_SCALE,1e-9);
 const plain=arena(undefined);plain.heroKit=undefined;plain.step(.02,{x:0,y:0,auto:false});assert.equal(plain.bossScale,1);assert.equal(plain.boss.radius,140);
 const pv=plain.view();assert.equal(pv.bossScale,undefined,'no kit: no bossScale key (goldens unchanged)');assert.equal(pv.bodyRadius,140);
 const g:any=zone10(g=>{g.heroKit=PINK_IAI;g.bossHeroLegacy=true;});g.acceptClientHints({x:0,y:0,auto:true,readyZone:9,readyBoss:true});
 for(let t=0;t<400&&!g.bossEncounter;t++)g.step(.02,{x:0,y:0,auto:true,readyZone:9,readyBoss:true});
 if(g.bossEncounter){assert.equal(g.bossEncounter.bossScale,1,'legacy option keeps the 6.5 m hitbox');}
});
test('13. kit boss hook: the hand the kernel tests is the profile hand x scale; a hero standing at it is hit at the kit scale, not at the 6.5 m scale',()=>{
 const boss={x:3000,y:5000,elevation:0,direction:{x:0,y:1}},s=KIT_BOSS_SCALE;let checked=0;
 for(const w of BOSS_CONTACT.windows)for(let i=0;i<=8;i++){const phase=w.from+(w.to-w.from)*i/8;
  const shape=sampleArm(phase,w.hand),full=worldPoint(shape.hand,boss),scaled=worldPoint({x:shape.hand.x*s,y:shape.hand.y*s,z:shape.hand.z*s},boss);
  near(scaled.x-boss.x,(full.x-boss.x)*s,1e-9);near(scaled.y,full.y*s,1e-9);near(scaled.z-boss.y,(full.z-boss.y)*s,1e-9);
  if(scaled.y>BOSS_CONTACT.heroHeight)continue;
  const at={x:scaled.x,y:scaled.z,elevation:0,airHeight:0,action:'stay1'};
  assert.equal(hookContact(phase,w.hand,boss,at,s)?.part,'hand',`phase ${phase} hand ${w.hand}: the 3.2 m fist hits a hero standing at it`);
  assert.equal(hookContact(phase,w.hand,boss,at),null,`phase ${phase}: the 6.5 m arm passes over that hero`);
  const side=BOSS_CONTACT.heroRadius+BOSS_CONTACT.handRadii[w.hand]*s+3,dx=scaled.x-boss.x,dz=scaled.z-boss.y,dl=Math.hypot(dx,dz)||1;
  assert.notEqual(hookContact(phase,w.hand,boss,{...at,x:scaled.x+dx/dl*side,y:scaled.z+dz/dl*side},s)?.part,'hand',`phase ${phase}: 3 cm past the scaled fist radius is not a fist hit`);checked++;}
 assert.ok(checked>=8,'enough low-hand samples in the two active windows');
});
test('14. kit boss fight: the scaled hook reaches the 1.2 m kit hero (the 6.5 m hook passes over it); legacy keeps 0 hook hits',()=>{
 const run=(legacy:boolean)=>{const g:any=zone10(g=>{g.heroKit=PINK_IAI;if(legacy)g.bossHeroLegacy=true;});g.autoSkills=false;const seen=new Set<number>();let hooks=0,minD=1e9;
  for(let t=0;t<30000&&g.status==='playing';t++){const input={x:0,y:0,auto:true,readyZone:9,readyBoss:true};g.acceptClientHints(input);g.step(.02,input);const b=g.bossEncounter;if(!b)continue;
   if(b.room===1&&b.boss.hp>0)minD=Math.min(minD,Math.hypot(b.hero.x-b.boss.x,b.hero.y-b.boss.y));
   for(const f of b.fx)if(!seen.has(f.id)){seen.add(f.id);if(f.kind==='damage'&&f.target==='hero'&&f.damageKind==='hook')hooks++;}}
  return {hooks,minD,won:g.status==='won'||g.phase==='complete'||!!g.bossEncounter?.bossDefeated};};
 const kit=run(false),old=run(true);
 assert.ok(kit.hooks>0,'kit: boss hooks land');assert.ok(kit.minD<162&&kit.minD>=BOSS_CONTACT.bodyRadius*KIT_BOSS_SCALE+BOSS_CONTACT.heroRadius-1e-6,`kit: the hero stands at the smaller body (${kit.minD})`);assert.ok(kit.won);
 assert.equal(old.hooks,0,'legacy: unchanged (no hook hits in this run)');
});
test('15. kit boss spacing: the boss keeps walking in until 190 cm x scale (it would stop at 190 cm at the 6.5 m size)',()=>{
 const b=arena();b.step(.02,{x:0,y:0,auto:false});const d=150;place(b,b.boss.x-d,b.boss.y);b.boss.motion=null;b.bossIdleUntil=0;b.bossChaseUntil=b.elapsed+5;b.bossAt=b.elapsed+5;
 assert.ok(d>190*KIT_BOSS_SCALE&&d<190);b.step(.02,{x:0,y:0,auto:false});assert.equal(b.boss.action,'walk','still closing in at 150 cm');
 const old=arena(undefined);old.heroKit=undefined;old.step(.02,{x:0,y:0,auto:false});place(old,old.boss.x-d,old.boss.y);old.boss.motion=null;old.bossIdleUntil=0;old.bossChaseUntil=old.elapsed+5;old.bossAt=old.elapsed+5;
 old.step(.02,{x:0,y:0,auto:false});assert.notEqual(old.boss.action,'walk','6.5 m boss: already close enough at 150 cm');
});
// Kit boss golden (brief 3, after the hitbox scale): 78d6c762 at bb9c61e8 (6.5 m hitbox) -> a277f884 with the 3.2 m hitbox.
// Boss beams (2026-11-22, boss-beam-camera-20261122): the kit cycle hook/throw/beam + the beams view key -> cec86c9c. Recorded with
// maintenance/boss-beam-camera-20261122/work/kitgolden.mts (mountBossDigest verbatim): a `git archive a7fabb2c src` copy prints a277f884,
// the changed tree prints cec86c9c (legacy and no kit stay 89ae8859 = GOLDEN.mount9 on both).
// Boulder confine (brief 3, v3/work/golden3.mts): from the 2nd knockback on (tick 1930, motion.to radius 1087 cm > wall) -> c26218e7.
// Boss leash (brief 4, same script): the kit boss stops at 400 cm from the arena centre (it walked out to ~680 cm here) -> 72e55465.
// arena / two rooms / mount zone 10 / legacy keep their digests (no kit, or legacy: no leash).
// Instant evade (2026-11-23, same script): 72e55465 -> 7e175909 (first difference tick 1006, a roll during iai2).
// Beam damage while touching (2026-11-23, boss-beam-dot-20261123/tools/golden.mts, mountBossDigest verbatim; a `git archive 46096afb src`
// copy prints 7e175909, that copy + the two changed files and the tree print 8363dc71): first difference tick 745 = the first beam
// hit (old: 7 hits x 20,000 + knockback; new: 31 ticks x 2,000, no knockback). Every other golden is unchanged (no beams there).
test('16. kit zone-10 boss golden (3.2 m hitbox, rune beams)',()=>{
 const r=mountBossDigest(g=>{g.heroKit=PINK_IAI;});assert.equal(r.status,'won');assert.equal(r.digest,'8363dc7138f043b2e59825df5dfb189467c1bb8650ba8378d73a1f1312c0ec52');
});
// Brief 4 (2026-11-22, user: "make the boss's movement range smaller"; boss-beam-camera-20261122/v4): the kit boss walks only inside a
// small circle around the arena centre (KIT_BOSS_LEASH). A hero beyond it: the boss stops at the edge and waits facing the hero; the
// throw (warning disc on the hero) and the beam still come, the hook only when the hero is within reach. Legacy / no kit: unchanged.
const AC=zoneTenArena.center,fromCentre=(o:{x:number;y:number})=>Math.hypot(o.x-AC.x,o.y-AC.y);
test('17. kit boss leash: the boss never walks out of the centre circle, even after a hero that runs around the rocks',()=>{
 for(const tempo of [0,2]){const g=zone10(x=>{x.heroKit=PINK_IAI;x.kitTempo=tempo;});let max=0,walkedAtEdge=0;
  for(let t=0;t<15000&&g.status==='playing';t++){const input={x:Math.cos(t/300),y:Math.sin(t/300),auto:t%1200>=600,readyZone:9,readyBoss:true};g.acceptClientHints(input);g.step(.02,input);
   const e=g.bossEncounter;if(!e||e.room!==1)continue;max=Math.max(max,fromCentre(e.boss));}
  assert.ok(max<=KIT_BOSS_LEASH.radius+1e-6,'tempo '+tempo+': boss reached '+max+' cm from the centre');assert.ok(max>KIT_BOSS_LEASH.radius-5,'the boss did go to the edge');}
});
test('18. kit boss leash: a hero out at the rocks still gets the warning disc and the beam; the boss waits at the edge, facing the hero',()=>{
 const b=arena(PINK_IAI);b.bossIdleUntil=b.bossChaseUntil=b.bossAt=0;b.step(.02,{x:0,y:0,auto:false});place(b,AC.x-1000,AC.y+20);b.hero.motion=null;
 let warnings=0,beams=0,combos=0,lastWarn:any=null,idleAtEdge=0,max=0;const seenBeam=new Set<number>();
 for(let i=0;i<2500;i++){if(b.hero.hp<b.hero.maxHP*.5)b.hero.hp=b.hero.maxHP;if(!b.hero.motion){place(b,AC.x-1000,AC.y+20);}b.step(.02,{x:0,y:0,auto:false});
  if(b.warning&&b.warning!==lastWarn){warnings++;lastWarn=b.warning;assert.ok(Math.hypot(b.warning.x-b.hero.x,b.warning.z+5000-b.hero.y)<1,'disc on the hero');}
  for(const x of b.beams)if(!seenBeam.has(x.id)){seenBeam.add(x.id);beams++;}
  if(b.boss.motion?.kind==='boss-combo'&&b.boss.motion.start===b.elapsed)combos++;max=Math.max(max,fromCentre(b.boss));
  if(Math.abs(fromCentre(b.boss)-KIT_BOSS_LEASH.radius)<1&&b.boss.action==='idle'&&!b.boss.motion){idleAtEdge++;assert.ok(b.boss.direction.x<0,'facing the hero');}}
 assert.ok(max<=KIT_BOSS_LEASH.radius+1e-6,'boss stayed in the circle: '+max);assert.ok(warnings>=2,'warning discs: '+warnings);assert.ok(beams>=1,'beams: '+beams);
 assert.equal(combos,0,'no hook swing at a hero out of reach');assert.ok(idleAtEdge>50,'waits at the edge: '+idleAtEdge);
});
