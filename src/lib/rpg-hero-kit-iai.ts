// Opt-in hero kit `pink-iai`: the draw-cut (iai) rhythm of the Pink Glass trial scene, moved into the kernel
// (maintenance/rev2-android-port-20261119/PORT_PLAN_KO.md E-3). The engine uses it only when the boot names it
// (`heroKit:"pink-iai"`); without it nothing here runs. World units: 100 = one Unity metre, seconds.
// Times are the trial scene's seconds as they are; distances are trial metres x k (body height 1.30 / 1.917).
// Only a few spec numbers per action are kept here. No per-frame blade trajectory is carried.
import {ATTACK_CANCEL_SECONDS,evadeInput} from './rpg-action-cancel';
import {skillContains} from './rpg-reference-skills';

export const IAI_K=.678;
const F=(n:number)=>n/60;// one 60 fps frame of the trial clip
const ENTRY=.12;// trial readyIn: relaxed idle -> hand on the hilt, then row 1

export type IaiContactSpec={reach:[number,number];height:[number,number];sweep:[number,number];width:number};
// ease: out = u(2-u) (decelerating, the default), linear = u, smooth = u*u*(3-2u).
export type IaiAdvance={from:number;to:number;cm:number;ease?:'out'|'linear'|'smooth'};
// K6: speed of each part of a row / the recover (1 = the trial clip clock, 1.5 = that part takes 1/1.5 of the time).
export type IaiTempo={windup:number;active:number;recovery:number;sheathe:number};
type RowName='iai1'|'iai2'|'iai3';
// Deep-freezes the module-level tables so a stray write cannot leak into the next run of the same bundle.
function deepFreeze<T>(o:T):T{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o as any))deepFreeze(v);Object.freeze(o);}return o;}

// ---- MEASURED BLOCK ----------------------------------------------------------------------------------------------
// Measured on the baked clips (1a, 2026-11-19): bake/measure.json, plus the per-tick root travel of the bake record
// (work/gameplay-dev-1a/rec/rec.json, local only) reduced to a few segments per action. No per-frame value is kept here.
// Times are NOT taken from the bake: the kernel table (PINK_IAI.rows: entry, length, active window) stays the reference.
// The clips differ by about one frame (entry 0.1167 vs 0.12, iai1 0.65 vs 0.6533, iai3 0.9167 vs 0.90, recover 1.75 vs
// 1.7333, skill 0.95 vs 0.9667); they are not rebaked: the display samples the clip at kernel time and holds its last frame.
// How each measure.json field maps here (one rule each):
//  reach   = [20, contact.tipForwardGame_cm max]. The near end stays 20 (the game crescent's); the measured minimum is
//            negative (tip behind the body while the blade turns) and would cut behind the hero, so it is not used.
//  height  = [min, max] of contact.tipHeightGame_cm and contact.guardHeightScene_m x k x 100 (the edge runs guard->tip).
//            switches.heightFloor lowers the near end (ground slimes, downhill targets).
//  advance = travelRemovedGame_m split at the KERNEL active window into before / inside / after (row clock = clip time);
//            each part is one eased segment over the ticks it moves in (the before-part of iai2 and iai3 is two:
//            iai2 forward then back, iai3 back then forward; T1b: iai2's back step F(14)-F(20) is one line cut at the
//            window start F(18), so its movement is the T1 one exactly).
//            Sums (cm), T1/T1b window: iai1 47.17 / 0.29 / 3.24 = 50.70; iai2 5.39 / -1.27 / -3.24 = 0.88;
//            iai3 36.67 / 10.22 / 5.71 = 52.60 (52.6). Totals per row are the same as before T1.
//            Travel the clip has after the kernel end (iai3 0.90-0.9167) is folded into the last segment.
//  recover = PG_iai_recover.travelRemovedGame_m (-5.17 cm, the same after rows 1, 2 and 3), over the flick+sheathe.
// NOT measured (design values, kept in PINK_IAI.rows): sweep (ground-plane fan) and width. measure.json's
// bladeAngleStart/EndDeg are side-plane angles (atan2(up, forward)) and mean something else.
export const IAI_MEASURED=deepFreeze({
 source:'bake/measure.json 2026-11-19 (1a) + rec.json travel split at the kernel window',
 rows:{
  iai1:{advance:[{from:F(8),to:F(18),cm:47.17},{from:ENTRY+F(18),to:ENTRY+F(21),cm:.29,ease:'smooth'},{from:ENTRY+F(21),to:ENTRY+F(32),cm:3.24}] as IaiAdvance[],
   contact:{reach:[20,137.2] as [number,number],height:[25.9,101.2] as [number,number]}},
  iai2:{advance:[{from:0,to:F(8),cm:9.50,ease:'smooth'},{from:F(8),to:F(14),cm:-1.57,ease:'linear'},{from:F(14),to:F(18),cm:-2.54,ease:'linear'},{from:F(18),to:F(20),cm:-1.27,ease:'linear'},{from:F(20),to:F(33),cm:-3.24,ease:'linear'}] as IaiAdvance[],
   contact:{reach:[20,114.3] as [number,number],height:[9.3,182.6] as [number,number]}},
  iai3:{advance:[{from:0,to:F(11),cm:-2.76},{from:F(11),to:F(32),cm:39.42,ease:'linear'},{from:F(32),to:F(36),cm:10.22,ease:'linear'},{from:F(36),to:F(54),cm:5.71}] as IaiAdvance[],
   contact:{reach:[20,91.5] as [number,number],height:[42.4,118.6] as [number,number]}},
 },
 recover:{advance:[{from:0,to:F(56),cm:-5.17,ease:'smooth'}] as IaiAdvance[]},
});
// -------------------------------------------------------------------------------------------------------------------

