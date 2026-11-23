import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import path from 'node:path';import vm from 'node:vm';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI} from '../../src/lib/rpg-hero-kit-iai';
import {MOUNT_FORKS,BRANCH_IDS,nextSegment,sceneOf,type Segment} from '../../src/lib/rpg-mount-forks';
import zones from '../../src/lib/generated/mount-sunday-zones.json';
import '../../src/lib/training-client-kernel';
// K2-K4 (maintenance/run-structure-20261119, TECH_FEASIBILITY A-7): the three-way forks, opt-in by the boot `forks`.
// zone 2 (room 1) -> fork A -> a branch scene -> zone 3 (room 2); zone 5 (room 4) -> fork B -> a branch scene -> zone 6 (room 5).
const PRACTICE=['icespear','icenova','frostshot','stormcall','arc','spark'],SUPPORTS=[0,0,0,0,2,4];
function engine({preview=0,kit=null as any,skills=false,seed=7,forks=true}={}){const g:any=new MountSundayEngine(111,p,preview);if(kit)g.heroKit=kit;g.autoSkills=skills;
 if(skills)for(let i=0;i<6;i++){g.skillEnabled[i]=true;g.skillIds[i]=PRACTICE[i];g.skillSupportCounts[i]=SUPPORTS[i];}if(forks)g.enableForks(seed);return g;}
// Unity that loads at once: it reports the next scene as ready when there is one, else the current one.
const ready=(g:any)=>g.route?(g.nextScene()??g.room):Math.min(9,g.room+1);
const autoIn=(g:any)=>({x:0,y:0,auto:true,readyZone:ready(g),readyBoss:true});
const manIn=(g:any,x=0)=>({x,y:0,auto:false,readyZone:g.room});
function tick(g:any,input:any){g.acceptClientHints(input);g.step(.02,input);}
function until(g:any,pred:()=>boolean,input:(g:any)=>any,max=20000){for(let i=0;i<max&&!pred();i++)tick(g,input(g));assert.ok(pred(),'condition never met');}
// AUTO clears the zone, then the stick walks to the fork (AUTO off), so the fork waits for a button.
function toFork(g:any){until(g,()=>g.zoneKills===30,autoIn);assert.deepEqual(g.route.picks,{},'AUTO reached the fork with the last kill');until(g,()=>g.phase==='fork',g=>manIn(g,1));}

// ---- 1. no switch: golden digests (copied verbatim from test-hero-iai.ts; the constants are NOT edited here) ----
function noKitDigest(traversal?:any){
 const g:any=new MountSundayEngine(111,traversal);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';g.skillEnabled[1]=true;g.skillIds[1]='cleave';
 const h=createHash('sha256');
 for(let t=0;t<6000&&g.status==='playing';t++){
  const input={x:t%700<300?1:0,y:0,auto:t>=2500,readyZone:Math.min(9,g.room+1)};g.acceptClientHints(input);
  if(t%37===5)g.command({...input,attack:true});if(t%211===100)g.command({...input,dodge:true});if(t%313===200)g.command({...input,jump:true});
  if(t%401===300)g.command({...input,skill:0});if(t%457===150)g.command({...input,skill:1});if(t%503===50)g.command({...input,slide:true});
  g.step(.02,input);if(t%10===0)h.update(JSON.stringify(g.view()));
 }
 return h.digest('hex');
}
function noKitWide(){
 const g:any=new MountSundayEngine(111,p,8);for(let i=0;i<6;i++){g.skillEnabled[i]=true;g.skillIds[i]=PRACTICE[i];g.skillSupportCounts[i]=SUPPORTS[i];}
 const h=createHash('sha256');let boss=false;const actions=new Set<string>();
 for(let t=0;t<6000&&g.status==='playing';t++){
  const input={x:t%600<250?1:0,y:0,auto:t>=1500,readyZone:Math.min(9,g.room+1),readyBoss:true};g.acceptClientHints(input);
  if(t%41===3)g.command({...input,attack:true});if(t%173===60)g.command({...input,skill:Math.floor(t/173)%6});if(t%229===90)g.command({...input,dodge:true});
  g.step(.02,input);boss=boss||!!g.bossEncounter;actions.add(g.view().hero?.action);if(t%10===0)h.update(JSON.stringify(g.view()));
 }
 return {digest:h.digest('hex'),boss,room:g.room,actions:[...actions].sort()};
}
// Instant evade (2026-11-23): re-recorded like test-hero-iai.ts (same values, maintenance/evade-skillbar-20261123/tools/golden.mts).
const GOLDEN={plain:'832fa27b6f527434241fa7800bd8b1fff04044c015d1dc9fbf17b6c859ba6bf1',source:'259d5701367d4e3f5c79046467fc60098ebad0707b235ea9e6d1c02d61f741dc',
 wide:'77fe88b939452028c82d8dfb47b3d4da6f30939d3fc5801cabbe5b92d3877239'};
