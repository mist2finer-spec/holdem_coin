import test from 'node:test';import assert from 'node:assert/strict';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import {ElementalCombat,ELECTRIC,killElementOf,ertelOf} from '../../src/lib/rpg-elemental-combat';
import {REFERENCE_SKILLS,referenceSkill} from '../../src/lib/rpg-reference-skills';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI} from '../../src/lib/rpg-hero-kit-iai';
import zoneTenArena from '../../src/lib/generated/zone-ten-arena.json';
import '../../src/lib/training-client-kernel';
// Electric ertel trial (2026-11-23, maintenance/ertel-electric-20261123, stage 1 = kernel only). The ertel only tags events
// (element on normal-attack damage, killElement on kills); slots 3/4 trial skills: lightning ball (projectile) and arc discharge (mine).
const G=globalThis as any;
const LB=REFERENCE_SKILLS.lightningball,ARC=REFERENCE_SKILLS.arcdischarge,DT=.02;
const idle={x:0,y:0,auto:false,readyZone:0,readyBoss:true};
const autoIn={x:0,y:0,auto:true,readyZone:0,readyBoss:true};
function mount({kit=false,ertel=null as any,skills=[] as string[]}={}){
 const g:any=new MountSundayEngine(111,p,0);if(kit)g.heroKit=PINK_IAI;g.setErtel(ertel);
 skills.forEach((id,i)=>{g.skillEnabled[i]=!!id;g.skillIds[i]=id;});g.acceptClientHints({readyZone:0});return g;}
function arena({kit=true,ertel=null as any,skills=[] as string[]}={}){
 const g:any=new UnityBossEngine(111,{slimeCount:0,bossHP:2000,playerHP:100000},zoneTenArena);g.traversal=p;if(kit)g.heroKit=PINK_IAI;g.enterArena();g.setErtel(ertel);
 skills.forEach((id,i)=>{g.skillEnabled[i]=!!id;g.skillIds[i]=id;});return g;}
// A still slime (frozen, never attacks) dx/dy from the hero; no zone spawns after quiet().
function quiet(g:any){g.spawned=30;g.mobs=[];}
function mob(g:any,id:number,dx:number,dy=0,hp=90):any{const h=g.hero,x=h.x+dx,y=h.y+dy,m:any={id,species:1003,room:g.room,x,y,elevation:g.groundAt(x,y),hp,maxHP:hp,radius:12.5,bodyHeight:31,state:'walk',facing:-1,nextAttack:1e9,frozenUntil:1e9};g.mobs.push(m);return m;}
// Every fx event seen while stepping (g.fx keeps recent ones only).
function run(g:any,ticks:number,input:any=idle,seen=new Map<number,any>()){for(let i=0;i<ticks;i++){g.step(DT,input);for(const f of g.fx)if(!seen.has(f.id))seen.set(f.id,{...f});}return [...seen.values()];}
// The keys this change adds, removed (as gd/tools/strip.mts): equal stripped views = no other change.
function strip(v:any,top=true):any{if(Array.isArray(v)){v.forEach(x=>strip(x,false));return v;}if(!v||typeof v!=='object')return v;if(top)delete v.ertel;
 delete v.killElement;delete v.lightningBalls;delete v.arcMines;if(v.kind==='damage'&&v.damageKind==='attack'&&v.element===ELECTRIC)delete v.element;for(const k of Object.keys(v))strip(v[k],false);return v;}
const plain=(g:any)=>JSON.stringify(strip(JSON.parse(JSON.stringify(g.view()))));