type Row={step:1|2|3;duration:number;activeFrom:number;activeTo:number;inputFrom:number|null;cancelAt:number|null;grace:number;next:RowName|null;hitstop:number;damage:number;advance:IaiAdvance[];contact:IaiContactSpec};
// REV2-PORT-HOOK(READY-HOLD): iai1 carries the 0.12 s ready entry; recover = flick+sheathe, ready hold, release (trial StartReady/StepHold/StartRelease).
// Row clock = seconds from the start of the row's clip. iai1's clip begins with the ready entry.
// Trial rows (60 fps frames of the source clip): 1 = 8-40 hit 18-29 input 10 cancel 31, 2 = 31-64 hit 42-51 input 33 cancel 54,
// 3 = 54-108 hit 77-90, recover 124-180. Damage 60/60/105 keeps the trial ratio 8/8/14 (PROVISIONAL, design decides).
// T1 (2026-11-19, user-approved method A of REPORT_T0): activeFrom no longer takes the trial's hit start. The trial window
// opens while the baked blade is still behind / above the body (measure.json blade angle at the window start: up and back),
// so the contact, the hitstop and the arc landed before the visible cut. activeFrom is now the clip frame where the blade
// tip comes in front of the body (Editor clip sampling, qa_T0): iai1 ENTRY+F(18), iai2 F(14), iai3 F(32) (the first whole
// clip frame at or after the tip-front time; F(31) held the 3rd's 0.14 s stop with the tip still behind in the Editor, qa_T1).
// T1b: iai2 F(14) -> F(18). iai2 is an overhead cut: at F(14) the tip is in front but still above the head, so the
// rule for iai2 is the first whole frame where the tip is in front AND down near the target height (REVIEW_T1 sec. 2).
// activeTo, inputFrom, cancelAt, damage and hitstop are the trial's as before. Only the start of the window moved.
// sweep/width below are DESIGN values (not measured): the ground-plane fan of the game crescent (packSwordContact)
// generalised per row, and the half thickness of the edge. Tune them against the screen blade in 3c.
const M=IAI_MEASURED.rows;
export const PINK_IAI=deepFreeze({
 id:'pink-iai',revision:'pink-iai-v1',entry:ENTRY,
 rows:{
  iai1:{step:1,duration:ENTRY+F(32),activeFrom:ENTRY+F(18),activeTo:ENTRY+F(21),inputFrom:ENTRY+F(2),cancelAt:ENTRY+F(23),grace:.25,next:'iai2',hitstop:.08,damage:60,advance:M.iai1.advance,contact:{...M.iai1.contact,sweep:[-60,60],width:9}},
  iai2:{step:2,duration:F(33),activeFrom:F(18),activeTo:F(20),inputFrom:F(2),cancelAt:F(23),grace:.25,next:'iai3',hitstop:.08,damage:60,advance:M.iai2.advance,contact:{...M.iai2.contact,sweep:[45,-45],width:9}},
  iai3:{step:3,duration:F(54),activeFrom:F(32),activeTo:F(36),inputFrom:null,cancelAt:null,grace:0,next:null,hitstop:.14,damage:105,advance:M.iai3.advance,contact:{...M.iai3.contact,sweep:[100,-100],width:9}},
 } as Record<RowName,Row>,
 // moveReleaseAt: the stick ends the hold only after the trial idleBlend (0.22 s) of it; during the sheathe it is ignored.
 // advance: the measured flick+sheathe step back (IAI_MEASURED.recover).
 recover:{action:'iai_recover',sheathe:F(56),hold:.35,release:.45,duration:F(56)+.35+.45,moveReleaseAt:F(56)+.22,advance:IAI_MEASURED.recover.advance},
 // Mist Finer: stance 25 + slash 33 ticks, contact on slash tick 3. Every skill takes this timing; only storm-call takes the
 // body-scaled reach/radius/ahead (game storm-call 600/240/130 x k). Other skills keep their own reach, radius and the 130 ahead.
 skill:{action:'skill2',duration:F(58),hitAt:F(28),hitstop:.20,overrides:{'storm-call':{reach:407,radius:163,ahead:88}} as Record<string,{reach?:number;radius?:number;ahead?:number}>},
 // K6 tempo (2026-11-19, user: "발동과 회수 자체의 템포를 좀더 끌어올려보자"). The rows above stay the trial's clip clock; a
 // stage plays parts of that clock faster: windup = clip 0 -> activeFrom (iai1 incl. the 0.12 s ready entry), active =
 // activeFrom -> activeTo (the cut, kept readable), recovery = activeTo -> the row end, sheathe = the flick+sheathe of the
 // recover (0 -> recover.sheathe; the ready hold and release after it stay 1.0). Everything keyed to the clip clock (contact,
 // advance distance, input save, next row, combo grace) moves with it; the hitstop stays in kernel seconds.
 // Stage 0 = the trial timing exactly (all 1.0). PROVISIONAL values (director's start, the user picks by eye): change them here.
 tempo:{stages:[
  {windup:1,active:1,recovery:1,sheathe:1},
  {windup:1.5,active:1,recovery:1.4,sheathe:1.5},
  {windup:2,active:1,recovery:1.8,sheathe:2},
 ] as IaiTempo[]},
 runSpeed:null as number|null,// null = the engine's traversal run (385.5 cm/s); a number replaces it
 dodge:{duration:null as number|null,distance:null as number|null},// null = the game roll (0.45 s, ~217 cm)
 switches:{
  // K5 (2026-11-19, user): 'cancel' = game rule, a skill pressed during a row or the flick/sheathe cuts it (0.04 s stay1) and
  // starts; an unusable skill cuts nothing. 'after-sheathe' = the trial scene (the skill waits for the sheathe), kept as a switch.
  skillDuringAttack:'cancel' as 'after-sheathe'|'cancel',
  hitstopScale:1,// 0 turns every hitstop off
  // The height band's near end is lowered to this (cm, target top vs hero feet) so ground slimes and downhill targets are
  // cut: -40 lets a 31 cm slime stand up to 71 cm below the hero's feet (the old crescent allowed 65). null = measured band only.
  heightFloor:-40 as number|null,
  // K6: the tempo stage (index into tempo.stages) when the engine has no override (boot `kitTempo`, command {kitTempo}).
  tempo:1,
 },
});
export type HeroKit=typeof PINK_IAI;
export function heroKitFor(id:unknown):HeroKit|undefined{return id===PINK_IAI.id?PINK_IAI:undefined;}

