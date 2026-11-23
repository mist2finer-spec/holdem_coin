import test from 'node:test';import assert from 'node:assert/strict';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import {SOURCE_TRAVERSAL as p} from '../../src/lib/rpg-traversal-profile';
import {PINK_IAI} from '../../src/lib/rpg-hero-kit-iai';
import {ATTACK_CANCEL_SECONDS} from '../../src/lib/rpg-action-cancel';
import zoneTenArena from '../../src/lib/generated/zone-ten-arena.json';
// Emergency evade (user 2026-11-23, maintenance/auto-manual-20261123/BRIEF3_rule_change_KO.md): a normal attack (kit rows iai1-3 in
// every part: wind-up, contact window, after it, and the flick/sheathe and ready hold that follow) is cut at once by roll, jump or
// slide, AUTO on or off: the press is taken on its tick, the attack-cancel cut (0.04 s stay1) runs and the evade starts. A skill,
// pressed or AUTO's, is not cut by them (rule 1, unchanged). Side lane (zone 1) and the zone-10 arena (quarter), kit hero.
const auto=(on:boolean)=>({x:0,y:0,auto:on});
type Make=()=>any;
function lane():any{const g:any=new MountSundayEngine(111,p);g.heroKit=PINK_IAI;g.groundAt=()=>0;g.hero.elevation=0;g.readyZone=0;g.spawned=30;
 g.mobs=[{id:1,species:1003,room:0,x:g.hero.x+60,y:g.hero.y,elevation:0,hp:1e6,maxHP:1e6,radius:12.5,bodyHeight:31,state:'idle',nextAttack:1e9,facing:-1}];return g;}
function arena():any{const g:any=new UnityBossEngine(111,{slimeCount:0,bossHP:1e6,playerHP:1e6},zoneTenArena);g.heroKit=PINK_IAI;g.traversal=p;g.enterArena(false);return g;}
const FIELDS:[string,Make][]=[['lane',lane],['arena',arena]];
function phase(g:any){const m=g.hero.motion;if(!m)return 'idle';
 if(m.kit&&m.kind==='attack'){const age=g.elapsed-m.start,a=m.timeline.active[0];return m.row+':'+(age<a.from*m.duration-1e-9?'windup':age<=a.to*m.duration+1e-9?'hit':'after');}
 if(m.kit&&m.kind==='recover')return 'recover:'+(g.elapsed-m.start<m.sheatheAt-1e-9?'sheathe':'hold');return m.kind;}
const PHASES=['iai1:windup','iai1:hit','iai1:after','iai2:windup','iai2:hit','iai2:after','iai3:windup','iai3:hit','iai3:after','recover:sheathe','recover:hold'];
// Drive: AUTO on = AUTO attacks the target by itself; AUTO off = the attack button every tick until row 3 has started, then nothing
// (so the flick/sheathe and the ready hold follow). Tick t of the drive is the same in every fresh copy.
function drive(g:any,on:boolean,t:number,state:{row3:boolean}){if(!on&&!state.row3)g.command({...auto(false),attack:true});g.step(.02,auto(on));if(g.hero.motion?.row==='iai3')state.row3=true;}
function firstTicks(make:Make,on:boolean){const g=make(),st={row3:false},at:Record<string,number>={};
 for(let t=0;t<400;t++){drive(g,on,t,st);const ph=phase(g);if(at[ph]===undefined)at[ph]=t;}return at;}
function at(make:Make,on:boolean,t:number){const g=make(),st={row3:false};for(let i=0;i<=t;i++)drive(g,on,i,st);return g;}

for(const [field,make] of FIELDS)for(const on of [false,true])test(`${field}, AUTO ${on?'on':'off'}: roll / jump / slide cut every part of a normal attack on the press tick`,()=>{
 const first=firstTicks(make,on);
 // AUTO on with a target in reach never stands in the ready hold (it presses row 1 as soon as the sword is home).
 for(const ph of PHASES.filter(x=>!(on&&x==='recover:hold'))){assert.notEqual(first[ph],undefined,`${field}: the drive reaches ${ph}`);
  for(const kind of ['dodge','jump','slide']){const g=at(make,on,first[ph]);assert.equal(phase(g),ph);const attackId=g.hero.motion.attackId,t0=g.elapsed;
   assert.equal(g.command({...auto(on),[kind]:true}),true,`${field} ${ph}: ${kind} taken`);
   const c=g.hero.motion;assert.equal(c.kind,'cancel',`${ph} ${kind}: attack-cancel shape`);assert.equal(c.next.kind,kind);assert.equal(c.cancelledAttackId,attackId);
   assert.ok(Math.abs(c.next.start-t0-ATTACK_CANCEL_SECONDS)<1e-9,`${ph} ${kind}: starts after the 0.04 s cut`);
   g.step(.02,auto(on));g.step(.02,auto(on));assert.equal(g.hero.motion?.kind,kind,`${field} ${ph}: ${kind} running 0.04 s after the press`);}}
});

test('a skill, pressed or AUTO\'s, is not cut by roll / jump / slide (rule 1 unchanged)',()=>{
 for(const [field,make] of FIELDS)for(const by of ['press','auto'])for(const kind of ['dodge','jump','slide']){const g=make();g.skillEnabled[0]=true;g.skillIds[0]='stormcall';
  if(by==='press')assert.equal(g.command({...auto(false),skill:0}),true);else{g.autoSkills=true;g.step(.02,auto(true));}
  const s=g.hero.motion;assert.equal(s?.kind,'skill',`${field} ${by}: casting`);g.step(.02,auto(by==='auto'));
  assert.equal(g.command({...auto(by==='auto'),[kind]:true}),false,`${field} ${by} skill: ${kind} refused`);assert.equal(g.hero.motion,s);}
});
