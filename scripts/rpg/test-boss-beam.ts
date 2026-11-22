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
// one hit per straight beam, the last-stand ring of 8 turning clockwise on screen. Without a kit nothing changes (test-boss-kit 1-2).
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
test('3. straight beam in the arena: 0 hits while charging (hero in the line), 1 hit on fire, 2 x blast damage, knockback, then none',()=>{
 const b=arena();place(b,b.boss.x-500,b.boss.y);b.startBeams('line');const beam=b.beams[0];
 near(beam.angle,Math.PI,1e-9,'aimed at the hero');assert.equal(b.boss.action,'beam');const seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<beam.fireAt-1e-9){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-500,b.boss.y);}
 assert.equal(hits.length,0,'charge: no judgement');
 // The front reaches 5 m about .15 s after the fire (shader runeFront, ~.27 s to full length).
 while(b.elapsed<beam.fireAt+.3){b.step(.02,idle);heroHits(b,seen,hits);if(!hits.length)place(b,b.boss.x-500,b.boss.y);}
 assert.equal(hits.length,1,'the fire hits');assert.equal(hits[0].value,UNITY_BOSS_RULES.blastDamage*2);assert.equal(hits[0].definitionId,'boss-beam');
 assert.ok(hits[0].contactAt>=beam.fireAt-1e-9&&hits[0].contactAt<beam.fireAt+.25,`contact ${hits[0].contactAt-beam.fireAt} s after the fire`);assert.equal(b.hero.motion?.kind,'knockback');
 // Knockback cut by hand (motion, air height) so the hero stands in the beam again: still no second hit.
 while(b.elapsed<beam.stopAt){b.hero.motion=null;b.hero.airHeight=0;b.hero.action='stay1';place(b,b.boss.x-500,b.boss.y);b.step(.02,idle);heroHits(b,seen,hits);}
 assert.equal(hits.length,1,'one hit per cast even when standing in it again');
 assert.deepEqual(b.view().beams.map((v:any)=>[v.kind,v.originX,v.originZ]),[['line',b.boss.x,b.boss.y-LANE]]);
 while(b.elapsed<beam.endAt+.05)b.step(.02,idle);assert.equal(b.view().beams.length,0,'gone after the fade');
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
test('7. last stand: no hit while charging; a ring hit; .6 s safe after it; hit again by the next beam',()=>{
 const b=arena();place(b,b.boss.x-600,b.boss.y);b.startBeams('ring');const r0=b.beams[0],seen=new Set<number>(),hits:any[]=[];
 while(b.elapsed<r0.fireAt-1e-9){b.step(.02,idle);heroHits(b,seen,hits);place(b,b.boss.x-600,b.boss.y);}assert.equal(hits.length,0,'charge: no judgement');
 while(b.elapsed<r0.fireAt+.3&&!hits.length){b.step(.02,idle);heroHits(b,seen,hits);}assert.equal(hits.length,1);assert.equal(hits[0].definitionId,'boss-beam-ring');const first=hits[0].contactAt;
 // Without the knockback, standing in the turning beam: no second hit for .6 s, then the guard is over.
 for(let t=0;t<60;t++){b.hero.motion=null;b.hero.airHeight=0;b.hero.action='stay1';const a=beamAngle(r0,b.elapsed+.02);place(b,b.boss.x+Math.cos(a)*600,b.boss.y+Math.sin(a)*600);b.step(.02,idle);heroHits(b,seen,hits);if(hits.length>1)break;}
 assert.equal(hits.length,2);near(hits[1].contactAt-first,R.ring.invulnerable,.021,'guard');
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