const ROUTE_KEYS=['segment','nextZone','forkRoute','forkSeed'];
const G:any=globalThis;
test('1. no forks switch: golden digests unchanged, no new snapshot or map keys, the 10-zone route as before',()=>{
 assert.equal(noKitDigest(),GOLDEN.plain,'plain');assert.equal(noKitDigest(p),GOLDEN.source,'source');const w=noKitWide();assert.equal(w.boss,true);assert.equal(w.digest,GOLDEN.wide,'wide');
 for(const preview of [0,1,4,9]){const g=engine({preview,forks:false});assert.equal(g.route,null);const v=g.view();for(const k of ROUTE_KEYS)assert.equal(k in v,false,k+' @'+preview);
  if(!g.bossEncounter)assert.equal('forks' in g.map,false);}
 // without forks zone 2 still goes straight on to zone 3 (room 2), no fork phase
 const g=engine({preview:1,forks:false});let fork=0;until(g,()=>g.room===2,g=>{fork+=g.phase==='fork'?1:0;return autoIn(g);});assert.equal(fork,0);
 // boot: only forks.enabled === true turns it on
 for(const forks of [undefined,{enabled:'yes',seed:3},{seed:3},true]){const v=JSON.parse(G.stageInitialize(JSON.stringify({mode:'mount',seed:111,traversalProfile:'source-run-v2',previewZone:1,referencePreview:true,...(forks===undefined?{}:{forks})})));
  for(const k of ROUTE_KEYS)assert.equal(k in v,false,k+' '+JSON.stringify(forks));assert.equal('forks' in v.map,false);}
 const on=JSON.parse(G.stageInitialize(JSON.stringify({mode:'mount',seed:111,traversalProfile:'source-run-v2',previewZone:1,referencePreview:true,forks:{enabled:true,seed:3}})));
 assert.deepEqual(on.segment,{kind:'zone',zone:1});assert.equal(on.nextZone,null,'the fork has not chosen yet');assert.equal(on.forkSeed,3);assert.equal(on.map.forks[0].id,'A');
});

function fullRun(opts:any){const g=engine(opts);let forkTicks=0,walk=0,killsAtBoss=-1;const scenes:number[]=[g.room];
 for(let t=0;t<40000&&!g.bossEncounter;t++){tick(g,autoIn(g));if(g.phase==='fork')forkTicks++;if(g.hero.motion?.kind==='fork-walk')walk++;if(!g.bossEncounter&&g.room!==scenes.at(-1))scenes.push(g.room);}
 killsAtBoss=g.kills;return {g,forkTicks,walk,killsAtBoss,scenes,route:g.view().forkRoute};}
test('2. both switches, AUTO zone 1 -> boss: 9 common zones + 2 branches = 330 kills, two forkRoute entries, fork phase <= 1 tick',()=>{
 const r=fullRun({kit:PINK_IAI,skills:true,seed:7});console.log(JSON.stringify({kills:r.killsAtBoss,forkTicks:r.forkTicks,walkTicks:r.walk,scenes:r.scenes,route:r.route}));
 assert.ok(r.g.bossEncounter,'boss reached');assert.equal(r.killsAtBoss,330);assert.equal(r.route.length,2);assert.deepEqual(r.route.map((x:any)=>x.fork),['A','B']);
 assert.ok(r.forkTicks<=1,'fork ticks '+r.forkTicks);assert.ok(r.walk>0);assert.equal(r.scenes.length,11,'11 mount segments');
 const v=r.g.view();assert.deepEqual(v.forkRoute,r.route,'the boss snapshot carries forkRoute');assert.deepEqual(v.segment,{kind:'zone',zone:9});assert.equal(v.routeZone,9);assert.equal(r.g.bossEncounter.autoSkills,true);
});