export interface IaiHost{hero:any;mobs:any[];elapsed:number;planar:boolean;heroRadius:number;
 // advance: dx along the lane (planar=false). planar (boss arena): (dx, dy) along the row's direction (motion.dir).
 nextAttackId():number;face(x:number,y:number):void;advance(dx:number,dy?:number):void;strike(mob:any,damage:number,point:any,contactAt:number):void;
 clear(mob:any):boolean;command(input:any):boolean;skillReady(slot:number):boolean;
 // K6: the engine's tempo stage override (boot / command); undefined = kit.switches.tempo.
 tempo?:number;
 // Only when the engine's boot switch `autoSkills` is on: the AUTO skill pick (leftmost ready slot with a target), -1 = none.
 autoSkill?():number}

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const EASE={out:(u:number)=>u*(2-u),linear:(u:number)=>u,smooth:(u:number)=>u*u*(3-2*u)};
// Advance (cm, along the row's facing) reached at time t of the row clock.
function advanceAt(list:ReadonlyArray<IaiAdvance>,t:number){let s=0;for(const a of list){const u=a.to>a.from?clamp01((t-a.from)/(a.to-a.from)):t>=a.from?1:0;s+=a.cm*EASE[a.ease??'out'](u);}return s;}

// Edge of the row at fraction u of its active window vs a target body (circle on the ground, vertical extent).
// floor: the kit's switches.heightFloor (see there); the default is the kit's.
// dir (planar boss arena only): the row's ground direction. The same fan is turned to it; the lateral axis follows the lane
// mirror rule (facing -1 keeps +y as +y), so dir (+-1, 0) gives the lane numbers. No dir = the lane formula as before.
export function iaiContact(c:IaiContactSpec,u:number,hero:{x:number;y:number;facing:number;elevation:number;airHeight:number;dir?:{x:number;y:number}},target:{x:number;y:number;elevation:number;radius:number;bodyHeight?:number},floor:number|null=PINK_IAI.switches.heightFloor){
 const lo=target.elevation-hero.elevation-hero.airHeight,hi=lo+(target.bodyHeight??62),h0=floor===null?c.height[0]:Math.min(c.height[0],floor);
 if(hi<h0||lo>c.height[1])return null;
 const a=(c.sweep[0]+(c.sweep[1]-c.sweep[0])*clamp01(u))*Math.PI/180,f=hero.dir;let ux=Math.cos(a)*hero.facing,uy=Math.sin(a);
 if(f){const lx=f.x>=0?-f.y:f.y,ly=f.x>=0?f.x:-f.x;ux=f.x*Math.cos(a)+lx*Math.sin(a);uy=f.y*Math.cos(a)+ly*Math.sin(a);}
 const dx=target.x-hero.x,dy=target.y-hero.y,along=Math.max(c.reach[0],Math.min(c.reach[1],dx*ux+dy*uy));
 return Math.hypot(dx-ux*along,dy-uy*along)<=target.radius+c.width?{point:{x:target.x,y:target.elevation+20,z:target.y},part:'iai-edge'}:null;
}

