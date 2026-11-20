import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI,IAI_MEASURED,IAI_K,heroKitFor,iaiContact,iaiCanReach} from '../../src/lib/rpg-hero-kit-iai';
// Opt-in hero kit `pink-iai` (maintenance/rev2-android-port-20261119, PORT_PLAN E-3). Times are the trial scene's
// seconds; distances are trial metres x k = 0.678. No kit = the engine must not change by a single tick.
const idle={x:0,y:0,auto:false};
const near=(a:number,b:number,tol=1e-6,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} != ${b} (±${tol})`);
function make(kit:any=PINK_IAI){const g:any=new MountSundayEngine(111,p);if(kit)g.heroKit=kit;g.groundAt=()=>0;g.hero.elevation=0;g.readyZone=0;g.spawned=30;g.mobs=[];return g;}
function slime(g:any,dx:number,id=1){const m={id,species:1003,room:0,x:g.hero.x+dx,y:g.hero.y,elevation:0,hp:100000,maxHP:100000,radius:12.5,bodyHeight:31,state:'idle',nextAttack:999,facing:-1};g.mobs.push(m);return m;}
// Steps until pred() is true; returns the seconds stepped.
function until(g:any,pred:()=>boolean,input:any=idle,max=600){let t=0;for(let i=0;i<max&&!pred();i++){g.step(.02,input);t+=.02;}assert.ok(pred(),'condition never met');return t;}
function steps(g:any,n:number,input:any=idle){for(let i=0;i<n;i++)g.step(.02,input);}
const clip=(g:any)=>g.elapsed-g.hero.motion.start;
// K6 (2026-11-19): the kit's default tempo became stage 1 (faster wind-up and recovery). Tests that pin the trial timing
// (kernel seconds = clip seconds) run on this stage-0 copy with their values unchanged; the stage-1/2 expectations are in
// test-kit-tempo.ts. Each test moved here is listed in REPORT_K6 (before: make() / PINK_IAI, after: make(KIT0) / KIT0).
const KIT0={...PINK_IAI,switches:{...PINK_IAI.switches,tempo:0}};

// --- digest of the engine without a kit, recorded on the source BEFORE the kit was added (HEAD 8e4ccfd2) ---------------
// These constants are NOT to be edited to make a failing run pass: a mismatch means the no-kit engine changed.
// If the no-kit engine is changed ON PURPOSE (a reviewed change to the default rules), re-record them from a source copy
// that has that change, never from a run that may already be wrong:
//  1. git archive <commit with the intended change> src | tar -x -C <work folder>/head   (a work folder on G:, outside the repo)
//  2. copy noKitDigest / noKitWide below verbatim into a script that imports MountSundayEngine and SOURCE_TRAVERSAL
//     from <work folder>/head/src/lib/ (example: maintenance/rev2-android-port-20261119/work/gameplay-dev-3a2/golden_wide.mts)
//  3. node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs <script> head  -> paste the printed hex
//     here and name the commit in this comment. The same script with `tree` must print the same values.
// plain/source: recorded on HEAD 8e4ccfd2 (3a). wide: recorded on HEAD 8e4ccfd2 (3a-2), equal on the 3a-2 working tree.
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
// Practice loadout (water 1-3, lightning 1-3 with 0/0/0/0/2/4 linked supports), start zone 9, AUTO, into the zone-10 boss:
// covers water-ring, the variant 2/3 lightning radii and the boss hand-over, which noKitDigest does not reach.
const PRACTICE=['icespear','icenova','frostshot','stormcall','arc','spark'],SUPPORTS=[0,0,0,0,2,4];
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
const GOLDEN={plain:'38e305be44aea585ef166145cd09188061fabc0e94a93688dc847a66960fa87f',source:'de2ec4b88f2c7939a20c996516a92eec5778a14e5b4bbda640be484e2ad2c2ca',
 wide:'b8f7739211a94f0d65043299e0f4a606a67f6fa1a0be707b0bff1f29ec4c0a92'};
test('no kit: the engine is tick-for-tick the pre-kit engine (golden digest of 6000 ticks)',()=>{
 assert.equal(noKitDigest(),GOLDEN.plain,'default traversal');assert.equal(noKitDigest(p),GOLDEN.source,'source-run-v2');
 const g:any=new MountSundayEngine(111,p);assert.equal(g.heroKit,undefined);assert.equal('heroKit' in g.view(),false);
});
test('no kit: practice loadout from zone 9 into the boss is the pre-kit engine too (golden digest)',()=>{
 const w=noKitWide();assert.equal(w.boss,true,'reaches the zone-10 boss');assert.equal(w.digest,GOLDEN.wide);
});

// --- kit-path golden (K1-fix, review K5 §3) --------------------------------------------------------------------------
// Kit on (pink-iai), no autoSkills/forks switches, practice six equipped but NO skill presses (attack every 41 ticks, dodge
// every 229, stick, AUTO from tick 1500), 6000 ticks. Same input script as the review's probe.mts kitDigest(false).
// Recorded 2026-11-19 from source copies before K1 (tech-director-review/preK1), before K5 (preK5) and on the tree after
// K1-fix: all four equal (work/gameplay-dev-K1fix/kit_golden.mts). Not to be edited to make a run pass; a mismatch means a
// kit change reached runs without skill presses. Re-record only for a reviewed kit change, from a source copy, as above.
function kitNoSkillDigest(){
 // K6: the golden is the stage-0 kit (KIT0, the trial timing); before K6 this was PINK_IAI (whose default was then stage 0).
 const g:any=new MountSundayEngine(111,p);g.heroKit=KIT0;for(let i=0;i<6;i++){g.skillEnabled[i]=true;g.skillIds[i]=PRACTICE[i];}
 const h=createHash('sha256');
 for(let t=0;t<6000&&g.status==='playing';t++){
  const input={x:t%600<250?1:0,y:0,auto:t>=1500,readyZone:Math.min(9,g.room+1),readyBoss:true};g.acceptClientHints(input);
  if(t%41===3)g.command({...input,attack:true});if(t%229===90)g.command({...input,dodge:true});
  g.step(.02,input);if(t%10===0)h.update(JSON.stringify(g.view()));
 }
 return {digest:h.digest('hex'),room:g.room,kills:g.kills};
}
// T1 (2026-11-19, user-approved method A: activeFrom moved to the visible cut, contact sampling >= 32 points per window):
// re-recorded with vfx-basic-attack-20261119/qa_T1/work/golden/kit_golden_T1.mts (this function verbatim). The pre-T1 copy
// (backup_before_T1/srclib_copy) still prints the old value fd64fe03... (room 2, kills 90), the T1 tree and a source copy of
// it (qa_T1/work/golden/src_T1b, iai3 window from F(32)) both printed 3910ad9f... (room 3, kills 96); tech-director ACCEPT.
// T1b (iai2 window from F(18)): same script (qa_T1b/work/golden). The T1 copy (backup_before_T1b/srclib_copy) still prints
// 3910ad9f..., the T1b tree and its source copy (qa_T1b/work/golden/src_T1b2) print the value below (room 3, kills 90). The
// two same-result changes in stepRow alone keep 3910ad9f at stage 0 and the T1 digests at stages 1 and 2.
const KIT_GOLDEN={noSkills:'782d84d8a7cf1101478cf9e1777af633b3c5c1f3e17a614326147202f28d4543'};
test('kit on, no skill presses: the kit path is the recorded one (kit golden digest of 6000 ticks)',()=>{
 const k=kitNoSkillDigest();assert.equal(k.room,3);assert.equal(k.kills,90);assert.equal(k.digest,KIT_GOLDEN.noSkills);
});

test('kit table holds the E-3 times and the k-converted distances in one measured block',()=>{
 assert.equal(PINK_IAI.id,'pink-iai');assert.equal(heroKitFor('pink-iai'),PINK_IAI);assert.equal(heroKitFor(undefined),undefined);assert.equal(heroKitFor('x'),undefined);
 near(IAI_K,.678);const r=PINK_IAI.rows;near(PINK_IAI.entry,.12);
 // T1: activeFrom = the clip frame where the blade comes in front (was the trial hit start ENTRY+F(10) / F(11) / F(23)).
 near(r.iai1.duration,.12+32/60,1e-9,'iai1');near(r.iai1.activeFrom,.12+18/60);near(r.iai1.activeTo,.12+21/60);near(r.iai1.inputFrom,.12+2/60);near(r.iai1.cancelAt,.12+23/60);near(r.iai1.grace,.25);
 near(r.iai2.duration,33/60);near(r.iai2.activeFrom,18/60);near(r.iai2.activeTo,20/60);near(r.iai2.inputFrom,2/60);near(r.iai2.cancelAt,23/60);near(r.iai2.grace,.25);
 near(r.iai3.duration,54/60);near(r.iai3.activeFrom,32/60);near(r.iai3.activeTo,36/60);assert.equal(r.iai3.next,null);near(r.iai3.grace,0);
 near(r.iai1.hitstop,.08);near(r.iai2.hitstop,.08);near(r.iai3.hitstop,.14);near(PINK_IAI.skill.hitstop,.20);
 assert.deepEqual([r.iai1.damage,r.iai2.damage,r.iai3.damage],[60,60,105]);
 near(PINK_IAI.recover.sheathe,56/60);near(PINK_IAI.recover.hold,.35);near(PINK_IAI.recover.release,.45);near(PINK_IAI.recover.duration,56/60+.35+.45);
 // measured totals (bake/measure.json travelRemovedGame_m x 100): 50.7 / 0.88 / 52.6 cm, recover -5.17 cm
 const adv=(k:'iai1'|'iai2'|'iai3')=>IAI_MEASURED.rows[k].advance.reduce((s,a)=>s+a.cm,0);
 near(adv('iai1'),50.70,.011);near(adv('iai2'),.88,.011);near(adv('iai3'),52.60,.011);near(IAI_MEASURED.recover.advance.reduce((s,a)=>s+a.cm,0),-5.17,1e-9);
 assert.equal(PINK_IAI.recover.advance,IAI_MEASURED.recover.advance);
 // advance segments lie inside the row and never straddle the kernel active window (the before/inside/after sums stay exact)
 for(const [k,row] of Object.entries(r))for(const a of row.advance){assert.ok(a.from>=0&&a.to<=row.duration+1e-9&&a.from<a.to,k);
  for(const e of [row.activeFrom,row.activeTo])assert.ok(!(a.from<e-1e-9&&a.to>e+1e-9),k+' segment straddles '+e);}
 // measured contact: reach far end = tip forward max, height = tip+guard band (measure.json); sweep/width are design values
 assert.deepEqual([r.iai1.contact.reach,r.iai2.contact.reach,r.iai3.contact.reach],[[20,137.2],[20,114.3],[20,91.5]]);
 assert.deepEqual([r.iai1.contact.height,r.iai2.contact.height,r.iai3.contact.height],[[25.9,101.2],[9.3,182.6],[42.4,118.6]]);
 for(const row of Object.values(IAI_MEASURED.rows))assert.deepEqual(Object.keys(row.contact).sort(),['height','reach'],'sweep/width are not in the measured block');
 assert.deepEqual([r.iai1.contact.sweep,r.iai2.contact.sweep,r.iai3.contact.sweep,r.iai1.contact.width],[[-60,60],[45,-45],[100,-100],9]);
 near(PINK_IAI.switches.heightFloor as number,-40);
 const st=PINK_IAI.skill.overrides['storm-call'];assert.deepEqual([st.reach,st.radius,st.ahead],[407,163,88]);assert.equal('ahead' in PINK_IAI.skill,false,'ahead is storm-call only');
 near(PINK_IAI.skill.duration,58/60);near(PINK_IAI.skill.hitAt,28/60);
 // no per-frame trajectory is carried: only a few spec numbers per row
 for(const row of Object.values(IAI_MEASURED.rows)){assert.ok(row.advance.length<=5,'a few advance segments');/* T1b: iai2 has 5 (its back step is cut at the window start F(18)) */for(const v of Object.values(row.contact))assert.ok(typeof v==='number'||(Array.isArray(v)&&v.length===2),'contact holds spec numbers only');}
 assert.ok(IAI_MEASURED.recover.advance.length<=2);
 // the module tables are frozen (one shared object per bundle)
 for(const o of [PINK_IAI,PINK_IAI.switches,PINK_IAI.rows.iai1,PINK_IAI.rows.iai1.contact,PINK_IAI.rows.iai1.advance,PINK_IAI.skill.overrides['storm-call'],IAI_MEASURED.recover.advance[0]])assert.ok(Object.isFrozen(o));
});

test('iai1 from idle includes the 0.12 s ready entry; the chain ends in iai_recover then stay1',()=>{
 const g=make(KIT0),e0=g.elapsed;assert(g.command({...idle,attack:true}));const m=g.hero.motion;
 assert.equal(g.hero.action,'iai1');assert.equal(m.kind,'attack');assert.equal(m.kit,'pink-iai');near(m.clipFrom,0);near(m.start,e0);near(m.duration,.12+32/60);
 const t1=until(g,()=>g.hero.action!=='iai1');near(t1,.66,1e-6,'iai1 ends on the first tick past 0.653 s');
 assert.equal(g.hero.action,'iai_recover');assert.equal(g.hero.motion.kind,'recover');near(g.hero.motion.duration,56/60+.8);
 const t2=until(g,()=>g.hero.action!=='iai_recover');near(t2,1.74,1e-6,'recover ends on the first tick past 1.733 s');assert.equal(g.hero.action,'stay1');assert.equal(g.hero.motion,null);
});

test('contact only inside the active window, in both facings; out of reach and too high miss',()=>{
 for(const face of [1,-1]){const g=make(KIT0),s=slime(g,60*face);assert(g.command({...idle,x:face,attack:true}));const m=g.hero.motion,start=m.start;
  until(g,()=>g.hero.action!=='iai1');const hits=g.fx.filter((f:any)=>f.kind==='damage'&&f.attackId===m.attackId);
  assert.equal(hits.length,1,'one damage per target per motion');assert.equal(hits[0].definitionId,'pink-iai-iai1');assert.equal(hits[0].value,60);assert.equal(s.hp,100000-60);
  const at=hits[0].contactAt-start;assert.ok(at>=PINK_IAI.rows.iai1.activeFrom-1e-9&&at<=PINK_IAI.rows.iai1.activeTo+1e-9,'contact at '+at);}
 const c=PINK_IAI.rows.iai1.contact,adv=IAI_MEASURED.rows.iai1.advance.reduce((s,a)=>s+a.cm,0);
 const g=make(KIT0),far=slime(g,c.reach[1]+adv+12.5+c.width+115*.66+25);g.command({...idle,x:1,attack:true});until(g,()=>g.hero.action!=='iai1');assert.equal(far.hp,100000,'out of reach');
 const hero={x:0,y:0,elevation:0,airHeight:0,facing:1},low={x:50,y:0,elevation:0,radius:12.5,bodyHeight:31};
 assert.ok([0,.25,.5,.75,1].some(u=>iaiContact(c,u,hero,low)),'a ground slime in front is cut');
 for(const u of [0,.5,1]){assert.equal(iaiContact(c,u,hero,{...low,elevation:400}),null,'too high');assert.equal(iaiContact(c,u,hero,{...low,x:-50}),null,'behind');}
});

test('heightFloor -40: a slime 41 cm downhill is still cut (zone 5 slope); floor 0 would miss it, null = measured band only',()=>{
 const hero={x:0,y:0,elevation:0,airHeight:0,facing:1},down={x:60,y:0,elevation:-41,radius:12.5,bodyHeight:31},us=[0,.25,.5,.75,1];
 for(const k of ['iai1','iai2','iai3'] as const){const c=PINK_IAI.rows[k].contact;
  assert.ok(us.some(u=>iaiContact(c,u,hero,down,PINK_IAI.switches.heightFloor)),k+' downhill slime with the default floor');
  assert.ok(us.some(u=>iaiContact(c,u,hero,down)),k+' the iaiContact default is the kit floor');
  assert.equal(us.some(u=>iaiContact(c,u,hero,down,0)),false,k+' floor 0 misses it');
  assert.equal(us.some(u=>iaiContact(c,u,hero,{...down,elevation:-75},PINK_IAI.switches.heightFloor)),false,k+' 75 cm below is out');}
 assert.equal(us.some(u=>iaiContact(PINK_IAI.rows.iai3.contact,u,hero,{...down,elevation:0},null)),false,'null: the measured band (42.4 cm up) misses a ground slime');
});

test('AUTO reach (iaiCanReach) uses the same advance and contact numbers as the row: it agrees with a real press',()=>{
 let lastTrue=-1,firstFalse=-1;
 for(let dx=30;dx<=260;dx+=5){const probe=make(),s=slime(probe,dx),reach=iaiCanReach(probe.kitHost(),PINK_IAI,s);
  const g=make(),t:any=slime(g,dx);t.frozenUntil=1e9;// the slime stands still: reach is judged at the press
  g.command({...idle,x:1,attack:true});until(g,()=>g.hero.action!=='iai1');const hit=t.hp<100000;
  assert.equal(reach,hit,'dx '+dx);if(reach)lastTrue=dx;else if(firstFalse<0)firstFalse=dx;}
 console.log(JSON.stringify({iai1AutoReach:{lastTrue,firstFalse}}));assert.ok(lastTrue>=150&&firstFalse>lastTrue,'reach edge after the advance');
});

test('input save: early press ignored; saved press starts the next row at its cancel point; iai3 has no next',()=>{
 {const g=make(KIT0);g.command({...idle,attack:true});steps(g,5);assert.equal(g.command({...idle,attack:true}),false,'before inputFrom');until(g,()=>g.hero.action!=='iai1');assert.equal(g.hero.action,'iai_recover');}
 const g=make(KIT0),e0=g.elapsed;g.command({...idle,attack:true});steps(g,15);assert.equal(g.command({...idle,attack:true}),true);assert.equal(g.hero.motion.saved,true);
 until(g,()=>g.hero.action!=='iai1');assert.equal(g.hero.action,'iai2');near(g.elapsed-e0,.52,1e-6,'iai2 at first tick past 0.503');
 const m2=g.hero.motion;near(m2.clipFrom,0);near(m2.duration,33/60);near(clip(g),0);assert.equal(m2.comboStep,2);
 steps(g,1);assert.equal(g.command({...idle,attack:true}),false,'iai2 before 0.033');steps(g,1);assert.equal(g.command({...idle,attack:true}),true);
 const e2=g.elapsed-.04;until(g,()=>g.hero.action!=='iai2');assert.equal(g.hero.action,'iai3');near(g.elapsed-e2,.40,1e-6,'iai3 at first tick past 0.383');
 steps(g,25);assert.equal(g.command({...idle,attack:true}),false,'iai3 has no follow-up');until(g,()=>g.hero.action!=='iai3');assert.equal(g.hero.action,'iai_recover');near(g.hero.motion.grace,0);
});

test('grace after a row continues the chain; a later press waits for the sheathe and starts iai1 without the entry',()=>{
 {const g=make(KIT0);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');steps(g,5);assert(g.command({...idle,attack:true}));assert.equal(g.hero.action,'iai2');}
 const g=make(KIT0);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');const r0=g.hero.motion.start;steps(g,15);
 assert.equal(g.command({...idle,attack:true}),true);assert.equal(g.hero.action,'iai_recover');assert.equal(g.hero.motion.pendingPress,true);
 until(g,()=>g.hero.action!=='iai_recover');assert.equal(g.hero.action,'iai1');assert.ok(g.elapsed-r0>=56/60-1e-9&&g.elapsed-r0<56/60+.02+1e-9,'at the sheathe');
 const m=g.hero.motion;near(m.clipFrom,.12);near(m.duration,.12+32/60);near(clip(g),.12,1e-9,'start is back-dated by the skipped entry');
});

test('ready hold and release: a press starts iai1 at once without the entry; the stick releases only after the hold blend',()=>{
 for(const age of [1.0,1.5]){const g=make(KIT0);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');steps(g,Math.round(age/.02));assert(g.command({...idle,attack:true}));assert.equal(g.hero.action,'iai1');near(g.hero.motion.clipFrom,.12);near(clip(g),.12,1e-9);}
 const g=make(KIT0),twin=make(KIT0);for(const e of [g,twin]){e.command({...idle,attack:true});until(e,()=>e.hero.action==='iai_recover');}
 steps(g,25,{...idle,x:1});steps(twin,25);assert.equal(g.hero.action,'iai_recover','the sheathe ignores the stick');near(g.hero.x,twin.hero.x,1e-9,'the stick does not move the hero');
 const t=until(g,()=>g.hero.action!=='iai_recover',{...idle,x:1});assert.equal(g.hero.action,'run1');near(.5+t,PINK_IAI.recover.moveReleaseAt,.02+1e-6);
});

test('the advance moves the hero by the measured travel (rows, then the sheathe step back) and stops at the body of the slime',()=>{
 const adv=IAI_MEASURED.rows.iai1.advance.reduce((s,a)=>s+a.cm,0);
 {const g=make(KIT0),x0=g.hero.x;g.command({...idle,attack:true});until(g,()=>g.hero.action!=='iai1');near(g.hero.x-x0,adv,1e-6,'free advance');
  until(g,()=>g.hero.action!=='iai_recover');near(g.hero.x-x0,adv-5.17,1e-6,'recover steps back 5.17 cm');}
 // the hero starts at the left edge of the zone: +400 gives room to step left
 for(const face of [1,-1]){const g=make(KIT0);g.hero.x+=400;const x0=g.hero.x;g.command({...idle,x:face,attack:true});steps(g,15);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai2');steps(g,3);g.command({...idle,attack:true});
  until(g,()=>g.hero.action==='iai_recover');const r0=g.hero.x;until(g,()=>g.hero.action!=='iai_recover');
  near((g.hero.x-r0)*face,-5.17,1e-6,'step back along the facing '+face);near((r0-x0)*face,104.70,.05,'rows 1-3 forward (iai1 cut at its 0.52 hand-over, iai2 at 0.40, iai3 whole) '+face);}
 const g=make(KIT0),x0=g.hero.x,s=slime(g,45);g.command({...idle,attack:true});until(g,()=>g.hero.action!=='iai1');
 // T1: the body rule is 2D (the hero's y follows the lane centre as x changes); the x gap alone can read 6e-5 cm short.
 assert.ok(g.hero.x-x0<adv-5,'stopped early');assert.ok(Math.hypot(s.x-g.hero.x,s.y-g.hero.y)>=20+12.5-1e-6,'no overlap: '+(s.x-g.hero.x)+','+(s.y-g.hero.y));
});

test('hitstop freezes the hero clip and the struck slime for the row hitstop; scale 0 turns it off',()=>{
 const g=make(),s=slime(g,60);g.command({...idle,attack:true});until(g,()=>g.fx.some((f:any)=>f.kind==='damage'));
 const c0=clip(g),x0=g.hero.x,e=g.elapsed;assert.equal(g.hero.motion.hitstopLeft>0,true);near(g.hero.motion.hitstopUntil,e+.08,1e-9);near(s.frozenUntil,e+.08,1e-9);
 for(let i=0;i<4;i++){g.step(.02,idle);near(clip(g),c0,1e-9,'frozen tick '+i);near(g.hero.x,x0,1e-9);}g.step(.02,idle);near(clip(g),c0+.02,1e-9,'resumes');
 const off=make({...PINK_IAI,switches:{...PINK_IAI.switches,hitstopScale:0}});slime(off,60);off.command({...idle,attack:true});until(off,()=>off.fx.some((f:any)=>f.kind==='damage'));const c1=clip(off);off.step(.02,idle);near(clip(off),c1+.02,1e-9,'no hitstop');
});

test('kit skill: mist-finer timing, storm-call reach 407 / radius 163 / ahead 88, contact at the authored time',()=>{
 const g=make();g.skillEnabled[0]=true;g.skillIds[0]='stormcall';const s=slime(g,380);assert(g.command({...idle,skill:0}));const m=g.hero.motion;
 assert.equal(g.hero.action,'skill2');assert.equal(m.kind,'skill');near(m.duration,58/60);near(m.hitAt,28/60);assert.deepEqual(m.target,{x:s.x,y:s.y});
 until(g,()=>g.fx.some((f:any)=>f.kind==='damage'&&f.damageKind==='skill'));const d=g.fx.find((f:any)=>f.kind==='damage');near(d.contactAt,m.start+28/60,1e-9,'contact');
 const strike=g.fx.find((f:any)=>f.kind==='elemental-strike');assert.equal(strike.radius,163);
 const g2=make();g2.skillEnabled[0]=true;g2.skillIds[0]='stormcall';slime(g2,450);g2.command({...idle,skill:0});near(g2.hero.motion.target.x,g2.hero.x+88,1e-9,'ahead');
});

test('kit skill: only storm-call takes ahead 88; sun-cleave and water-ring keep the 130 centre (and their own radius)',()=>{
 for(const kit of [PINK_IAI,null])for(const [gem,dx] of [['cleave',200],['cleave',0],['icespear',300],['icespear',0]] as const){
  const g=make(kit);g.skillEnabled[1]=true;g.skillIds[1]=gem;if(dx)slime(g,dx);assert(g.command({...idle,x:1,skill:1}),gem);
  near(g.hero.motion.target.x,g.hero.x+130,1e-9,gem+' centre '+(kit?'kit':'no kit')+' dx '+dx);assert.equal(g.hero.motion.radius,gem==='cleave'?240:18);}
 const g=make();g.skillEnabled[1]=true;g.skillIds[1]='cleave';const s=slime(g,130+240+12.5-1);g.command({...idle,x:1,skill:1});until(g,()=>g.fx.some((f:any)=>f.kind==='damage'));
 assert.ok(s.hp<100000,'sun-cleave still reaches 130 + 240 with the kit');
});

// K5 (2026-11-19): the default became 'cancel' (game rule). Before K5 this test expected the trial rule by default
// ("skill during the chain fires after the sheathe by default; the switch makes it cancel at once"); that rule is now the
// 'after-sheathe' switch and is checked here with the same assertions.
test('skill during the chain cuts it by default (0.04 s stay1, game rule); the after-sheathe switch keeps the trial rule',()=>{
 const c=make();c.skillEnabled[0]=true;c.skillIds[0]='stormcall';c.command({...idle,attack:true});steps(c,10);assert(c.command({...idle,skill:0}));assert.equal(c.hero.motion.kind,'cancel');assert.equal(c.hero.action,'stay1');steps(c,2);assert.equal(c.hero.action,'skill2');
 const g=make({...PINK_IAI,switches:{...PINK_IAI.switches,skillDuringAttack:'after-sheathe',tempo:0}});g.skillEnabled[0]=true;g.skillIds[0]='stormcall';g.command({...idle,attack:true});steps(g,10);assert.equal(g.command({...idle,skill:0}),true);assert.equal(g.hero.action,'iai1');
 until(g,()=>g.hero.action==='iai_recover');const r0=g.elapsed;until(g,()=>g.hero.action!=='iai_recover');assert.equal(g.hero.action,'skill2');assert.ok(g.elapsed-r0>=56/60-1e-9&&g.elapsed-r0<56/60+.02+1e-9);
 const e=make();e.skillEnabled[0]=true;e.skillIds[0]='stormcall';e.command({...idle,attack:true});steps(e,3);assert(e.command({...idle,skill:0}));assert.equal(e.hero.action,'skill2','from the ready entry the skill starts at once (trial)');
 assert.equal(PINK_IAI.switches.skillDuringAttack,'cancel');
});

// K5: a pressed skill cuts row 1, 2 or 3 before, inside or after its hit window. Damage of the cut row is the game rule:
// contacts already made stay, the rest of the row never happens. Printed as seen; before = none, after = all.
function atRow(row:'iai1'|'iai2'|'iai3',clipAt:number){const g=make(KIT0),s=slime(g,60);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';
 g.command({...idle,x:1,attack:true});if(row!=='iai1'){steps(g,15);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai2');}
 if(row==='iai3'){steps(g,3);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai3');}
 until(g,()=>clip(g)>=clipAt-1e-9);return {g,s,m:g.hero.motion};}
test('K5 button: a skill cuts rows 1-3 before / inside / after the hit window; 0.04 s stay1, then skill2',()=>{
 const seen:any={};
 for(const row of ['iai1','iai2','iai3'] as const){const r=PINK_IAI.rows[row];
  for(const [when,at] of [['before',r.activeFrom-.04],['inside',(r.activeFrom+r.activeTo)/2],['after',r.activeTo+.02]] as const){
   const {g,m}=atRow(row,at);assert.equal(g.hero.action,row);const cut=g.elapsed,clipAtCut=clip(g);
   assert.equal(g.command({...idle,skill:0}),true,row+' '+when);assert.equal(g.hero.motion.kind,'cancel');assert.equal(g.hero.action,'stay1');assert.equal(g.hero.motion.cancelledAttackId,m.attackId);
   steps(g,1);assert.equal(g.hero.motion.kind,'cancel','still stay1 after 0.02');steps(g,1);assert.equal(g.hero.action,'skill2');assert.equal(g.hero.motion.kind,'skill');near(g.hero.motion.start,cut+.04,1e-9,'skill starts 0.04 s after the press');
   steps(g,30);const hits=g.fx.filter((f:any)=>f.kind==='damage'&&f.attackId===m.attackId);
   assert.ok(hits.every((f:any)=>f.contactAt<=cut+1e-9),'no row contact after the cut');
   if(when==='before')assert.equal(hits.length,0,row+' before: the row deals nothing');if(when==='after')assert.equal(hits.length,1,row+' after: the row hit already');
   seen[row+' '+when]={clip:+clipAtCut.toFixed(3),rowHits:hits.length,rowDamage:hits.reduce((a:number,f:any)=>a+f.value,0)};}}
 console.log(JSON.stringify({K5cutTable:seen}));
});

// K1-fix (review, K5 tests): a button skill pressed on the first hitstop tick of rows 1-3. As seen (2026-11-19): the cut is
// the same as outside a hitstop (0.04 s stay1, then skill2); the hero's hitstop ends with the row (the cancel motion has
// none); the struck slime stays frozen until its own frozenUntil; no further row damage. The K5 table's "inside" cell is
// after the hitstop (the clip stands still during it), so this case was not covered there.
test('K1-fix button: a skill pressed during a row hitstop cuts at once; the hero hitstop ends, the struck slime stays frozen',()=>{
 for(const row of ['iai1','iai2','iai3'] as const){const g=make(),s:any=slime(g,60);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';
  g.command({...idle,x:1,attack:true});if(row!=='iai1'){steps(g,15);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai2');}
  if(row==='iai3'){steps(g,3);g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai3');}
  until(g,()=>g.hero.motion.hitstopLeft>1e-9);const m=g.hero.motion,r=PINK_IAI.rows[row],press=g.elapsed,frozen=s.frozenUntil,hp=s.hp;
  assert.equal(g.hero.action,row);assert.ok(clip(g)<(r.activeFrom+r.activeTo)/2,'the K5 "inside" cell comes after this hitstop');
  near(m.hitstopUntil,press+m.hitstopLeft,1e-9);near(frozen,m.hitstopUntil,1e-9);assert.ok(hp<100000,'the row hit');
  assert.equal(g.command({...idle,skill:0}),true,row);assert.equal(g.hero.motion.kind,'cancel');assert.equal(g.hero.action,'stay1');assert.equal(g.hero.motion.cancelledAttackId,m.attackId);
  assert.equal(g.hero.motion.hitstopLeft,undefined,'no hero hitstop after the cut');assert.equal(s.frozenUntil,frozen,'the slime keeps its freeze');
  steps(g,2);assert.equal(g.hero.action,'skill2');near(g.hero.motion.start,press+.04,1e-9,'skill starts 0.04 s after the press, not after the hitstop');
  assert.ok(s.frozenUntil>g.elapsed,'still frozen when the skill starts');until(g,()=>g.elapsed>=frozen-1e-9);steps(g,1);assert.ok(!(s.frozenUntil>g.elapsed),'the freeze ends at its own time');
  assert.equal(g.fx.filter((f:any)=>f.kind==='damage'&&f.attackId===m.attackId&&f.contactAt>press+1e-9).length,0,'no row contact after the cut');}
});

test('K5 button: a skill during the flick/sheathe cuts it (0.04 s); after the sheathe (ready) it starts at once',()=>{
 for(const age of [.1,.5,.9]){const g=make(KIT0);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');steps(g,Math.round(age/.02));
  assert.equal(g.hero.action,'iai_recover');assert(g.command({...idle,skill:0}));assert.equal(g.hero.motion.kind,'cancel','recover age '+age);steps(g,2);assert.equal(g.hero.action,'skill2');}
 const g=make(KIT0);g.skillEnabled[0]=true;g.skillIds[0]='stormcall';g.command({...idle,attack:true});until(g,()=>g.hero.action==='iai_recover');steps(g,50);
 assert(g.command({...idle,skill:0}));assert.equal(g.hero.action,'skill2','ready stance: no cut');assert.equal(g.hero.motion.kind,'skill');
});

test('K5 button: an unusable skill (cooldown, mana, disabled) cuts nothing: the row and the sheathe go on; the stick is no cancel input',()=>{
 const cases:[string,(g:any)=>void][]=[['cooldown',g=>{g.skillEnabled[0]=true;g.cooldowns[0]=2;}],['mana',g=>{g.skillEnabled[0]=true;g.resources.mana=40;}],['disabled',g=>{g.skillEnabled[0]=false;}]];
 for(const [name,set] of cases)for(const where of ['row','recover']){const g=make(),s=slime(g,60);g.skillIds[0]='stormcall';set(g);g.command({...idle,x:1,attack:true});
  if(where==='row')steps(g,10);else until(g,()=>g.hero.action==='iai_recover');const m=g.hero.motion,action=g.hero.action;
  assert.equal(g.command({...idle,skill:0}),false,name+' '+where);assert.equal(g.hero.motion,m,'same motion');assert.equal(g.hero.action,action);
  if(where==='row'){until(g,()=>g.hero.action!=='iai1');assert.equal(g.hero.action,'iai_recover');assert.ok(s.hp<100000,'the row still hits');}}
 const g=make();g.command({...idle,attack:true});steps(g,10);const m=g.hero.motion;steps(g,3,{...idle,x:1});assert.equal(g.hero.motion,m,'stick during a row');assert.equal(g.hero.action,'iai1');
});

test('dodge, jump and slide still cut the rows and the recover (game rule)',()=>{
 for(const k of ['dodge','jump','slide'])for(const where of ['row','recover']){const g=make();g.command({...idle,attack:true});if(where==='row')steps(g,10);else until(g,()=>g.hero.action==='iai_recover');
  assert(g.command({...idle,[k]:true}),k+' '+where);assert.equal(g.hero.motion.kind,'cancel');steps(g,2);assert.equal(g.hero.motion.kind,k);}
});

test('AUTO with the kit chains iai1-3 and clears slimes; no old attack names appear',()=>{
 const g:any=new MountSundayEngine(111,p);g.heroKit=PINK_IAI;const actions=new Set<string>(),ids=new Set<string>();
 for(let t=0;t<9000&&g.room===0;t++){const input={x:0,y:0,auto:true,readyZone:1};g.acceptClientHints(input);g.step(.02,input);actions.add(g.hero.action);for(const f of g.fx)if(f.kind==='damage')ids.add(f.definitionId);}
 console.log(JSON.stringify({room:g.room,kills:g.kills,actions:[...actions],ids:[...ids]}));
 assert.ok(g.kills>=30,'zone 1 cleared by AUTO');for(const a of ['iai1','iai2','iai3','iai_recover'])assert.ok(actions.has(a),a);
 for(const a of actions)assert.ok(!/^attack/.test(a),a);for(const id of ids)assert.ok(id.startsWith('pink-iai-')||id==='lightning'||id==='water','id '+id);
});

test('training bundle, practice-path boot (referencePreview, zone 1, six practice skills): heroKit on and off',()=>{
 const source=readFileSync('unity/IslandGame/Assets/Island/Resources/TrainingCombatKernel.js.txt','utf8');
 // the same shape ReferenceTrainingSession.OpenReferenceTraining(0) sends, plus heroKit when the kit asset is found
 const skills=PRACTICE.map((activeId,index)=>({supportIds:index<4?[]:index===4?['echo','elemental']:['echo','elemental','reach','quick'],enabled:true,activeId,trigger:null,index}));
 const base={mode:'mount',previewArena:false,seed:111,referencePreview:true,previewZone:0,traversalProfile:'source-run-v2',build:{skills}};
 for(const kit of ['pink-iai',undefined]){const c:any=vm.createContext({});vm.runInContext(source,c);
  const v=JSON.parse(c.stageInitialize(JSON.stringify(kit?{...base,heroKit:kit}:base)));
  assert.equal(v.heroKit,kit,'snapshot heroKit');assert.equal(v.routeZone,0,'zone 1');
  const input={x:0,y:0,auto:false,readyZone:0},a=JSON.parse(c.stageAdvance(JSON.stringify({steps:1,input,commands:[{attack:true}],snapshot:true})));
  assert.equal(a.hero.action,kit?'iai1':'attack1');if(kit){assert.equal(a.hero.motion.kit,'pink-iai');assert.equal(a.heroKit,'pink-iai');}else assert.equal('heroKit' in a,false);
  // a practice lightning slot (3 = storm-call) times as the kit skill when the kit is on
  for(let i=0;i<120;i++)c.stageAdvance(JSON.stringify({steps:1,input,commands:[],snapshot:false}));
  const k=JSON.parse(c.stageAdvance(JSON.stringify({steps:1,input,commands:[{skill:3}],snapshot:true})));
  assert.equal(k.hero.action,'skill2');near(k.hero.motion.duration,kit?58/60:.94,1e-9,'skill duration');}
});

test('training bundle: boot heroKit selects the kit in mount mode only, and stays the same engine',()=>{
 const source=readFileSync('unity/IslandGame/Assets/Island/Resources/TrainingCombatKernel.js.txt','utf8');
 const boot=(extra:any)=>{const c:any=vm.createContext({});vm.runInContext(source,c);return {c,view:JSON.parse(c.stageInitialize(JSON.stringify({mode:'mount',seed:111,traversalProfile:'source-run-v2',...extra})))};};
 assert.equal(boot({}).view.heroKit,undefined);assert.equal(boot({heroKit:'pink-iai'}).view.heroKit,'pink-iai');assert.equal(boot({heroKit:'other'}).view.heroKit,undefined);
 {const c:any=vm.createContext({});vm.runInContext(source,c);assert.equal(JSON.parse(c.stageInitialize(JSON.stringify({mode:'boss',seed:111,heroKit:'pink-iai'}))).heroKit,undefined,'boss zone does not know the kit');}
 // K6: both sides at tempo stage 0 (before: boot {heroKit} vs g.heroKit=PINK_IAI). The frozen Unity bundle predates K6 and
 // ignores kitTempo (stage 0 = its timing); after the U0 rebuild the same boot key selects stage 0 there too.
 const k=boot({heroKit:'pink-iai',kitTempo:0}),g:any=new MountSundayEngine(111,undefined,0);g.traversal=p;g.heroKit=PINK_IAI;assert.equal(g.setKitTempo(0),true);
 for(let t=0;t<3000;t++){const input={x:t%600<120?1:0,y:0,auto:t>400,readyZone:Math.min(9,g.room+1)};const commands=t%53===7?[{attack:true}]:t%301===150?[{dodge:true}]:[];
  g.acceptClientHints(input);for(const e of commands)g.command({...input,...e});g.step(.02,input);const a=JSON.parse(k.c.stageAdvance(JSON.stringify({steps:1,input,commands,snapshot:true})));
  if(t%50===0){const v=JSON.parse(JSON.stringify(g.view()));for(const key of ['hero','mobs','fx','heroKit','kills'])assert.deepEqual(a[key],v[key],key+' @'+t);}}
});

// T1: the windows start at the visible cut (iai1 is 0.05 s). A standing slime placed when a row starts is cut at every
// 2 cm from 20 cm out to the row's reach edge, at stages 0/1/2 (no gap the edge fan skips), and the edges stay where the
// pre-T1 rows had them within a few cm (pre-T1: iai1 204-206, iai2 142, iai3 144-146; T1: iai3 gains the advance it now
// makes before its window).
// T1b (REVIEW_T1 1-3 (b)): the cells straight ahead are crossed even without the per-window sample rule, so the test
// also places the slime off axis near the outer edge. Each listed cell (degrees off the facing @ cm) is hit with the
// rule (>= SWEEP_SAMPLES points per window) and missed with 120 per clip second alone (qa_T1b/work/probe/oblique.mts).
const T1B_OBLIQUE:Record<string,string[]>={
 'iai1 s0':['-40@188','-16@200','8@200'],'iai1 s1':['-40@188','-16@200','8@200'],'iai1 s2':['-32@196','0@204','28@196'],
 'iai2 s0':['-36@136','0@136','20@136'],'iai2 s1':['-36@136','0@136','20@136'],'iai2 s2':['-24@136','8@136','24@140'],
 'iai3 s0':['-52@136','-8@156','36@140'],'iai3 s1':['-48@136','0@156','40@136'],'iai3 s2':['-52@136','-12@156','36@140']};
test('T1 short windows lose no contact: rows 1-3 at stages 0-2 cut a standing slime at every distance up to the edge',()=>{
 const rowHit=(kit:any,row:string,dx:number,deg=0)=>{const g=make(kit);g.command({...idle,x:1,attack:true});let s:any=null;
  for(let i=0;i<400;i++){if(!s&&g.hero.action===row){const a=deg*Math.PI/180,f=g.hero.motion.facing||1;s=slime(g,f*dx*Math.cos(a));s.y=g.hero.y+dx*Math.sin(a);s.frozenUntil=1e9;}if(s&&g.hero.action!==row)break;
   if(g.hero.motion?.kind==='attack'&&g.hero.action!==row)g.command({...idle,x:1,attack:true});g.step(.02,idle);}
  return !!s&&s.hp<100000;};
 for(const [key,cells] of Object.entries(T1B_OBLIQUE)){const [row,s]=key.split(' '),kit={...PINK_IAI,switches:{...PINK_IAI.switches,tempo:+s.slice(1)}};
  for(const cell of cells){const [deg,d]=cell.split('@').map(Number);assert.ok(rowHit(kit,row,d,deg),`${key} off-axis ${cell}: missed (contact samples per window)`);}}
 const edges:any={};
 for(const st of [0,1,2]){const kit={...PINK_IAI,switches:{...PINK_IAI.switches,tempo:st}};
  for(const row of ['iai1','iai2','iai3']){let last=-1;
   for(let dx=20;dx<=280;dx+=2){if(rowHit(kit,row,dx)){assert.equal(last,dx-2<20?-1:dx-2,`stage ${st} ${row}: a gap before ${dx}`);last=dx;}}
   edges[`s${st}${row}`]=last;}}
 console.log(JSON.stringify({T1reachEdges:edges}));
 for(const st of [0,1,2]){assert.ok(edges[`s${st}iai1`]>=200,'iai1 edge');assert.ok(edges[`s${st}iai2`]>=138,'iai2 edge');assert.ok(edges[`s${st}iai3`]>=142,'iai3 edge');}
});
