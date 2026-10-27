import test from 'node:test';
import assert from 'node:assert/strict';
import {castCommands,canUseAttack,markHit,sweptHit,type Cast,type Impactor,type MonsterAttack} from '../../src/components/rpg/hunt-actions';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {LABYRINTH} from '../../src/components/rpg/hunt-labyrinth';
import {HUNT_RULES,WORLD_WIDTH} from '../../src/components/rpg/combat-rules';
import {newHuntProgress,DEFAULT_HUNT_BALANCE,curveValue,heroStats} from '../../src/components/rpg/hunt-progression';
import {relativeStat,accuracy,effectDuration} from '../../src/components/rpg/hunt-formulas';
import {sweepHero,planDodge} from '../../src/components/rpg/hunt-collision';
import {RpgStore} from '../../src/lib/rpg-store';
const advance=(g:HuntEngine,seconds:number)=>{for(let t=0;t<seconds-1e-7;t+=.01)g.step(.01,0);};
function stage(id:number){const p=newHuntProgress();p.labyrinthStage=LABYRINTH.stages.findIndex(s=>s.id===id);return new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});}
test('original multi-impactor schedule emits once per occurrence, including final delayed command',()=>{
 const a=structuredClone(LABYRINTH.actions[2028]);assert.ok(a.commands[0].count>1);
 const c:Cast={skill:a,start:0,source:1,targetX:200,emitted:new Set()};assert.equal(castCommands(c,.1).length,0);
 const first=castCommands(c,a.commands[0].at+.001);assert.equal(first.length,1);assert.equal(castCommands(c,a.commands[0].at+.001).length,0);
 const rest=castCommands(c,a.duration+1);assert.equal(rest.length+first.length,a.commands.reduce((n,x)=>n+x.count,0));
});
test('HP/time/use constraints reject premature skills and unknown conditions fail closed',()=>{
 const a=structuredClone(LABYRINTH.actions[4030]);assert.equal(canUseAttack(a,90,0,{}),false);assert.equal(canUseAttack(a,50,0,{}),true);
 a.conditions=[{ConditionType:8,ElapsedTime:15,HpPercentThreshold:0,SkillType:0,SkillUseCount:0}];assert.equal(canUseAttack(a,100,14,{}),false);assert.equal(canUseAttack(a,100,15,{}),true);
 a.conditions[0].ConditionType=255;assert.equal(canUseAttack(a,1,100,{}),false);
});
test('fast projectiles use swept contact; phase/unique-hit records prevent repeated frame damage',()=>{
 assert.equal(sweptHit(0,500,250,12),true);assert.equal(sweptHit(0,50,250,12),false);
 const p={command:{unique:true,repeat:0},hits:{}} as Impactor;
 assert.equal(markHit(p,'hero','Moving',0),true);assert.equal(markHit(p,'hero','Arrive',1),false);
 p.command.unique=false;p.hits={};assert.equal(markHit(p,'hero','Moving',0),true);assert.equal(markHit(p,'hero','Moving',1),false);assert.equal(markHit(p,'hero','Arrive',1),true);
});
test('ranged skeleton launches before impact and does not need melee contact',()=>{
 const id=LABYRINTH.stages.find(s=>s.normal.some(n=>n[0]===1151))!.id,g=stage(id),archer=g.enemies.find(e=>e.actorType===1151)!;
 for(const e of g.enemies)if(e!==archer)e.hp=0;archer.x=g.x+240;const hp=g.hp;
 advance(g,1.32);assert.equal(g.hp,hp);assert.ok(g.impactors.length>0);advance(g,.4);assert.ok(g.hp<hp);
});
test('bosses select multiple recovered skills instead of repeating one basic strike',()=>{
 const g=stage(105);g.enemies.forEach(e=>e.hp=0);advance(g,.01);const boss=g.enemies[6];g.x=boss.x-80;const clips=new Set<string>();
 for(let i=0;i<2000;i++){g.step(.01,0);if(boss.clip)clips.add(boss.clip);}
 assert.ok(clips.size>=2,[...clips].join(','));assert.ok(g.hp>0);
});
test('boss-sized bodies block walking/roll landing and remain reachable by melee',()=>{
 const b={x:200,hp:100,radius:48};assert.equal(sweepHero(0,500,[b]),128);assert.ok(Math.abs(planDodge(0,200,[b]).destination-200)>=72);
 const g=stage(101);g.enemies.forEach(e=>e.hp=0);advance(g,.01);const b2=g.enemies[6];b2.radius=48;g.x=b2.x-150;const hp=b2.hp;g.setAuto(true);advance(g,4);assert.ok(b2.hp<hp);
});
test('exit stages clear by endpoint without requiring all kills and reward once',()=>{
 const g=stage(205);assert.equal(g.stage.objective,'출구 도달');g.x=WORLD_WIDTH-170;advance(g,.01);assert.equal(g.stage.phase,'cleared');assert.equal(g.progress.labyrinthStage,10);assert.equal(g.kills,0);
 const gold=g.progress.gold;advance(g,1);assert.equal(g.progress.gold,gold);
});
test('time limit failure cannot advance checkpoint; retry restores current stage',()=>{
 const g=stage(205);advance(g,60.1);assert.equal(g.stage.phase,'failed');assert.equal(g.hp,0);assert.equal(g.progress.labyrinthStage,9);
 assert.equal(g.revive(),false);advance(g,2);assert.equal(g.revive(),true);assert.equal(g.stage.phase,'normal');assert.equal(g.stage.remainingTime,60);
});
test('object interactions require server-side proximity and each target completes once',()=>{
 const g=stage(1002);assert.equal(g.interact(),false);for(const o of g.stage.objects){g.x=o.x;assert.equal(g.interact(),true);assert.equal(g.interact(),false);}
 advance(g,.01);assert.equal(g.stage.phase,'cleared');assert.equal(g.kills,0);
});
test('finite kill-count waves stop at the original target and cannot farm endlessly',()=>{
 const g=stage(701);g.progress.attackTraining=500;g.setAuto(true);
 for(let i=0;i<8000&&g.stage.phase!=='cleared'&&g.stage.phase!=='failed';i++){
  for(const e of g.enemies)if(e.hp>0){e.x=g.x+50;e.hp=Math.min(e.hp,1);}
  const skill=g.cooldowns.findIndex((t,index)=>index<5&&t===0);if(skill>=0)g.attack(skill);g.step(.01,0);
 }
 assert.equal(g.stage.phase,'cleared');assert.equal(g.stage.done,100);const kills=g.kills;advance(g,.5);assert.equal(g.kills,kills);
});
test('full original EXP curves fit safe integers and saved EXP can exceed the old wallet ceiling',()=>{
 assert.equal(DEFAULT_HUNT_BALANCE.maxLevel,7800);assert.equal(curveValue(DEFAULT_HUNT_BALANCE.team,7799),3178380969453950);
 const store=new RpgStore(':memory:'),s=store.load('xp');s.progress.xp=2e12;store.save('xp',s.progress,s.revision);assert.equal(store.load('xp').progress.xp,2e12);store.close();
 const p=newHuntProgress();assert.equal(heroStats(p).focus,heroStats(p).abilities[12]??0);assert.equal(heroStats(p).tenacity,heroStats(p).abilities[11]??0);
});
test('recovered relative-stat coefficients compare attacker and target, with bounded accuracy and CC',()=>{
 assert.equal(relativeStat(100,100,'Valor'),0);assert.equal(accuracy(1000,0),1);assert.ok(accuracy(0,1000)>.8);assert.equal(effectDuration(2,100,100),2);assert.ok(effectDuration(2,0,1000)<2);
});