// ---- K6 tempo: kernel age <-> clip time ---------------------------------------------------------------------------
// A clip map is a polyline [[age, clip], ...] from [0,0] to [kernel duration, clip duration], age = kernel seconds since
// motion.start, clip = the row's trial clip clock. null = 1:1 (stage 0, or any stage whose parts are all 1.0): then every
// number below is the pre-K6 number exactly (no arithmetic is done), and the snapshot carries no map.
export type ClipMap=ReadonlyArray<readonly [number,number]>|null;
export function kitTempoStage(host:{tempo?:number},kit:HeroKit){const n=kit.tempo.stages.length,s=host.tempo??kit.switches.tempo;return Number.isInteger(s)&&s>=0&&s<n?s:Math.min(Math.max(0,Math.round(+kit.switches.tempo||0)),n-1);}
function mapOf(parts:ReadonlyArray<readonly [number,number]>):ClipMap{
 if(parts.every(([,s])=>s===1))return null;let a=0,c=0;const out:[number,number][]=[[0,0]];
 for(const [end,s] of parts){if(end<=c)continue;a+=(end-c)/s;c=end;out.push([a,c]);}return out;}
// parts = [clip end, speed] in order; a row: windup to activeFrom, active to activeTo, recovery to the end.
export function rowClipMap(r:{activeFrom:number;activeTo:number;duration:number},t:IaiTempo){return mapOf([[r.activeFrom,t.windup],[r.activeTo,t.active],[r.duration,t.recovery]]);}
export function recoverClipMap(k:{sheathe:number;duration:number},t:IaiTempo){return mapOf([[k.sheathe,t.sheathe],[k.duration,1]]);}
// Past either end the clock runs 1:1 (the hitstop keeps age still, so the clip stands still with it).
export function clipAt(map:ClipMap,age:number){if(!map)return age;if(age<=0)return age;
 for(let i=1;i<map.length;i++){const [a1,c1]=map[i];if(age<=a1){const [a0,c0]=map[i-1];return c0+(c1-c0)*(age-a0)/(a1-a0);}}
 const [a,c]=map[map.length-1];return c+(age-a);}
export function ageAt(map:ClipMap,clip:number){if(!map)return clip;if(clip<=0)return clip;
 for(let i=1;i<map.length;i++){const [a1,c1]=map[i];if(clip<=c1){const [a0,c0]=map[i-1];return a0+(a1-a0)*(clip-c0)/(c1-c0);}}
 const [a,c]=map[map.length-1];return a+(clip-c);}
const tempoOf=(host:IaiHost,kit:HeroKit)=>{const s=kitTempoStage(host,kit);return {stage:s,t:kit.tempo.stages[s]};};

