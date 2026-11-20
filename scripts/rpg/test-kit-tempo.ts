import test from 'node:test';import assert from 'node:assert/strict';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI,IAI_MEASURED,iaiCanReach,clipAt,ageAt,rowClipMap,recoverClipMap} from '../../src/lib/rpg-hero-kit-iai';
import '../../src/lib/training-client-kernel';
// K6 (2026-11-19, maintenance/run-structure-20261119/BRIEF_gameplay-dev_K6_attack_tempo_KO.md): kit tempo stages.
// Stage 0 = the trial timing (pinned in test-hero-iai.ts on its KIT0 copy and by the kit golden); the default is stage 1.
// Expected kernel times below are computed here from the table (independent of the kit's map code).
const idle={x:0,y:0,auto:false};
const near=(a:number,b:number,tol=1e-6,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} != ${b} (±${tol})`);
type Stage=0|1|2;
function make(stage?:Stage){const g:any=new MountSundayEngine(111,p);g.heroKit=PINK_IAI;if(stage!==undefined)assert.equal(g.setKitTempo(stage),true);g.groundAt=()=>0;g.hero.elevation=0;g.readyZone=0;g.spawned=30;g.mobs=[];return g;}
function slime(g:any,dx:number,id=1){const m:any={id,species:1003,room:0,x:g.hero.x+dx,y:g.hero.y,elevation:0,hp:100000,maxHP:100000,radius:12.5,bodyHeight:31,state:'idle',nextAttack:999,facing:-1};g.mobs.push(m);return m;}
function until(g:any,pred:()=>boolean,input:any=idle,max=900){let t=0;for(let i=0;i<max&&!pred();i++){g.step(.02,input);t+=.02;}assert.ok(pred(),'condition never met');return t;}
function steps(g:any,n:number,input:any=idle){for(let i=0;i<n;i++)g.step(.02,input);}
const R=PINK_IAI.rows,K=PINK_IAI.recover,T=(s:Stage)=>PINK_IAI.tempo.stages[s];
// kernel age of a row clip time / a recover clip time at a stage (straight from the table: windup, active, recovery, sheathe)
function rowAge(row:'iai1'|'iai2'|'iai3',s:Stage,c:number){const r=R[row],t=T(s);
 return c<=r.activeFrom?c/t.windup:c<=r.activeTo?r.activeFrom/t.windup+(c-r.activeFrom)/t.active:r.activeFrom/t.windup+(r.activeTo-r.activeFrom)/t.active+(c-r.activeTo)/t.recovery;}
function recAge(s:Stage,c:number){const t=T(s);return c<=K.sheathe?c/t.sheathe:K.sheathe/t.sheathe+(c-K.sheathe);}
const STAGES:Stage[]=[0,1,2];
const sum=(a:ReadonlyArray<{cm:number}>)=>a.reduce((s,x)=>s+x.cm,0);
// g.fx keeps recent events only (old ones drop out over a chain), so damage events are gathered every tick.
// A contact is stamped in the tick that finds it: never later than that tick, never before the previous one.
function damage(g:any,into:Map<number,any>){for(const f of g.fx)if(f.kind==='damage'&&!into.has(f.id)){
 assert.ok(f.contactAt<=g.elapsed+1e-9&&f.contactAt>=g.elapsed-.02-1e-9,'contactAt '+f.contactAt+' in the tick ending '+g.elapsed);into.set(f.id,f);}return [...into.values()];}

test('1. stages: 0 = all 1.0, default 1, the table is frozen; stage 0 motions carry no clip map, stage 1/2 do',()=>{
 assert.equal(PINK_IAI.switches.tempo,1,'default stage');assert.equal(PINK_IAI.tempo.stages.length,3);
 assert.deepEqual(PINK_IAI.tempo.stages[0],{windup:1,active:1,recovery:1,sheathe:1});
 assert.deepEqual(PINK_IAI.tempo.stages[1],{windup:1.5,active:1,recovery:1.4,sheathe:1.5});
 assert.deepEqual(PINK_IAI.tempo.stages[2],{windup:2,active:1,recovery:1.8,sheathe:2});
 assert.ok(Object.isFrozen(PINK_IAI.tempo.stages[1]));
 for(const s of STAGES){const g=make(s);g.command({...idle,attack:true});const m=g.hero.motion;
  if(s===0){assert.equal('clipMap' in m,false);assert.equal('tempoStage' in m,false);}else{assert.equal(m.tempoStage,s);assert.ok(Array.isArray(m.clipMap));}}
 const d=make();d.command({...idle,attack:true});assert.equal(d.hero.motion.tempoStage,1,'no override = stage 1');
 assert.equal(make().setKitTempo(3),false);assert.equal(make().setKitTempo(1.5),false);assert.equal(make().setKitTempo('2'),false);
 const nk:any=new MountSundayEngine(111,p);assert.equal(nk.setKitTempo(1),false,'no kit: nothing to set');assert.equal(nk.command({...idle,kitTempo:1}),false);
});

test('2. command {kitTempo} applies from the next row; boot kitTempo selects the stage; a bad boot value keeps the default',()=>{
 const g=make(2);g.command({...idle,attack:true});const m1=g.hero.motion,map1=JSON.stringify(m1.clipMap),d1=m1.duration;assert.equal(m1.tempoStage,2);
 assert.equal(g.command({...idle,kitTempo:0}),true);assert.equal(g.hero.motion,m1,'the running row is kept');assert.equal(m1.tempoStage,2);
 steps(g,2);assert.equal(JSON.stringify(g.hero.motion.clipMap),map1,'its map is kept');assert.equal(g.hero.motion.duration,d1);
 steps(g,8);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai2');assert.equal('clipMap' in g.hero.motion,false,'next row at stage 0');
 const G:any=globalThis,boot=(extra:any)=>G.stageInitialize(JSON.stringify({mode:'mount',seed:111,traversalProfile:'source-run-v2',heroKit:'pink-iai',...extra}));
 const adv=(commands:any[])=>JSON.parse(G.stageAdvance(JSON.stringify({steps:1,input:{x:0,y:0,auto:false,readyZone:0},commands,snapshot:true})));
 for(const [extra,want] of [[{kitTempo:2},2],[{kitTempo:0},0],[{},1],[{kitTempo:7},1],[{kitTempo:'1'},1]] as const){boot(extra);const v=adv([{attack:true}]);
  assert.equal(v.hero.action,'iai1');assert.equal(v.hero.motion.tempoStage??0,want,JSON.stringify(extra));}
 boot({kitTempo:2});adv([{kitTempo:0}]);const v=adv([{attack:true}]);assert.equal('clipMap' in v.hero.motion,false,'command through the bundle entry');
});

test('3. timing per stage: hit, next-row start and sheathe end move by the table factors (kernel seconds)',()=>{
 const table:any={};
 for(const s of STAGES){const row:any={};
  // iai1 from idle: hitAt / duration on the motion, the contact on a standing slime, the saved next press at cancelAt
  // contacts first, on a standing slime (each row's own start; the hitstop then delays the hand-over, so times are taken below)
  {const h=make(s),sl=slime(h,60);h.command({...idle,x:1,attack:true});const starts:any={},got=new Map<number,any>();
   for(let i=0;i<300&&h.hero.action!=='iai_recover';i++){const m=h.hero.motion;starts[m.attackId]??={row:m.row,start:m.start};h.step(.02,idle);damage(h,got);h.command({...idle,attack:true});}
   const hits=damage(h,got);assert.equal(hits.length,3);assert.equal(sl.hp,100000-60-60-105,'all three rows landed');
   for(const f of hits){const st=starts[f.attackId],r=R[st.row as 'iai1'],at=f.contactAt-st.start;
    assert.ok(at>=rowAge(st.row,s,r.activeFrom)-1e-9&&at<=rowAge(st.row,s,r.activeTo)+1e-9,st.row+' contact in the window '+at);row[st.row+'Contact']=+at.toFixed(3);}}
  const g=make(s);g.command({...idle,x:1,attack:true});const m1=g.hero.motion,e1=g.elapsed;
  near(m1.hitAt,rowAge('iai1',s,R.iai1.activeFrom),1e-9,'iai1 hitAt');near(m1.duration,rowAge('iai1',s,R.iai1.duration),1e-9,'iai1 duration');
  // timing on empty ground (no hitstop): presses every tick, taken at inputFrom, the next row at the cancel point
  for(let i=0;i<200&&g.hero.action==='iai1';i++){g.step(.02,idle);g.command({...idle,attack:true});}
  assert.equal(g.hero.action,'iai2');const e2=g.hero.motion.start,cut1=e2-e1;
  assert.ok(cut1>=rowAge('iai1',s,R.iai1.cancelAt!)-1e-9&&cut1<=rowAge('iai1',s,R.iai1.cancelAt!)+.02+1e-9,'iai2 at the iai1 cancel point '+cut1);
  const m2=g.hero.motion;near(m2.hitAt,rowAge('iai2',s,R.iai2.activeFrom),1e-9);
  for(let i=0;i<200&&g.hero.action==='iai2';i++){g.step(.02,idle);g.command({...idle,attack:true});}
  assert.equal(g.hero.action,'iai3');const m3=g.hero.motion,e3=m3.start,cut2=e3-e2;
  assert.ok(cut2>=rowAge('iai2',s,R.iai2.cancelAt!)-1e-9&&cut2<=rowAge('iai2',s,R.iai2.cancelAt!)+.02+1e-9,'iai3 at the iai2 cancel point '+cut2);
  near(m3.hitAt,rowAge('iai3',s,R.iai3.activeFrom),1e-9);near(m3.duration,rowAge('iai3',s,R.iai3.duration),1e-9);
  until(g,()=>g.hero.action==='iai_recover');
  const rec=g.hero.motion,r0=g.elapsed;near(rec.sheatheAt,recAge(s,K.sheathe),1e-9);near(rec.duration,recAge(s,K.duration),1e-9);
  near(rec.moveReleaseAt,recAge(s,K.moveReleaseAt),1e-9);near(rec.grace,0,0,'iai3 has no grace');
  // a press during the sheathe starts iai1 on the first tick past the (faster) sheathe end
  g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai1');const sheathed=g.elapsed;
  assert.ok(sheathed-r0>=rec.sheatheAt-1e-9&&sheathed-r0<=rec.sheatheAt+.02+1e-9,'iai1 at the sheathe end '+(sheathed-r0));
  row.iai1PressToHit=+m1.hitAt.toFixed(3);row.iai2StartToHit=+m2.hitAt.toFixed(3);row.iai3StartToHit=+m3.hitAt.toFixed(3);
  row.row1ToRow2=+cut1.toFixed(3);row.row2ToRow3=+cut2.toFixed(3);row.iai3Length=+m3.duration.toFixed(3);row.sheathe=+rec.sheatheAt.toFixed(3);
  row.threeCutsToSheathed=+(sheathed-e1).toFixed(3);row.iai3EndToRecoverStart=+(r0-e3).toFixed(3);table['stage'+s]=row;}
 console.log(JSON.stringify({K6timing:table}));
 // stage 0 is the trial timing (REPORT_K5 / hero-iai): iai2 at 0.52, iai3 at 0.40 after it
 near(table.stage0.row1ToRow2,.52,1e-6);near(table.stage0.row2ToRow3,.40,1e-6);
 assert.ok(table.stage1.threeCutsToSheathed<table.stage0.threeCutsToSheathed&&table.stage2.threeCutsToSheathed<table.stage1.threeCutsToSheathed);
});

test('4. the advance distance does not depend on the stage (whole rows and the sheathe step exactly; a chain within one tick of clip)',()=>{
 const out:any={};
 for(const s of STAGES){const g=make(s);g.hero.x+=400;const x0=g.hero.x;g.command({...idle,x:1,attack:true});until(g,()=>g.hero.action!=='iai1');
  near(g.hero.x-x0,sum(IAI_MEASURED.rows.iai1.advance),1e-6,'iai1 whole, stage '+s);const r0=g.hero.x;until(g,()=>g.hero.action!=='iai_recover');near(g.hero.x-r0,-5.17,1e-6,'sheathe step, stage '+s);
  // iai2 whole (no third press) and iai3 whole
  const c=make(s);c.hero.x+=400;c.command({...idle,x:1,attack:true});steps(c,Math.ceil(rowAge('iai1',s,R.iai1.inputFrom!)/.02)+1);assert.equal(c.command({...idle,attack:true}),true);
  until(c,()=>c.hero.action==='iai2');const a2=c.hero.x;until(c,()=>c.hero.action!=='iai2');assert.equal(c.hero.action,'iai_recover');near(c.hero.x-a2,sum(IAI_MEASURED.rows.iai2.advance),1e-6,'iai2 whole, stage '+s);
  const d=make(s);d.hero.x+=400;const d0=d.hero.x;d.command({...idle,x:1,attack:true});
  for(let i=0;i<300&&d.hero.action!=='iai3';i++){d.step(.02,idle);d.command({...idle,attack:true});}const a3=d.hero.x;until(d,()=>d.hero.action!=='iai3');
  near(d.hero.x-a3,sum(IAI_MEASURED.rows.iai3.advance),1e-6,'iai3 whole, stage '+s);out['stage'+s]={chainForwardCm:+(d.hero.x-d0).toFixed(3)};}
 console.log(JSON.stringify({K6chainForward:out}));
 // a chained row is cut on the first tick past its cancel point: the clip overshoot (and so the travel to it) depends on the tick
 for(const s of [1,2])near(out['stage'+s].chainForwardCm,out.stage0.chainForwardCm,1.5,'chain travel stage '+s);
});

test('5. contact is not lost: AUTO reach agrees with a real press at every stage; a standing slime takes all three rows',()=>{
 for(const s of [1,2] as Stage[]){let lastTrue=-1;
  for(let dx=30;dx<=260;dx+=5){const probe=make(s),sp=slime(probe,dx),reach=iaiCanReach(probe.kitHost(),PINK_IAI,sp);
   const g=make(s),t:any=slime(g,dx);t.frozenUntil=1e9;g.command({...idle,x:1,attack:true});until(g,()=>g.hero.action!=='iai1');
   assert.equal(reach,t.hp<100000,'stage '+s+' dx '+dx);if(reach)lastTrue=dx;}
  assert.ok(lastTrue>=150,'stage '+s+' reach edge '+lastTrue);}
 // slimes at several distances in front: the full chain (pressed as soon as it is taken) lands every row at every stage
 const seen:any={};
 for(const dx of [40,45,60,90,110])for(const s of STAGES){const g=make(s),sl:any=slime(g,dx);sl.frozenUntil=1e9;g.command({...idle,x:1,attack:true});const got=new Map<number,any>();
  for(let i=0;i<300&&g.hero.action!=='iai_recover';i++){g.step(.02,idle);damage(g,got);g.command({...idle,attack:true});}
  const rows=damage(g,got).map((f:any)=>f.definitionId.slice(9));seen[dx+' stage'+s]=rows.join('+');
  assert.deepEqual(rows,['iai1','iai2','iai3'],'stage '+s+' dx '+dx);}
 console.log(JSON.stringify({K6contact:seen}));
});

test('6. display map: monotonic, ends on the clip end; the timeline and hitAt sit on the same map; the clip never runs back',()=>{
 for(const s of [1,2] as Stage[]){
  for(const row of ['iai1','iai2','iai3'] as const){const map=rowClipMap(R[row],T(s))!;const r=R[row];
   assert.deepEqual(map[0],[0,0]);for(let i=1;i<map.length;i++){assert.ok(map[i][0]>map[i-1][0]&&map[i][1]>map[i-1][1],'monotonic');}
   near(map.at(-1)![0],rowAge(row,s,r.duration),1e-12);near(map.at(-1)![1],r.duration,1e-12);
   for(const c of [0,.05,r.activeFrom,(r.activeFrom+r.activeTo)/2,r.activeTo,r.duration])near(clipAt(map,ageAt(map,c)),c,1e-12,'round trip');}
  const rm=recoverClipMap(K,T(s))!;near(rm.at(-1)![1],K.duration,1e-12);near(clipAt(rm,recAge(s,K.sheathe)),K.sheathe,1e-12);
  // a real chain against a slime (hitstops included): per motion, the mapped clip is non-decreasing and reaches the clip end
  const g=make(s);slime(g,60);g.command({...idle,x:1,attack:true});let cur:any=null,last=-1;const got=new Map<number,any>();
  for(let i=0;i<400&&g.hero.action!=='stay1';i++){g.step(.02,idle);damage(g,got);if(g.hero.motion?.kind==='attack')g.command({...idle,attack:true});const m=g.hero.motion;if(!m)break;
   if(m!==cur){cur=m;last=-1;near(clipAt(m.clipMap,m.duration),m.kind==='attack'?R[m.row as 'iai1'].duration:K.duration,1e-9,'the motion end maps to the clip end');}
   const c=clipAt(m.clipMap,g.elapsed-m.start);assert.ok(c>=last-1e-9,'clip runs back');last=c;
   if(m.kind==='attack'){const tl=m.timeline.active[0];near(clipAt(m.clipMap,tl.from*m.duration),R[m.row as 'iai1'].activeFrom,1e-9,'timeline.from');near(clipAt(m.clipMap,tl.to*m.duration),R[m.row as 'iai1'].activeTo,1e-9,'timeline.to');
    near(clipAt(m.clipMap,m.hitAt),R[m.row as 'iai1'].activeFrom,1e-9,'hitAt');if(m.timeline.cancelFrom<1)near(clipAt(m.clipMap,m.timeline.cancelFrom*m.duration),R[m.row as 'iai1'].cancelAt!,1e-9,'cancelFrom');}}
  assert.equal(damage(g,got).length,3,'three row hits');}
});

test('6b. the combo grace after rows 1-2 is on the recover clock: a press just inside it chains, just after it waits for the sheathe',()=>{
 for(const s of STAGES){const grace=recAge(s,R.iai1.grace);
  for(const [late,want] of [[false,'iai2'],[true,'iai_recover']] as const){const g=make(s);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');
   near(g.hero.motion.grace,grace,1e-9,'stage '+s);const r0=g.hero.motion.start;until(g,()=>g.elapsed-r0>=(late?grace+.005:grace-.025));
   assert.ok(g.command({...idle,attack:true}));assert.equal(g.hero.action,want,'stage '+s+(late?' after':' inside')+' the grace');}}
});

test('7. hitstop length stays in kernel seconds at every stage',()=>{
 for(const s of STAGES){const g=make(s),sl:any=slime(g,60);g.command({...idle,attack:true});until(g,()=>g.fx.some((f:any)=>f.kind==='damage'));
  const m=g.hero.motion,e=g.elapsed;near(m.hitstopUntil,e+.08,1e-9,'stage '+s);near(sl.frozenUntil,e+.08,1e-9);
  const c0=clipAt(m.clipMap??null,g.elapsed-m.start);for(let i=0;i<4;i++){g.step(.02,idle);near(clipAt(m.clipMap??null,g.elapsed-m.start),c0,1e-9,'frozen');}}
});

test('8. with K5 (button skill cut), K1 (AUTO skills) and the forks on: stage 1 and 2 run; AUTO cuts no row',()=>{
 for(const s of [1,2] as Stage[]){
  const g=make(s);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';slime(g,60);g.command({...idle,attack:true});steps(g,4);
  assert.equal(g.hero.action,'iai1');assert.equal(g.command({...idle,skill:0}),true);assert.equal(g.hero.motion.kind,'cancel');steps(g,2);assert.equal(g.hero.action,'skill2');
  const r:any=new MountSundayEngine(111,p);r.heroKit=PINK_IAI;r.setKitTempo(s);r.autoSkills=true;r.enableForks(111);r.skillEnabled[0]=true;r.skillIds[0]='icespear';r.skillEnabled[1]=true;r.skillIds[1]='stormcall';
  let rowCuts=0,casts=0,last:any=null;
  for(let t=0;t<30000&&r.room<3&&r.status==='playing';t++){const i={x:0,y:0,auto:true,readyZone:r.nextScene()??r.room,readyBoss:true};r.acceptClientHints(i);const m=r.hero.motion;r.step(.02,i);const n=r.hero.motion;
   if(m?.kit&&m.kind==='attack'&&n!==m&&(n?.kind==='cancel'||n?.kind==='skill'))rowCuts++;if(n?.kind==='skill'&&n!==last)casts++;last=n;}
  console.log(JSON.stringify({K6together:{stage:s,room:r.room,forkRoute:r.view().forkRoute,casts,rowCuts,elapsed:+r.elapsed.toFixed(2)}}));
  assert.ok(r.room>=3,'past fork A');assert.ok(r.route.picks.A,'fork A picked by AUTO');assert.ok(casts>0);assert.equal(rowCuts,0);}
});