test('3. same seed = same branches; a few seeds give all three at both forks; the fork stream does not touch the spawns',()=>{
 const pick=(seed:number)=>{const g=engine({preview:1,seed});until(g,()=>g.route.taken.length===1&&g.room!==1,autoIn);return g.route.taken[0].id;};
 assert.equal(pick(5),pick(5));
 const seen={A:new Set<string>(),B:new Set<string>()};
 for(let seed=1;seed<=12;seed++){const g=engine({seed});for(const f of MOUNT_FORKS){g.route.segment={kind:'zone',zone:f.after};g.phase='fork';g.route.holdX=0;g.hero.x=-1e9;g.zoneKills=30;g.stepRoute({x:0,y:0,auto:true});seen[f.id].add(g.route.picks[f.id]);}}
 assert.deepEqual([...seen.A].sort(),['inner','middle','outer']);assert.deepEqual([...seen.B].sort(),['inner','middle','outer']);
 // spawns of zones 1-2 and the spawn random at the pick are the same for two fork seeds
 const trace=(seed:number)=>{const g=engine({seed}),mobs:string[]=[],ids=new Set<string>();let rngAtPick=0;for(let t=0;t<20000&&!g.route.picks.A;t++){const before=g.rng;tick(g,autoIn(g));for(const m of g.mobs){const id=g.room+':'+m.id;if(!ids.has(id)){ids.add(id);mobs.push(id+':'+m.x.toFixed(3)+':'+m.y.toFixed(3));}}if(g.route.picks.A)rngAtPick=before===g.rng?g.rng:-1;}return {mobs,rngAtPick};};
 const a=trace(1),b=trace(2);assert.ok(a.mobs.length>=60);assert.deepEqual(a.mobs,b.mobs);assert.equal(a.rngAtPick,b.rngAtPick);assert.notEqual(a.rngAtPick,-1,'the pick does not draw from the spawn random');
});

test('4. AUTO off: the fork waits (600 ticks, x held, dodge/jump too); a button picks; the walk; the branch scene; 30 kills; zone 3',()=>{
 const g=engine({preview:1});toFork(g);const hold=g.hero.x,fx=g.map.forks[0].x;assert.ok(hold>=fx-1e-9);assert.equal(g.view().phase,'fork');
 for(let t=0;t<600;t++){if(t%120===10)g.command({...manIn(g,1),dodge:true});if(t%120===70)g.command({...manIn(g,1),jump:true});if(t%15===3)g.command({...manIn(g,1),attack:true});tick(g,manIn(g,1));
  assert.equal(g.phase,'fork','@'+t);assert.ok(g.hero.x<=hold+1e-9,'held @'+t+' '+g.hero.x);}
 assert.equal(g.command({...manIn(g),fork:'left'}),false);assert.equal(g.command({...manIn(g),fork:'outer'}),true);assert.equal(g.command({...manIn(g),fork:'inner'}),false,'already chosen');
 assert.equal(g.view().nextZone,5,'the chosen scene is preloaded');
 until(g,()=>g.hero.motion?.kind==='fork-walk',g=>manIn(g));const m=g.hero.motion;assert.equal(g.hero.action,'run1');assert.equal(m.id,'outer');assert.equal(m.scene,5);assert.equal(m.fork,'A');
 const y0=g.hero.y;until(g,()=>g.elapsed-m.start>=m.duration,g=>manIn(g));assert.ok(g.hero.y<y0-300,'walked toward the camera (outer)');
 tick(g,manIn(g));assert.equal(g.phase,'waiting-next','scene 5 not ready yet');assert.equal(g.room,1);
 tick(g,{...manIn(g),readyZone:5});assert.equal(g.room,5);assert.equal(g.hero.motion,null);
 const v=g.view();assert.deepEqual(v.segment,{kind:'branch',fork:'A',id:'outer',scene:5,after:1});assert.equal(v.routeZone,1);assert.equal(v.zoneName,'갈림길 · 바깥쪽 길');
 assert.deepEqual(v.cleared,[0,1]);assert.deepEqual(v.visited,[0,1]);assert.equal(v.nextZone,2);assert.deepEqual(g.map.forks,[],'no fork at the end of a branch');assert.equal(v.zoneKills,0);
 until(g,()=>g.room!==5,autoIn);assert.equal(g.room,2);assert.deepEqual(g.view().segment,{kind:'zone',zone:2});assert.deepEqual(g.view().forkRoute,[{fork:'A',id:'outer',scene:5}]);assert.equal(g.kills,60);
});