// y (planar only): the press direction's depth part. Planar rows face (x, y) and keep that direction (motion.dir, savedY).
function startRow(host:IaiHost,kit:HeroKit,name:RowName,clipFrom:number,x:number,pendingSkill:number|null=null,y=0){
 const h=host.hero,r=kit.rows[name];if(host.planar){if(Math.hypot(x,y)>.001)host.face(x,y);}else if(Math.abs(x)>.001)host.face(x,0);
 h.action=name;
 // K6: times on the motion are kernel ages (what the display and the effects read); the kit's own logic runs on the clip
 // clock (clipAt). With no map both are the trial table's numbers.
 const {stage,t}=tempoOf(host,kit),map=rowClipMap(r,t),A=(c:number)=>ageAt(map,c),D=A(r.duration);
 // start is the clip origin: when the ready entry is skipped it is back-dated by it, so the age at start maps to clipFrom.
 h.motion={kind:'attack',kit:kit.id,row:name,comboStep:r.step,start:host.elapsed-A(clipFrom),clipFrom,pressedAt:host.elapsed,duration:D,hitAt:A(r.activeFrom),
  attackId:host.nextAttackId(),definitionId:kit.id+'-'+name,hitIds:[],facing:h.facing,from:{x:h.x,y:h.y},to:{x:h.x,y:h.y},advanced:advanceAt(r.advance,clipFrom),lastClip:clipFrom,
  saved:false,savedX:0,pendingSkill,hitstop:r.hitstop*kit.switches.hitstopScale,hitstopLeft:0,hitstopUntil:null,
  timeline:{active:[{strike:0,from:A(r.activeFrom)/D,to:A(r.activeTo)/D}],inputFrom:r.inputFrom===null?null:A(r.inputFrom)/D,cancelFrom:r.cancelAt===null?1:A(r.cancelAt)/D,contactRevision:kit.revision},
  ...(map?{tempoStage:stage,clipMap:map}:{}),...(host.planar?{dir:{x:h.direction.x,y:h.direction.y},savedY:0}:{})};
 h.serial++;return true;
}
function startRecover(host:IaiHost,kit:HeroKit,row:any){
 const h=host.hero,r=kit.rows[row.row as RowName],k=kit.recover;h.action=k.action;
 const {stage,t}=tempoOf(host,kit),map=recoverClipMap(k,t),A=(c:number)=>ageAt(map,c);
 h.motion={kind:'recover',kit:kit.id,after:row.row,start:host.elapsed,duration:A(k.duration),hitAt:0,sheatheAt:A(k.sheathe),holdUntil:A(k.sheathe+k.hold),moveReleaseAt:A(k.moveReleaseAt),
  next:r.next,grace:r.next?A(r.grace):0,pendingPress:false,pendingSkill:row.pendingSkill??null,savedX:0,attackId:host.nextAttackId(),from:{x:h.x,y:h.y},to:{x:h.x,y:h.y},facing:row.facing??h.facing,advanced:0,
  ...(map?{tempoStage:stage,clipMap:map}:{}),...(row.dir?{dir:row.dir,savedY:0}:{})};
 h.serial++;
}
// Clip time of a kit motion now.
const clipNow=(host:IaiHost,m:any)=>clipAt(m.clipMap??null,host.elapsed-m.start);

