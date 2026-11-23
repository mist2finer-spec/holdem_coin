import test from 'node:test';import assert from 'node:assert/strict';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine,UNITY_BOSS_RULES} from '../../src/lib/rpg-unity-boss-engine';
import {BOSS_CONTACT} from '../../src/lib/rpg-boss-contact';
import {BOSS_BEAM_RULES as R,makeBeam,beamPhase,beamAngle,beamContact,beamHalfWidth,beamFront} from '../../src/lib/rpg-boss-beam';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI} from '../../src/lib/rpg-hero-kit-iai';
import zoneTenArena from '../../src/lib/generated/zone-ten-arena.json';
import '../../src/lib/training-client-kernel';
// Kit boss rune beams (maintenance/boss-beam-camera-20261122). No hit while the seals charge, hit from the fire to the stop,
// the last-stand ring of 8 turning clockwise on screen. Without a kit nothing changes (test-boss-kit 1-2).
// Damage while touching (2026-11-23, maintenance/boss-beam-dot-20261123, user: no knockback, HP drains while the beam touches):
// no knockback, no stagger; one shared tick clock, 2,000 every .1 s (= 20,000/s) while touching a firing beam; dodge = no damage.
// The floor blast (warning disc) keeps its knockback / knockdown (user: "the floor attack must still knock down"), test 15.
const G=globalThis as any;
const near=(a:number,b:number,tol=1e-6,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} != ${b} (±${tol})`);
const LANE=5000,HR=BOSS_CONTACT.heroRadius;
function arena(kit:any=PINK_IAI){const b:any=new UnityBossEngine(111,{slimeCount:0,bossHP:2000,playerHP:100000},zoneTenArena);b.traversal=p;b.enterArena(false);b.heroKit=kit;
 b.bossIdleUntil=b.bossChaseUntil=b.bossAt=1e9;b.step(.02,{x:0,y:0,auto:false});return b;}
function place(b:any,x:number,y:number){b.hero.x=x;b.hero.y=y;b.hero.elevation=b.groundAt(x,y);}
function heroHits(b:any,seen:Set<number>,out:any[]){for(const f of b.fx)if(f.kind==='damage'&&f.target==='hero'&&!seen.has(f.id)){seen.add(f.id);out.push(f);}}
const idle={x:0,y:0,auto:false};

test('1. timeline: fire at charge x clip (1.296 s), line stop at .84 x clip, fade to the clip end; phase = age / clip for the line',()=>{
 const b=makeBeam({id:1,attackId:1,kind:'line',index:0,x:0,y:0,elevation:0,angle:0,at:10});
 near(b.fireAt-10,R.charge*R.clip,1e-9);near(b.fireAt-10,1.296,1e-9);near(b.stopAt-10,R.stopPhase*R.clip,1e-9);near(b.endAt-10,R.clip,1e-9);
 for(let t=10;t<=10+R.clip;t+=.05)near(beamPhase(b,t),(t-10)/R.clip,1e-9,`t ${t}`);
 assert.equal(beamFront(b,b.fireAt-.02),0,'no beam front before the fire');assert.equal(beamFront(b,b.fireAt+.3),1,'full length .3 s after the fire');
 const r=makeBeam({id:2,attackId:2,kind:'ring',index:0,x:0,y:0,elevation:0,angle:0,at:0,sustain:R.ring.sustain,turn:-1});
 near(beamPhase(r,r.fireAt),R.charge,1e-9);near(beamPhase(r,r.stopAt),R.stopPhase,1e-9);near(beamPhase(r,r.endAt),1,1e-9);near(r.stopAt-r.fireAt,R.ring.sustain,1e-9);
 let last=0;for(let t=0;t<=r.endAt;t+=.01){const ph=beamPhase(r,t);assert.ok(ph>=last-1e-12&&ph-last<.02,`phase continuous and rising at ${t}`);last=ph;}
});
test('2. judgement: segment-circle, width = the shader core at that distance, no hit outside the fire window',()=>{
 const b=makeBeam({id:1,attackId:1,kind:'line',index:0,x:0,y:0,elevation:0,angle:0,at:0}),t=b.fireAt+.5;
 for(const d of [100,500,1000,1700]){const w=beamHalfWidth(b,d-R.forward);
  assert.ok(beamContact(b,t,{x:d,y:w+HR-1},HR),`hit at ${d} just inside (${w.toFixed(1)} cm half width)`);
  assert.equal(beamContact(b,t,{x:d,y:-(w+HR+1)},HR),null,`miss at ${d} just outside`);}
 assert.equal(beamContact(b,b.fireAt-1e-6,{x:500,y:0},HR),null,'charging: no hit');assert.equal(beamContact(b,b.stopAt,{x:500,y:0},HR),null,'fading: no hit');
 assert.equal(beamContact(b,t,{x:R.forward+R.length+HR+5,y:0},HR),null,'past the end');assert.equal(beamContact(b,t,{x:-300,y:0},HR),null,'behind the boss');
 // The half width grows along the beam like the painted core (narrow at the seals, about 1 m wide at the end with width 1.4, size .8).
 assert.ok(beamHalfWidth(b,0)<20&&beamHalfWidth(b,R.length)>40&&beamHalfWidth(b,R.length)<50);
});
const TICK=R.tick,PER_TICK=UNITY_BOSS_RULES.blastDamage*R.damageScale*R.tick;
test('3. straight beam: 0 while charging, 2,000 every .1 s while standing in it (20,000/s), no knockback, no stagger, 0 in the fade',()=>{
 near(PER_TICK,2000,1e-9,'2,000 per tick');near(UNITY_BOSS_RULES.blastDamage*R.damageScale,20000,0,'20,000 per second');
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const beam=b.beams[0];
 near(beam.angle,Math.PI,1e-9,'aimed at the hero');assert.equal(b.boss.action,'beam');const seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<beam.fireAt-1e-9){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);}
 assert.equal(hits.length,0,'charge: no judgement');const hp0=b.hero.hp;let lastIn=-1;
 while(b.elapsed<beam.stopAt-1e-9){b.step(.02,idle);heroHits(b,seen,hits);
  assert.equal(b.hero.motion,null,'no knockback, no stagger motion');assert.equal(b.hero.action,'stay1');assert.equal(b.hero.airHeight,0);
  if(beamContact(beam,b.elapsed,b.hero,HR))lastIn=b.elapsed;place(b,b.boss.x-500,b.boss.y);}
 // The front reaches 5 m about .15 s after the fire (shader runeFront, ~.27 s to full length).
 const first=hits[0].contactAt;assert.ok(first>=beam.fireAt-1e-9&&first<beam.fireAt+.25,`first contact ${first-beam.fireAt} s after the fire`);
 for(let i=0;i<hits.length;i++){const h=hits[i];assert.equal(h.value,PER_TICK);assert.equal(h.definitionId,'boss-beam');assert.equal(h.target,'hero');
  if(i)near(h.contactAt-hits[i-1].contactAt,TICK,1e-6,'one tick per .1 s');assert.equal(h.dotId,hits[0].id,'one streak');near(h.dotTotal,PER_TICK*(i+1),1e-9,'running total');}
 const total=hits.reduce((s,h)=>s+h.value,0),dwell=lastIn-first+.02;near(hp0-b.hero.hp,total,1e-9,'HP = the ticks');
 assert.ok(Math.abs(total-dwell*20000)<=PER_TICK+1e-6,`dwell ${dwell.toFixed(2)} s x 20,000 = ${dwell*20000} vs ${total}`);
 assert.deepEqual(b.view().beams.map((v:any)=>[v.kind,v.originX,v.originZ]),[['line',b.boss.x,b.boss.y-LANE]]);
 const n=hits.length;while(b.elapsed<beam.endAt+.05){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);}
 assert.equal(hits.length,n,'fade: no damage');assert.equal(b.view().beams.length,0,'gone after the fade');
});
test('4. straight beam: the direction is fixed at the cast start; stepping out during the charge avoids it; dodge and a high jump too',()=>{
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const a0=b.beams[0].angle,seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<b.beams[0].stopAt){place(b,b.boss.x-500,b.boss.y+200);b.step(.02,idle);heroHits(b,seen,hits);near(b.beams[0].angle,a0,0);}
 assert.equal(hits.length,0,'2 m to the side: missed');
 const c=arena();place(c,c.boss.x-500,c.boss.y);c.startBeams('line');const beam=c.beams[0];while(c.elapsed<beam.fireAt-.1)c.step(.02,idle);
 assert.equal(c.command({x:0,y:1,auto:false,dodge:true}),true);const s2=new Set<number>(),h2:any[]=[];
 while(c.hero.motion?.kind==='dodge'){c.step(.02,idle);heroHits(c,s2,h2);}assert.equal(h2.length,0,'rolled out of the line');
 const d=arena();place(d,d.boss.x-500,d.boss.y);d.startBeams('line');const bd=d.beams[0];while(d.elapsed<bd.fireAt-.02)d.step(.02,idle);
 d.hero.airHeight=R.jumpClear+1;const s3=new Set<number>(),h3:any[]=[];d.step(.02,idle);d.hero.airHeight=R.jumpClear+1;heroHits(d,s3,h3);assert.equal(h3.length,0,'over the beam');
});
test('5. kit boss cycle: hook pair, throw + disc, straight beam, repeat',()=>{
 const b=arena();b.bossIdleUntil=b.bossChaseUntil=b.bossAt=0;place(b,b.boss.x-150,b.boss.y);const order:string[]=[];let last:any=null;
 for(let t=0;t<3000&&order.length<6;t++){const m=b.boss.motion;if(m&&m!==last){order.push(m.definitionId);last=m;}place(b,b.boss.x-150,b.boss.y);b.hero.motion=null;b.step(.02,idle);}
 assert.deepEqual(order,['boss-hook-pair','boss-throw','boss-beam','boss-hook-pair','boss-throw','boss-beam']);
 const old=arena(undefined);old.heroKit=undefined;old.bossIdleUntil=old.bossChaseUntil=old.bossAt=0;const o2:string[]=[];last=null;
 for(let t=0;t<3000&&o2.length<4;t++){const m=old.boss.motion;if(m&&m!==last){o2.push(m.definitionId);last=m;}place(old,old.boss.x-150,old.boss.y);old.hero.motion=null;old.step(.02,idle);}
 assert.deepEqual(o2,['boss-hook-pair','boss-throw','boss-hook-pair','boss-throw'],'no kit: two-step cycle, no beam');assert.equal('beams' in old.view(),false);
});
test('6. last stand: at <= 25 % HP once, 8 beams 45 deg apart, fire after the charge, turn -20 deg/s for 6 s (clockwise on screen)',()=>{
 const b=arena();b.bossIdleUntil=b.bossChaseUntil=b.bossAt=0;place(b,b.boss.x-600,b.boss.y);b.boss.hp=501;b.step(.02,idle);
 assert.notEqual(b.boss.motion?.definitionId,'boss-beam-ring','26 %: not yet');b.boss.motion=null;b.boss.hp=500;b.step(.02,idle);
 assert.equal(b.boss.motion?.definitionId,'boss-beam-ring');const ring=b.beams.filter((x:any)=>x.kind==='ring');assert.equal(ring.length,8);
 for(let i=0;i<8;i++){near(ring[i].angle-ring[0].angle,i*Math.PI/4,1e-9);near(ring[i].turn,-20*Math.PI/180,1e-12);}
 const r0=ring[0];near(beamAngle(r0,r0.fireAt-.5),r0.angle,0,'no turn while charging');
 near(beamAngle(r0,r0.fireAt+1),r0.angle-20*Math.PI/180,1e-9,'20 deg in the first second after the fire');near(beamAngle(r0,r0.stopAt+1),r0.angle-120*Math.PI/180,1e-9,'120 deg in 6 s, then held');
 // The boss turns with beam 0.
 while(b.elapsed<r0.fireAt+2)b.step(.02,{x:0,y:0,auto:false});near(Math.atan2(b.boss.direction.y,b.boss.direction.x),Math.atan2(Math.sin(beamAngle(r0,b.elapsed)),Math.cos(beamAngle(r0,b.elapsed))),1e-6);
 while(b.boss.motion)b.step(.02,idle);b.boss.hp=300;b.bossIdleUntil=b.bossAt=0;let again=false;for(let t=0;t<600;t++){b.step(.02,idle);if(b.boss.motion?.definitionId==='boss-beam-ring')again=true;}
 assert.equal(again,false,'only once');
});
test('7. last stand: no hit while charging; riding a turning ring beam = 2,000 every .1 s (no .6 s guard), no knockback',()=>{
 assert.equal('invulnerable' in R.ring,false,'the .6 s ring guard is replaced by the tick');
 const b=arena();place(b,b.boss.x-600,b.boss.y);b.startBeams('ring');const r0=b.beams[0],seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<r0.fireAt-1e-9){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-600,b.boss.y);}assert.equal(hits.length,0,'charge: no judgement');
 // Standing in beam 0 while it turns (moved with it by hand): one tick per .1 s for 2 s, never a knockback.
 for(let t=0;t<100;t++){const a=beamAngle(r0,b.elapsed+.02);place(b,b.boss.x+Math.cos(a)*600,b.boss.y+Math.sin(a)*600);b.step(.02,idle);heroHits(b,seen,hits);assert.equal(b.hero.motion,null);}
 assert.ok(hits.length>=18&&hits.length<=21,`ticks in 2 s: ${hits.length}`);
 for(let i=0;i<hits.length;i++){assert.equal(hits[i].definitionId,'boss-beam-ring');assert.equal(hits[i].value,PER_TICK);if(i)near(hits[i].contactAt-hits[i-1].contactAt,TICK,1e-6);}
 assert.equal(b.view().beams.length,8);assert.ok(b.view().beams.every((v:any)=>v.kind==='ring'&&v.turn<0));
});
test('8. beams leave with the boss defeat; legacy zone-10 boss and no-kit views have no beams key',()=>{
 const b=arena();b.startBeams('ring');assert.equal(b.beams.length,8);b.defeatBoss();assert.equal(b.beams.length,0);assert.deepEqual(b.view().beams,[]);
 const g:any=new MountSundayEngine(111,p,9);g.heroKit=PINK_IAI;g.bossHeroLegacy=true;g.syncBoss();const input={x:0,y:0,auto:true,readyZone:9,readyBoss:true};
 for(let t=0;t<300;t++){g.acceptClientHints(input);g.step(.02,input);}assert.equal(g.view().routeStage,'boss');assert.equal('beams' in g.view(),false);
 assert.equal('beams' in new UnityBossEngine(111).view(),false);
});
test('9. dev boot bossStartHP: the kit zone-10 boss starts there (max stays 2000); absent = 2000; legacy ignores it',()=>{
 const skills=['icespear','icenova','frostshot','stormcall','arc','spark'].map(a=>({activeId:a,enabled:true,supportIds:[]}));const base={seed:111,traversalProfile:'source-run-v2',heroKit:'pink-iai',build:{skills},mode:'mount',referencePreview:true,previewZone:9};
 const boss=(v:any)=>v.mobs.find((m:any)=>m.unityBoss);
 let v=JSON.parse(G.stageInitialize(JSON.stringify({...base,bossStartHP:520})));assert.equal(boss(v).hp,520);assert.equal(boss(v).maxHP,2000);
 v=JSON.parse(G.stageInitialize(JSON.stringify(base)));assert.equal(boss(v).hp,2000);
 v=JSON.parse(G.stageInitialize(JSON.stringify({...base,bossStartHP:520,bossHero:'legacy'})));assert.equal(boss(v).hp,2000,'legacy: unchanged');
 const g:any=new MountSundayEngine(111,p,0);g.heroKit=PINK_IAI;g.setBossStartHP(520);assert.equal(g.bossStartHP,520,'kept until the zone-10 entry');
});
test('10. zone 10 kit AUTO run with the dev start HP: the ring fires, the hero is hit by beams, the boss still falls',()=>{
 const g:any=new MountSundayEngine(111,p,9);g.heroKit=PINK_IAI;g.syncBoss();g.setBossStartHP(560);for(let i=0;i<6;i++){g.skillIds[i]='';}
 const seen=new Set<number>(),hits:any[]=[];let ring=0;
 for(let t=0;t<30000&&g.status==='playing';t++){const input={x:0,y:0,auto:true,readyZone:9,readyBoss:true};g.acceptClientHints(input);g.step(.02,input);const b=g.bossEncounter;if(!b)continue;
  if(b.boss.motion?.definitionId==='boss-beam-ring')ring++;heroHits(b,seen,hits);}
 assert.ok(ring>0,'the ring was cast');assert.ok(g.status==='won'||g.bossEncounter?.bossDefeated,'the boss falls');
});
// --- damage while touching (2026-11-23, boss-beam-dot-20261123) ---------------------------------------------------------------------
// One straight beam with the hero 5 m in front of the boss. mode: 'graze' = one step in the line .3 s after the fire (beam at full
// length), 2 m aside otherwise; 'stay' = in the line the whole time; 'exit' = in the line, then walks out sideways from .5 s after the fire.
function drill(mode:'graze'|'stay'|'exit'){
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const beam=b.beams[0],seen=new Set<number>(),hits:any[]=[],hp0=b.hero.hp;
 let inside=0,walked=0,lastY=0,graze=false,walk=false;const curve:[number,number][]=[];
 while(b.elapsed<beam.endAt+.05){
  let input:any=idle;
  if(mode==='graze'){const now=!graze&&b.elapsed>=beam.fireAt+.3;place(b,b.boss.x-500,b.boss.y+(now?0:200));graze||=now;}
  else if(mode==='stay'||b.elapsed<beam.fireAt+.5)place(b,b.boss.x-500,b.boss.y);
  else {input={x:0,y:1,auto:false};if(!walk){walk=true;lastY=b.hero.y;}}
  b.step(.02,input);heroHits(b,seen,hits);if(beamContact(beam,b.elapsed,b.hero,HR))inside++;
  if(walk){assert.ok(b.hero.y>lastY,'walks while touched (no stagger)');walked+=b.hero.y-lastY;lastY=b.hero.y;}
  assert.notEqual(b.hero.motion?.kind,'knockback');curve.push([+(b.elapsed-beam.fireAt).toFixed(2),hp0-b.hero.hp]);
 }
 return {total:hp0-b.hero.hp,ticks:hits.length,dwell:inside*.02,walked,hits,curve};
}
test('11. graze / stay / walk out: damage = time touching x 20,000/s (± 1 tick), walking works while touched',()=>{
 const g=drill('graze'),s=drill('stay'),e=drill('exit');
 assert.equal(g.total,PER_TICK,'a graze (one step) = one tick');assert.equal(g.ticks,1);
 for(const [name,r] of [['stay',s],['exit',e]] as const){assert.ok(Math.abs(r.total-r.dwell*20000)<=PER_TICK+1e-6,`${name}: ${r.dwell.toFixed(2)} s touching -> ${r.total}`);
  assert.equal(r.hits.reduce((a:number,h:any)=>a+h.value,0),r.total);}
 assert.ok(e.total<s.total&&e.total>=.5*20000-PER_TICK,`exit ${e.total} < stay ${s.total}`);assert.ok(e.walked>50,'walked out');
 // The numbers the report quotes (old rule: one 20,000 hit + 1.8 s knockback in every case).
 console.log(JSON.stringify({graze:{total:g.total,dwell:g.dwell},stay:{total:s.total,dwell:+s.dwell.toFixed(2)},exit:{total:e.total,dwell:+e.dwell.toFixed(2)}}));
});
test('12. touched by the beam: a dodge is taken at once and its invulnerability holds (0 during the roll), ticks resume after it',()=>{
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const beam=b.beams[0],seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<beam.fireAt+.4){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);}
 assert.ok(hits.length>=2,'touched');
 // A roll along the beam (away from the boss) keeps the hero in the line.
 assert.equal(b.command({x:-1,y:0,auto:false,dodge:true}),true,'dodge taken while touched');const n=hits.length;let rolled=0;
 // (the step that ends the roll may tick: the hero is no longer rolling on that step)
 for(;;){b.step(.02,idle);if(b.hero.motion?.kind!=='dodge')break;heroHits(b,seen,hits);rolled++;}
 assert.ok(rolled>5);assert.equal(hits.length,n,'no damage while rolling');assert.ok(beamContact(beam,b.elapsed,b.hero,HR),'still in the line after the roll');
 for(let t=0;t<10;t++){b.step(.02,idle);heroHits(b,seen,hits);}assert.ok(hits.length>n,'ticks again after the roll');
 assert.ok(hits.every((h:any)=>h.value===PER_TICK));
});
test('13. overlapping beams: still one tick per .1 s (2,000), not one per beam',()=>{
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');b.startBeams('line');assert.equal(b.beams.length,2);
 const fire=b.beams[0].fireAt,stop=b.beams[0].stopAt,seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<stop){const before=hits.length;b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);assert.ok(hits.length-before<=1,'one damage event per step');}
 assert.ok(hits.length>10&&b.elapsed>fire);for(let i=1;i<hits.length;i++){near(hits[i].contactAt-hits[i-1].contactAt,TICK,1e-6);assert.equal(hits[i].value,PER_TICK);}
});
test('14. a jump over jumpClear and the knockdown of a floor blast still take no beam damage',()=>{
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const beam=b.beams[0],seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<beam.fireAt+.3){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);}const n=hits.length;assert.ok(n>=1);
 for(let t=0;t<10;t++){b.hero.airHeight=R.jumpClear+1;b.step(.02,idle);b.hero.airHeight=R.jumpClear+1;heroHits(b,seen,hits);}assert.equal(hits.length,n,'over the beam');
 b.hero.airHeight=0;b.hero.motion={kind:'knockback',start:b.elapsed,duration:1.8,hitAt:0,from:{x:b.hero.x,y:b.hero.y},to:{x:b.hero.x,y:b.hero.y}};
 for(let t=0;t<20;t++){b.step(.02,idle);heroHits(b,seen,hits);}assert.equal(hits.length,n,'knocked down by a blast: the beam does not add damage (rule unchanged)');
});
// Floor blast (the warning disc of the throw) keeps the knockback / knockdown / get-up (director 2026-11-23, user). Same with and without
// the kit: the disc on the hero, 10,000 at the explosion, knockback 1.8 s (flight .45 s, knockdown to 1.2 s, get-up), input ignored.
function blast(kit:any){
 const b=arena(kit);b.heroKit=kit;place(b,b.boss.x-300,b.boss.y);b.bossTurn=1;b.bossIdleUntil=b.bossChaseUntil=b.bossAt=0;b.step(.02,idle);
 assert.equal(b.boss.motion?.definitionId,'boss-throw');const w=b.warning;assert.ok(w,'warning disc');const seen=new Set<number>(),hits:any[]=[];
 while(!hits.length&&b.elapsed<w.explodeAt+.1){b.step(.02,idle);heroHits(b,seen,hits);}
 const at=b.elapsed,m=b.hero.motion,from={x:b.hero.x,y:b.hero.y},actions:string[]=[];let flight=null as any;
 for(let t=0;t<100&&b.hero.motion;t++){b.step(.02,{x:1,y:1,auto:false});heroHits(b,seen,hits);const a=b.hero.action;if(actions.at(-1)!==a)actions.push(a);
  if(b.elapsed-at>.5&&b.elapsed-at<1.7){if(!flight)flight={x:b.hero.x,y:b.hero.y};else{near(b.hero.x,flight.x,1e-9,'knocked down: input ignored');near(b.hero.y,flight.y,1e-9);}}}
 return {hit:hits[0],motion:m&&{kind:m.kind,duration:m.duration,to:Math.hypot(m.to.x-from.x,m.to.y-from.y)},actions,ticks:hits.length,end:+(b.elapsed-at).toFixed(2)};
}
test('15. floor blast unchanged: knockback, knockdown and get-up with the kit as without it (only the beams lost the knockback)',()=>{
 const k=blast(PINK_IAI),o=blast(undefined);
 for(const r of [k,o]){assert.equal(r.hit.value,UNITY_BOSS_RULES.blastDamage);assert.ok(r.hit.warningId!==undefined,'the blast');assert.equal(r.hit.dotId,undefined,'not a beam tick');
  assert.equal(r.motion.kind,'knockback');assert.equal(r.motion.duration,UNITY_BOSS_RULES.knockbackSeconds);near(r.motion.to,260,1,'260 cm');
  assert.deepEqual(r.actions,['knockback','knockdown','getup','stay1']);assert.equal(r.ticks,1);}
 assert.deepEqual(k.motion,o.motion);assert.equal(k.end,o.end);
});