test('escort defeat is a stage failure with no checkpoint advance',()=>{
 const g=stage(1102),enemy=g.enemies[0];for(const e of g.enemies)if(e!==enemy)e.hp=0;
 enemy.skills=[2010];enemy.damage=1e6;enemy.x=g.x-60;advance(g,1.6);
 assert.equal(g.stage.phase,'failed');assert.equal(g.stage.failure,'동료 전투 불능');assert.equal(g.progress.labyrinthStage,LABYRINTH.stages.findIndex(s=>s.id===1102));
});
test('a recovered stun interrupts attacks and expires without repeated-frame stacking',()=>{
 const g=stage(101);g.x=g.enemies[0].x-40;
 const command=structuredClone(LABYRINTH.actions[2010].commands[0]);command.width=80;command.effects=[{phase:'Moving',type:104,value:.5,duration:0,target:2}];
 g.impactors.push({id:1,source:g.enemies[0].serial,x:g.x,targetX:g.x,direction:1,command,born:0,expires:1,hits:{}});
 g.step(.01,0);assert.equal(g.attack(),false);advance(g,.6);assert.equal(g.attack(),true);
});

test('stationary timed hit areas retain their duration and repeat interval',()=>{
 const g=stage(101),command=structuredClone(LABYRINTH.actions[2010].commands[0]);command.duration=1;command.speed=0;command.repeat=.25;command.unique=false;command.width=80;
 g.impactors.push({id:1,source:g.enemies[0].serial,x:g.x,targetX:g.x,direction:1,command,born:0,expires:1,hits:{}});
 const hp=g.hp;advance(g,1.1);assert.ok(hp-g.hp>=3);assert.equal(g.impactors.length,0);
});

test('disabled original filter lists do not delete literal damage effects',()=>{
 for(const id of [2361,2376,2391]){
  const a=LABYRINTH.actions[id];
  assert.ok(a.commands.some(c=>c.effects.some(e=>e.type===1&&e.value===100)),`missing original literal damage in skill ${id}`);
 }
});
test('filter reduction never turns unresolved skill parameters into literal damage',()=>{
 for(const id of [1102,1105,1108]){
  assert.ok(LABYRINTH.actions[id].pending.some(p=>p.dataId===17),`symbolic skill ${id} needs equipped-level parameters`);
 }
});