// Attack button. True when the press did something (started a row or was kept for later).
// y: the press direction's depth part, used only when host.planar (boss arena).
export function iaiPress(host:IaiHost,kit:HeroKit,x:number,y=0){
 const h=host.hero,m=h.motion;
 if(!m)return startRow(host,kit,'iai1',0,x,null,y);
 if(m.kit!==kit.id)return false;
 if(m.kind==='attack'){const r=kit.rows[m.row as RowName];if(r.next&&r.inputFrom!==null&&clipNow(host,m)>=r.inputFrom-1e-9){m.saved=true;m.savedX=x;if(m.dir)m.savedY=y;return true;}return false;}
 if(m.kind==='recover'){const age=host.elapsed-m.start;
  if(m.next&&age<m.grace-1e-9)return startRow(host,kit,m.next,0,x,m.pendingSkill,y);// still inside the combo grace: the chain goes on
  if(age<m.sheatheAt-1e-9){m.pendingPress=true;m.savedX=x;if(m.dir)m.savedY=y;return true;}// sheathing: row 1 when the sword is home
  return startRow(host,kit,'iai1',kit.entry,x,null,y);}// ready stance (hold / release): row 1 at once, no entry
 return false;
}
function replace(host:IaiHost,input:any){const h=host.hero,prev=h.motion,action=h.action;h.motion=null;h.action='stay1';if(host.command(input))return true;h.motion=prev;h.action=action;return false;}
// Same shape as rpg-action-cancel's cut, for the recover (which is not an `attack` motion).
function cancelInto(host:IaiHost,input:any){
 const h=host.hero,prev=h.motion,action=h.action;h.motion=null;h.action='stay1';
 if(!host.command(input)){h.motion=prev;h.action=action;return false;}
 if(evadeInput(input)){h.motion.cancelledAttackId=prev.attackId;return true;}// instant evade (rpg-action-cancel)
 const next=h.motion,nextAction=h.action;next.start=host.elapsed+ATTACK_CANCEL_SECONDS;
 h.motion={kind:'cancel',start:host.elapsed,duration:ATTACK_CANCEL_SECONDS,hitAt:0,from:{x:h.x,y:h.y},to:{x:h.x,y:h.y},next,nextAction,cancelledAttackId:prev.attackId};
 h.action='stay1';h.serial++;return true;
}
// Commands while a kit row or the recover runs. undefined = the engine's own rules decide (attack rows: game cancel).
export function iaiCommand(host:IaiHost,kit:HeroKit,input:any):boolean|undefined{
 const m=host.hero.motion;if(!m||m.kit!==kit.id||(m.kind!=='attack'&&m.kind!=='recover'))return undefined;
 const move=!!(input.dodge||input.slide||input.jump),age=host.elapsed-m.start;
 if(move)return m.kind==='attack'?undefined:cancelInto(host,input);
 if(input.skill!==undefined){
  const entry=m.kind==='attack'&&m.clipFrom===0&&m.row==='iai1'&&clipNow(host,m)<kit.entry-1e-9,ready=m.kind==='recover'&&age>=m.sheatheAt-1e-9;
  if(entry||ready)return replace(host,input);// trial: K starts from the ready entry and the ready stance
  if(kit.switches.skillDuringAttack==='cancel')return m.kind==='attack'?undefined:cancelInto(host,input);
  if(!host.skillReady(input.skill))return false;
  m.pendingSkill=input.skill;m.pendingPress=false;m.saved=false;return true;// fires when the sword is home
 }
 if(input.attack)return host.planar?iaiPress(host,kit,input.x??0,input.y??0):iaiPress(host,kit,input.x??0);
 return undefined;
}

function rowFor(host:IaiHost,kit:HeroKit):RowName{const m=host.hero.motion;if(m?.kit===kit.id){if(m.kind==='attack')return kit.rows[m.row as RowName].next??'iai1';if(m.kind==='recover'&&m.next&&host.elapsed-m.start<m.grace)return m.next;}return 'iai1';}
// AUTO: would the row a press starts now reach this target (after its advance, which stops at the body)?
export function iaiCanReach(host:IaiHost,kit:HeroKit,target:any){
 // Same numbers as stepRow: the edge at fraction u of the window, from where the row's advance has put the hero by then
 // (a forward push stops at the body, a step back does not).
 const h=host.hero,r=kit.rows[rowFor(host,kit)],face=Math.sign(target.x-h.x)||1,gap=Math.max(0,Math.abs(target.x-h.x)-host.heroRadius-target.radius);
 // planar (boss arena): the same check along the ground direction to the target (the row faces it when pressed).
 if(host.planar){const dx=target.x-h.x,dy=target.y-h.y,d=Math.hypot(dx,dy),dir=d>1e-6?{x:dx/d,y:dy/d}:{x:h.facing<0?-1:1,y:0},pgap=Math.max(0,d-host.heroRadius-target.radius);
  for(let i=0;i<=12;i++){const u=i/12,adv=advanceAt(r.advance,r.activeFrom+(r.activeTo-r.activeFrom)*u),shift=adv>0?Math.min(adv,pgap):adv;
   if(iaiContact(r.contact,u,{x:h.x+dir.x*shift,y:h.y+dir.y*shift,elevation:h.elevation,airHeight:h.airHeight,facing:dir.x<0?-1:1,dir},target,kit.switches.heightFloor))return true;}
  return false;}
 for(let i=0;i<=12;i++){const u=i/12,adv=advanceAt(r.advance,r.activeFrom+(r.activeTo-r.activeFrom)*u),shift=adv>0?Math.min(adv,gap):adv;
  if(iaiContact(r.contact,u,{x:h.x+face*shift,y:h.y,elevation:h.elevation,airHeight:h.airHeight,facing:face},target,kit.switches.heightFloor))return true;}
 return false;
}
function autoTarget(host:IaiHost,kit:HeroKit){const h=host.hero,dist=(m:any)=>host.planar?Math.hypot(m.x-h.x,m.y-h.y):Math.abs(m.x-h.x);let best:any=null;for(const mob of host.mobs)if(mob.hp>0&&iaiCanReach(host,kit,mob)&&(!best||dist(mob)<dist(best)))best=mob;return best;}