test('1. ertel state: engines default to none (no view key); command {ertel} equips/unequips, bad values refused; mount hands it to the zone-10 boss',()=>{
 assert.equal(ertelOf('electric'),'electric');assert.equal(ertelOf(null),null);assert.equal(ertelOf('none'),null);assert.equal(ertelOf('fire'),undefined);assert.equal(ertelOf(undefined),undefined);
 for(const g of [mount(),arena()] as any[]){
  assert.equal(g.ertel,null);assert.equal('ertel' in g.view(),false);
  assert.equal(g.command({...idle,ertel:'electric'}),true);assert.equal(g.ertel,'electric');assert.equal(g.view().ertel,'electric');
  assert.equal(g.command({...idle,ertel:'fire'}),false);assert.equal(g.ertel,'electric');
  assert.equal(g.command({...idle,ertel:null}),true);assert.equal(g.ertel,null);assert.equal('ertel' in g.view(),false);
 }
 const z:any=new MountSundayEngine(111,p,9);z.setErtel('electric');assert.equal(z.view().ertel,'electric','zone-10 boss view');
 assert.equal(z.command({...idle,ertel:null}),true);assert.equal('ertel' in z.view(),false);
});
test('2. boot: the practice boot (referencePreview) equips electric in zone 1, zone 10 and the boss arena; boot ertel wins; other boots none; the toggle works while paused',()=>{
 const skills=[{activeId:'spark',enabled:true,supportIds:[]}];
 const boot=(o:any)=>JSON.parse(G.stageInitialize(JSON.stringify({seed:111,traversalProfile:'source-run-v2',heroKit:'pink-iai',build:{skills},...o})));
 assert.equal(boot({mode:'mount',referencePreview:true,previewZone:0}).ertel,'electric');
 assert.equal(boot({mode:'mount',referencePreview:true,previewZone:9}).ertel,'electric');
 assert.equal(boot({mode:'boss',referencePreview:true,previewArena:true}).ertel,'electric');
 assert.equal('ertel' in boot({mode:'mount',referencePreview:true,previewZone:0,ertel:null}),false);
 assert.equal('ertel' in boot({mode:'mount'}),false);assert.equal('ertel' in boot({mode:'boss'}),false);
 assert.equal(boot({mode:'mount',ertel:'electric'}).ertel,'electric');
 boot({mode:'mount',referencePreview:true,previewZone:0});
 const step=(o:any)=>JSON.parse(G.stageAdvance(JSON.stringify({steps:1,snapshot:true,...o})));
 let v=step({input:{...idle,paused:true},commands:[{ertel:null}]});assert.equal('ertel' in v,false,'off while paused');
 v=step({input:{...idle,paused:true},commands:[{ertel:'electric'}]});assert.equal(v.ertel,'electric','on while paused');
 const before=v.hero.motion;v=step({input:{...idle,paused:true},commands:[{attack:true}]});assert.deepEqual(v.hero.motion,before,'other commands still wait for unpause');
});
test('3. lane (zone 1, kit, AUTO): ertel on tags every normal-attack damage event and its kills, and changes nothing else tick for tick',()=>{
 const on=mount({kit:true,ertel:'electric'}),off=mount({kit:true});const seenOn=new Map<number,any>(),seenOff=new Map<number,any>();
 for(let t=0;t<1500;t++){run(on,1,autoIn,seenOn);run(off,1,autoIn,seenOff);assert.equal(plain(on),plain(off),'tick '+t);}
 const hitsOn=[...seenOn.values()].filter(f=>f.kind==='damage'&&f.damageKind==='attack'),hitsOff=[...seenOff.values()].filter(f=>f.kind==='damage'&&f.damageKind==='attack');
 assert.ok(hitsOn.length>=20,'attack hits '+hitsOn.length);assert.equal(hitsOn.length,hitsOff.length);
 assert.ok(hitsOn.every(f=>f.element===ELECTRIC));assert.ok(hitsOff.every(f=>!('element' in f)&&!('killElement' in f)));
 hitsOn.forEach((f,i)=>{assert.equal(f.value,hitsOff[i].value);assert.equal(f.contactAt,hitsOff[i].contactAt);assert.deepEqual(f.point,hitsOff[i].point);});
 const kills=hitsOn.filter(f=>f.killElement);assert.ok(kills.length>=5,'attack kills '+kills.length);assert.ok(kills.every(f=>f.killElement===ELECTRIC));
 assert.ok(on.kills>=5);assert.equal(on.kills,off.kills);
});
test('4. boss arena (plane, kit): ertel on vs off is the same fight; the kill keeps the village-exit flow and carries killElement on the boss and boss-defeated',()=>{
 const on=arena({ertel:'electric'}),off=arena();on.setStartHP(300);off.setStartHP(300);const sOn=new Map<number,any>(),sOff=new Map<number,any>();
 let t=0;for(;t<4000&&on.status==='playing';t++){run(on,1,autoIn,sOn);run(off,1,autoIn,sOff);assert.equal(plain(on),plain(off),'tick '+t);}
 assert.equal(on.status,'won');assert.equal(off.status,'won');assert.equal(on.bossDefeated,true);
 const dOn=[...sOn.values()].find(f=>f.kind==='boss-defeated'),dOff=[...sOff.values()].find(f=>f.kind==='boss-defeated');
 assert.equal(dOn.killElement,ELECTRIC);assert.equal('killElement' in dOff,false);assert.equal(on.boss.killElement,ELECTRIC);assert.equal(off.boss.killElement,undefined);
 assert.ok([...sOn.values()].some(f=>f.kind==='damage'&&f.damageKind==='attack'&&f.target==='boss'&&f.element===ELECTRIC&&f.killElement===ELECTRIC));
 assert.ok([...sOn.values()].some(f=>f.kind==='village-arrived'));
});
test('5. killElement by skill: lightning (spark) = electric with or without the ertel; water = water; sun-cleave and unequipped attacks = none',()=>{
 assert.equal(killElementOf('lightning'),ELECTRIC);assert.equal(killElementOf(ELECTRIC),ELECTRIC);assert.equal(killElementOf('water'),'water');assert.equal(killElementOf(undefined),undefined);
 const cases:[string,string|undefined][]=[['spark',ELECTRIC],['frostshot','water'],['cleave',undefined]];
 for(const [id,want] of cases){const g=mount({skills:[id]});quiet(g);const m=mob(g,1,130);
  assert.equal(g.command({...idle,skill:0}),true,id);const fx=run(g,80);assert.equal(m.hp,0,id+' kills');
  const kill=fx.find(f=>f.kind==='damage'&&f.target==='mob1'&&'killElement' in f);assert.equal(m.killElement,want,id);assert.equal(kill?.killElement,want,id+' fx');}
 const g=mount();quiet(g);const m=mob(g,1,60,0,30);for(let i=0;i<60&&m.hp>0;i++){g.command({...idle,attack:true});run(g,1);}assert.equal(m.hp,0);assert.equal(m.killElement,undefined);
});
test('6. lightning ball (lane): flies along the aim at 880 cm/s, bursts on the first slime (not the one behind), electric damage and kill',()=>{
 assert.equal(referenceSkill('lightningball'),LB);assert.equal(LB.id,'lightning-ball');assert.equal(LB.size,1);assert.equal(LB.count,1);
 const g=mount({skills:['','','lightningball']});quiet(g);const a=mob(g,1,300),b=mob(g,2,500);const x0=g.hero.x;
 assert.equal(g.command({...idle,skill:2}),true);const fx=run(g,60);
 const launch=fx.find(f=>f.kind==='elemental-launch'),burst=fx.find(f=>f.kind==='elemental-burst');
 assert.ok(launch&&burst);assert.equal(launch.element,ELECTRIC);assert.equal(launch.skill,'lightning-ball');assert.ok(Math.abs(launch.born-LB.hitAt)<1e-9);
 assert.ok(Math.abs(launch.dirX-1)<1e-9&&Math.abs(launch.dirZ)<1e-9);
 assert.equal(burst.reason,'target');assert.equal(burst.targetId,1);const travel=300-a.radius-LB.ballRadius;assert.ok(Math.abs(burst.x-(x0+travel))<1e-6,'burst at the slime edge '+burst.x);
 const exact=launch.born+travel/LB.speed;assert.ok(burst.born>=exact-1e-9&&burst.born<exact+DT+1e-9,'burst time '+burst.born+' vs '+exact);
 const hit=fx.find(f=>f.kind==='damage'&&f.target==='mob1');assert.equal(hit.value,LB.damage);assert.equal(hit.element,ELECTRIC);assert.equal(hit.killElement,ELECTRIC);
 assert.equal(a.hp,0);assert.equal(b.hp,90,'the slime behind is not hit');assert.equal('lightningBalls' in g.view(),false,'no ball left');
});
test('7. lightning ball: AUTO-style aim takes the nearest slime in reach (diagonal), range end bursts at 550 cm, the view lists a flying ball',()=>{
 const g=mount({skills:['lightningball']});quiet(g);const a=mob(g,1,250,90);assert.equal(g.command({...idle,skill:0}),true);
 let seenBall=false;const seen=new Map<number,any>();for(let i=0;i<60;i++){run(g,1,idle,seen);const v=g.view();if(v.lightningBalls){seenBall=true;assert.equal(v.lightningBalls.length,1);}}
 const fx=[...seen.values()],launch=fx.find(f=>f.kind==='elemental-launch'),burst=fx.find(f=>f.kind==='elemental-burst');
 assert.ok(seenBall);assert.ok(launch.dirZ>.3,'aims at the slime');assert.equal(burst.reason,'target');assert.equal(a.hp,0);
 const r=mount({skills:['lightningball']});quiet(r);assert.equal(r.command({...idle,skill:0}),true);const fr=run(r,80);
 const l=fr.find(f=>f.kind==='elemental-launch'),e=fr.find(f=>f.kind==='elemental-burst');assert.equal(e.reason,'range');
 assert.ok(Math.abs(Math.hypot(e.x-l.x,e.z-l.z)-LB.range)<1e-6);const exact=l.born+LB.range/LB.speed;assert.ok(e.born>=exact-1e-9&&e.born<exact+DT+1e-9);
 assert.equal(fr.filter(f=>f.kind==='damage').length,0);
});
test('8. arc discharge (lane): thrown 275 cm ahead, lands after 0.35 s, a slime in the trigger radius sets it off on landing (not in the air)',()=>{
 assert.equal(referenceSkill('arcdischarge'),ARC);assert.equal(referenceSkill('arc').id,'storm-call','the old arc gem is unchanged');
 const g=mount({skills:['','','','arcdischarge']});quiet(g);const x0=g.hero.x,a=mob(g,1,ARC.throwDistance+100,0,300),b=mob(g,2,ARC.throwDistance+400);
 assert.equal(g.command({...idle,skill:3}),true);const seen=new Map<number,any>();let placed=false;
 for(let i=0;i<60;i++){run(g,1,idle,seen);if(g.view().arcMines)placed=true;}
 const fx=[...seen.values()],th=fx.find(f=>f.kind==='elemental-throw'),burst=fx.find(f=>f.kind==='elemental-burst');
 assert.ok(placed&&th&&burst);assert.ok(Math.abs(th.x-(x0+ARC.throwDistance))<1e-6);assert.ok(Math.abs(th.landAt-th.born-ARC.throwSeconds)<1e-9);assert.ok(Math.abs(th.fuseAt-th.landAt-ARC.fuse)<1e-9);
 assert.equal(burst.reason,'proximity');assert.ok(burst.born>=th.landAt-1e-9&&burst.born<th.landAt+DT+1e-9,'bursts on landing '+burst.born);
 const hit=fx.find(f=>f.kind==='damage'&&f.target==='mob1');assert.equal(hit.value,ARC.damage);assert.equal(hit.element,ELECTRIC);assert.equal(a.hp,300-ARC.damage);
 assert.equal(b.hp,90,'outside the radius');assert.equal('arcMines' in g.view(),false);
});
test('9. arc discharge: with nobody near it bursts on the fuse (3 s after landing); a slime walking in sets it off early',()=>{
 const g=mount({skills:['arcdischarge']});quiet(g);assert.equal(g.command({...idle,skill:0}),true);const fx=run(g,220);
 const th=fx.find(f=>f.kind==='elemental-throw'),burst=fx.find(f=>f.kind==='elemental-burst');assert.equal(burst.reason,'fuse');assert.ok(burst.born>=th.fuseAt-1e-9&&burst.born<th.fuseAt+DT+1e-9);
 const w=mount({skills:['arcdischarge']});quiet(w);const m=mob(w,1,700,0,500);assert.equal(w.command({...idle,skill:0}),true);
 const seen=new Map<number,any>();run(w,40,idle,seen);m.frozenUntil=0;run(w,200,idle,seen);
 const t2=[...seen.values()].find(f=>f.kind==='elemental-throw'),b2=[...seen.values()].find(f=>f.kind==='elemental-burst');
 assert.equal(b2.reason,'proximity');assert.ok(b2.born>t2.landAt&&b2.born<t2.fuseAt,'early '+b2.born);assert.ok(m.hp<500,'the walker is hurt');
});
test('10. arc discharge: at most maxActive mines; one more makes the oldest burst at once (overflow). Ball size/count are spec fields',()=>{
 const fx:any[]=[],hurt:any[]=[];const world:any={targets:[{id:1,x:0,y:0,elevation:0,hp:1000,radius:10}],obstacles:[],ground:()=>0,damage:(t:any,d:number)=>{t.hp-=d;hurt.push(d);},impulse:()=>{},emit:(e:any)=>fx.push(e)};
 world.targets[0].x=-1e4;const ec=new ElementalCombat(),o={x:0,y:0,elevation:0},c={x:100,y:0,elevation:0};
 for(let i=0;i<ARC.maxActive+1;i++)ec.cast('arc-discharge',1,o,c,i*.1,i+1,170,world);
 const over=fx.filter(f=>f.kind==='elemental-burst');assert.equal(over.length,1);assert.equal(over[0].reason,'overflow');assert.equal(over[0].attackId,1);
 assert.deepEqual(ec.placedMines().map(m=>m.attackId),[2,3]);
 for(let t=DT;t<5;t+=DT)ec.step(t,DT,world);assert.deepEqual(fx.filter(f=>f.kind==='elemental-burst').map(f=>f.reason),['overflow','fuse','fuse']);assert.equal(ec.placedMines().length,0);
 const fb:any[]=[];const w2:any={...world,targets:[],emit:(e:any)=>fb.push(e)};ec.lightningBall({...LB,count:3,size:2},o,c,0,9,150,w2);
 assert.equal(fb.length,3);assert.ok(fb.every(f=>f.radius===LB.ballRadius*2&&f.blast===LB.radius*2));
 assert.deepEqual(fb.map(f=>Math.round(Math.atan2(f.dirZ,f.dirX)*180/Math.PI)),[-LB.spread,0,LB.spread]);
});
test('11. boss arena (plane, kit): the ball flies at the boss and the mine bursts on it; damage is electric, no cast-time hitstop for either',()=>{
 for(const id of ['lightningball','arcdischarge']){const g=arena({skills:[id]});const hp=g.boss.hp;assert.equal(g.command({...idle,skill:0}),true);
  let stop=false;const seen=new Map<number,any>();for(let i=0;i<70;i++){run(g,1,idle,seen);if(g.hero.motion?.hitstopUntil)stop=true;}
  const fx=[...seen.values()],burst=fx.find(f=>f.kind==='elemental-burst'),hit=fx.find(f=>f.kind==='damage'&&f.target==='boss');
  assert.ok(burst,id);assert.equal(burst.reason,id==='lightningball'?'target':'proximity');assert.equal(hit.element,ELECTRIC);
  assert.equal(g.boss.hp,hp-(id==='lightningball'?LB.damage:ARC.damage));assert.equal(stop,false,id+' no hitstop');}
 const k=arena({skills:['lightningball']});k.setStartHP(100);assert.equal(k.command({...idle,skill:0}),true);const fx=run(k,70);
 assert.equal(k.bossDefeated,true);assert.equal(fx.find(f=>f.kind==='boss-defeated').killElement,ELECTRIC);assert.equal(k.phase,'village-exit');
});
test('12. a trial skill is not cancelled by an attack press (skill rule unchanged); the kit casts it on its own clip timing',()=>{
 for(const id of ['lightningball','arcdischarge']){const g=mount({kit:true,skills:[id]});quiet(g);assert.equal(g.command({...idle,skill:0}),true);
  const m=g.hero.motion;assert.equal(m.kind,'skill');assert.ok(Math.abs(m.hitAt-PINK_IAI.skill.hitAt)<1e-9);
  run(g,5);g.command({...idle,attack:true});assert.equal(g.hero.motion,m,id+' still the skill');
  const fx=run(g,40);assert.ok(fx.some(f=>f.kind===(id==='lightningball'?'elemental-launch':'elemental-throw')),id);}
});