test('5. the branch that re-uses scene 8 (fork B outer) leads to zone 6, not to the boss',()=>{
 const g=engine({preview:4});toFork(g);assert.equal(g.map.forks[0].id,'B');assert.equal(g.command({...manIn(g),fork:'outer'}),true);
 until(g,()=>g.room===8,autoIn);assert.equal(g.bossEncounter,null);until(g,()=>g.room!==8||!!g.bossEncounter,autoIn);
 assert.equal(g.bossEncounter,null,'no boss from scene 8 as a branch');assert.equal(g.room,5);assert.deepEqual(g.route.segment,{kind:'zone',zone:5});
});

test('6. ready signal: the current scene must be ready (loading before); only the current or the next scene number is taken',()=>{
 const g=engine({preview:1});tick(g,{x:0,y:0,auto:true});assert.equal(g.phase,'loading','zone 2 not ready');
 tick(g,{x:0,y:0,auto:true,readyZone:2});assert.equal(g.phase,'loading','2 is not the next scene while fork A waits');assert.equal(g.readyZone,-1);
 tick(g,{x:0,y:0,auto:true,readyZone:1});assert.notEqual(g.phase,'loading');
 toFork(g);g.command({...manIn(g),fork:'inner'});for(const n of [2,3,0,9,8])g.acceptClientHints({readyZone:n});assert.equal(g.readyZone,1,'wrong numbers refused');
 g.acceptClientHints({readyZone:7});assert.equal(g.readyZone,7,'the chosen scene');tick(g,{...manIn(g),readyZone:7});assert.notEqual(g.phase,'loading','current scene counts as ready when the next one is');
 until(g,()=>g.room===7,g=>({...manIn(g),readyZone:7}));
 for(const n of [8,3,1])g.acceptClientHints({readyZone:n});assert.equal(g.readyZone,7);g.acceptClientHints({readyZone:2});assert.equal(g.readyZone,2,'next = zone 3 (room 2), a jump back');
 g.readyZone=-1;tick(g,{x:0,y:0,auto:true});assert.equal(g.phase,'loading');
});

test('7. during the branch walk every other command is refused',()=>{
 const g=engine({preview:1,skills:true});toFork(g);g.command({...manIn(g),fork:'middle'});until(g,()=>g.hero.motion?.kind==='fork-walk',g=>manIn(g));
 for(const c of [{attack:true},{dodge:true},{jump:true},{slide:true},{skill:0},{potion:'health'},{potion:'mana'},{fork:'inner'}])assert.equal(g.command({...manIn(g),...c}),false,JSON.stringify(c));
 assert.equal(g.hero.motion.kind,'fork-walk');assert.equal(g.resources.potions.health,3);
 const x0=g.hero.x;tick(g,manIn(g,-1));assert.ok(g.hero.x>x0,'the stick does not turn the walk back');
});

test('8. kit on and off take the same route (same seed) and both reach the boss after 330 kills',()=>{
 const on=fullRun({kit:PINK_IAI,seed:11}),off=fullRun({seed:11});console.log(JSON.stringify({kitOn:on.route,kitOff:off.route}));
 assert.deepEqual(on.route,off.route);assert.equal(on.killsAtBoss,330);assert.equal(off.killsAtBoss,330);assert.deepEqual(on.scenes,off.scenes);
 // the walk carries no kit tag: the kit never handles it
 const g=engine({preview:1,kit:PINK_IAI});toFork(g);g.command({...manIn(g),fork:'inner'});until(g,()=>g.hero.motion?.kind==='fork-walk',g=>manIn(g));assert.equal('kit' in g.hero.motion,false);
});