function freeze(host:IaiHost,m:any,seconds:number,struck:any[]){
 // REV2-PORT-HOOK(HITSTOP): kernel hitstop. The hero motion clock and the struck bodies stop; Unity reads hitstopUntil / frozenUntil.
 if(seconds<=0||m.hitstopUntil!==null&&m.hitstopUntil!==undefined)return;m.hitstopLeft=seconds;m.hitstopUntil=host.elapsed+seconds;for(const mob of struck)mob.frozenUntil=host.elapsed+seconds;
}
// Contact points per active window (T1). Before T1 the 120/s rule gave 22 / 18 / 26 points over the trial windows.
const SWEEP_SAMPLES=32;
function stepRow(host:IaiHost,kit:HeroKit,dt:number,m:any){
 if(m.hitstopLeft>1e-9){m.start+=dt;m.hitstopLeft-=dt;return true;}
 const h=host.hero,r=kit.rows[m.row as RowName],c=Math.min(clipNow(host,m),r.duration);
 const adv=advanceAt(r.advance,c);if(adv!==m.advanced){if(m.dir)host.advance(m.dir.x*(adv-m.advanced),m.dir.y*(adv-m.advanced));else host.advance(m.facing*(adv-m.advanced));m.advanced=adv;}
 const lo=Math.max(r.activeFrom,m.lastClip),hi=Math.min(r.activeTo,c),struck:any[]=[];
 // T1: at least SWEEP_SAMPLES points over the whole window as well as 120 per clip second. The T1 windows are short (iai1
 // 0.05 s) and the edge fan turns 120-200 degrees in them; 120/s alone left 20-degree gaps that a far target fell through.
 // T1b (same results, cheaper): the hero copy is made once per tick, not per sample and mob, and a mob farther than the
 // edge can reach (reach end + its radius + edge half width, ground plane) is left out of the samples of this tick.
 if(hi>=lo){const n=Math.max(1,Math.ceil((hi-lo)*120),Math.ceil((hi-lo)/Math.max(1e-6,r.activeTo-r.activeFrom)*SWEEP_SAMPLES));
  const edge=m.dir?{...h,facing:m.facing,dir:m.dir}:{...h,facing:m.facing},near=host.mobs.filter(mob=>Math.hypot(mob.x-h.x,mob.y-h.y)<=r.contact.reach[1]+mob.radius+r.contact.width+1e-6);
  if(near.length)for(let i=0;i<=n;i++){const t=lo+(hi-lo)*i/n,u=(t-r.activeFrom)/Math.max(1e-6,r.activeTo-r.activeFrom);
  for(const mob of near){if(mob.hp<=0||m.hitIds.includes(mob.id))continue;const hit=iaiContact(r.contact,u,edge,mob,kit.switches.heightFloor);
   if(hit&&host.clear(mob)){m.hitIds.push(mob.id);host.strike(mob,r.damage,hit.point,m.start+ageAt(m.clipMap??null,t));struck.push(mob);}}}}
 m.lastClip=c;if(struck.length)freeze(host,m,m.hitstop,struck);
 if(m.saved&&r.next&&r.cancelAt!==null&&c>=r.cancelAt-1e-9)return startRow(host,kit,r.next,0,m.savedX,m.pendingSkill,m.savedY??0);
 if(c>=r.duration-1e-9)startRecover(host,kit,m);
 return true;
}
function stepRecover(host:IaiHost,kit:HeroKit,input:any,m:any,stick:boolean){
 const h=host.hero,age=host.elapsed-m.start;
 // the measured flick+sheathe step (back), along the facing of the row it follows; it stops when the recover is left
 const adv=advanceAt(kit.recover.advance,clipAt(m.clipMap??null,Math.min(age,m.duration)));if(adv!==m.advanced){if(m.dir)host.advance(m.dir.x*(adv-m.advanced),m.dir.y*(adv-m.advanced));else host.advance(m.facing*(adv-m.advanced));m.advanced=adv;}
 if(age>=m.sheatheAt-1e-9){
  if(m.pendingSkill!==null&&m.pendingSkill!==undefined){const slot=m.pendingSkill;m.pendingSkill=null;m.pendingPress=false;if(replace(host,{x:0,y:0,auto:false,skill:slot}))return true;}
  if(m.pendingPress){m.pendingPress=false;return startRow(host,kit,'iai1',kit.entry,m.savedX,null,m.savedY??0);}
 }
 // The stick (or AUTO with nothing in reach) leaves the ready hold once its blend is done; the engine moves on this tick.
 if(age>=m.moveReleaseAt-1e-9&&(stick||input.auto&&host.mobs.some(mob=>mob.hp>0))){h.motion=null;h.action='stay1';return false;}
 if(age>=m.duration-1e-9){h.motion=null;h.airHeight=0;h.action='stay1';}
 return true;
}
function stepSkill(host:IaiHost,kit:HeroKit,dt:number,m:any){
 if(m.hitstopLeft>1e-9){m.start+=dt;m.hitstopLeft-=dt;return true;}
 if(!m.done&&host.elapsed-m.start>=m.hitAt&&m.skillId!=='water-ring'){const struck=host.mobs.filter(mob=>mob.hp>0&&skillContains(mob,m.target,m.radius));if(struck.length)freeze(host,m,kit.skill.hitstop*kit.switches.hitstopScale,struck);}
 return false;// the engine casts on this tick as usual
}
// AUTO skill while a kit row or the recover runs, sent through host.command like the skill button (so the kit's
// skillDuringAttack switch decides). null = off or nothing to cast (AUTO presses as before); 'wait' = a skill is queued
// for the sheathe (now or earlier); 'cast' = the command replaced the motion (ready entry / ready stance / cancel switch).
// K5: with 'cancel', AUTO never cuts one of its rows (iai1-3): it finishes the cut and may chain the next one; it cuts the
// flick/sheathe (recover, after every hit window) as soon as a slot is ready. Measured (REPORT_K5, zone 1, mean of seeds 101-120)
// against "cut after activeTo": water+storm 17.45 vs 17.86 s, sun-cleave 16.36 vs 16.43 s, other sets equal: a cut after activeTo
// throws away the saved next row. The button rule is separate (a pressed skill cuts at any time).
function autoSkill(host:IaiHost,kit:HeroKit,m:any):'cast'|'wait'|null{
 if(!host.autoSkill)return null;
 if(m.pendingSkill!==null&&m.pendingSkill!==undefined)return 'wait';
 if(kit.switches.skillDuringAttack==='cancel'&&m.kind==='attack')return null;
 const s=host.autoSkill();if(s<0||!host.command({x:0,y:0,auto:true,skill:s}))return null;
 return host.hero.motion===m?'wait':'cast';
}
// One hero tick for kit motions. True = handled (the engine returns); false = the engine runs its own code.
export function iaiStep(host:IaiHost,kit:HeroKit,dt:number,input:any){
 const h=host.hero;if(!h.motion||h.motion.kit!==kit.id)return false;
 if(h.motion.kind==='skill')return stepSkill(host,kit,dt,h.motion);
 const stick=Math.hypot(input.x??0,host.planar?input.y??0:0)>.1;
 // AUTO skills (only with host.autoSkill): checked before the next cut is pressed. 'wait' = a skill waits for the sheathe, so no cut.
 if(input.auto&&!stick&&(h.motion.kind==='attack'||h.motion.kind==='recover')){const s=autoSkill(host,kit,h.motion);if(s==='cast')return true;if(s!=='wait'){const t=autoTarget(host,kit);if(t){if(host.planar)iaiPress(host,kit,t.x-h.x,t.y-h.y);else iaiPress(host,kit,Math.sign(t.x-h.x)||1);}else if(h.motion.kind==='recover'&&host.elapsed-h.motion.start>=h.motion.moveReleaseAt-1e-9)return stepRecover(host,kit,input,h.motion,false);}}
 const m=h.motion;if(!m||m.kit!==kit.id)return false;
 if(m.kind==='attack')return stepRow(host,kit,dt,m);
 if(m.kind==='recover')return stepRecover(host,kit,{...input,auto:false},m,stick);
 return false;
}
// Kit timing for a reference skill: the one baked clip (Mist Finer) times every skill. Only storm-call takes the overrides
// (reach/radius/ahead); the engine passes spec.ahead to skillAim, so the other skills keep the default 130.
export function iaiSkill<T extends {id:string}>(kit:HeroKit,spec:T):T{return {...spec,duration:kit.skill.duration,hitAt:kit.skill.hitAt,...kit.skill.overrides[spec.id]};}