test('9. branch paths keep off obstacles and stay on the terrain; no two consecutive segments share a scene',()=>{
 for(const f of MOUNT_FORKS){const g=engine({preview:f.after}),fork=g.map.forks[0],z:any=(zones as any)[f.after],t=z.terrain;assert.equal(fork.id,f.id);
  assert.ok(Math.abs(fork.x-(z.maxX-f.back))<1e-6);
  for(const b of fork.branches){assert.equal(b.points.length,f.branches[b.id as 'inner'].path.length+1);const el:number[]=[];
   for(let i=1;i<b.points.length;i++){const a=b.points[i-1],c=b.points[i];for(let s=0;s<=1;s+=.02){const x=a.x+(c.x-a.x)*s,y=a.y+(c.y-a.y)*s;
    for(const o of z.obstacles)assert.ok(Math.hypot(x-o.x,y-o.y)>o.radius+20,f.id+' '+b.id+' hits '+o.source);
    assert.ok(x/100>=t.originX&&x/100<=t.originX+(t.width-1)*t.step&&(y-5000)/100>=t.originZ&&(y-5000)/100<=t.originZ+(t.height-1)*t.step,f.id+' '+b.id+' off the terrain');el.push(g.groundAt(x,y));}}
   assert.ok(Math.max(...el)-Math.min(...el)<80,f.id+' '+b.id+' height span');assert.ok(c(b.points)>=550&&c(b.points)<=800,f.id+' '+b.id+' length '+c(b.points));}
  // the three branches part: their ends are at least 2.5 m apart
  const ends=fork.branches.map((b:any)=>b.points.at(-1));for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.hypot(ends[i].x-ends[j].x,ends[i].y-ends[j].y)>=250);}
 for(const a of BRANCH_IDS)for(const b of BRANCH_IDS){let s:Segment={kind:'zone',zone:0};const scenes=[0];for(let i=0;i<12;i++){const n=nextSegment(s,{A:a,B:b});if(!n||sceneOf(n)===9)break;scenes.push(sceneOf(n));s=n;}
  assert.equal(scenes.length,11,a+b);for(let i=1;i<scenes.length;i++)assert.notEqual(scenes[i],scenes[i-1],a+b+' '+scenes);
  // K1-fix (review K2-K4 §2): the scene before a segment is never the one after it either. A late ready hint for the
  // previous scene j must not read as "the next one is ready" when the next-but-one is j.
  for(let i=2;i<scenes.length;i++)assert.notEqual(scenes[i],scenes[i-2],a+b+' j = m at '+i+': '+scenes);}
 function c(pts:any[]){let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return l;}
});

test('10. the bundle (built in memory, same esbuild options; the Unity file is not written): two boot shapes match the source engine',async()=>{
 const repo=path.resolve('.'),req=createRequire(path.join(repo,'mini-services/poker-server/package.json'));
 const {outputFiles}=await req('esbuild').build({entryPoints:[path.join(repo,'src/lib/training-client-kernel.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',minify:true});
 const source=outputFiles[0].text,skills=PRACTICE.map((activeId,index)=>({supportIds:index<4?[]:index===4?['echo','elemental']:['echo','elemental','reach','quick'],enabled:true,activeId,trigger:null,index}));
 const shapes=[{name:'practice',boot:{mode:'mount',previewArena:false,seed:111,referencePreview:true,previewZone:1,traversalProfile:'source-run-v2',heroKit:'pink-iai',autoSkills:true,forks:{enabled:true,seed:5},build:{skills}},preview:1,kit:PINK_IAI,skills:true},
  {name:'session',boot:{mode:'mount',seed:111,traversalProfile:'source-run-v2',forks:{enabled:true,seed:5}},preview:0,kit:null,skills:false}];
 for(const s of shapes){const c:any=vm.createContext({});vm.runInContext(source,c);c.stageInitialize(JSON.stringify(s.boot));
  const g=engine({preview:s.preview,kit:s.kit,skills:s.skills,seed:5});let picked=false;
  for(let t=0;t<4500;t++){const input=autoIn(g);const a=JSON.parse(c.stageAdvance(JSON.stringify({steps:1,input,commands:[],snapshot:true})));tick(g,input);picked||=!!g.route.picks.A;
   if(t%50===0||t===4499){const v=JSON.parse(JSON.stringify(g.view()));for(const k of ['hero','mobs','room','phase','segment','nextZone','forkRoute','zoneKills','resources'])assert.deepEqual(a[k],v[k],s.name+' '+k+' @'+t);}}
  if(s.name==='practice')assert.ok(picked,'the practice run reaches fork A');}
});
