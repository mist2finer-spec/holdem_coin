import test from 'node:test';import assert from 'node:assert/strict';
import {RogueEngine,type RogueInput} from '../../src/components/rpg/rogue/engine';
import {RogueService} from '../../src/lib/rpg-rogue-service';
import {RogueVisualClock,projectRogueHero} from '../../src/components/rpg/rogue/presentation';
import {ROGUE_PACE,rogueAttackTiming,roguePollDelay} from '../../src/components/rpg/rogue/pace';
import {hongMotionTime} from '../../src/components/rpg/hong-combat-motion';
const idle:RogueInput={x:0,y:0,auto:false};
const advance=(g:RogueEngine,seconds:number,input=idle)=>{for(let i=0;i<Math.ceil(seconds/.01);i++)g.step(.01,input);};
test('visual clock fills snapshot gaps at frame rate, never rewinds, freezes on disconnect and death',()=>{
 const clock=new RogueVisualClock();clock.receive(2,10);const times=Array.from({length:7},(_,i)=>clock.sample(10+i/60));assert.equal(new Set(times).size,7);assert.ok(times.every((v,i)=>!i||v>times[i-1]));
 assert.ok(Math.abs(clock.sample(12)-2.15)<1e-8);clock.receive(2.1,12);assert.ok(clock.sample(12)>=2.15);assert.ok(Math.abs(clock.sample(14)-2.25)<1e-8);assert.ok(Number.isFinite(clock.sample(NaN)));
 clock.receive(2.2,15,false);assert.equal(clock.sample(100),2.2);clock.receive(0,101);assert.equal(clock.sample(101),0);
});
test('attack poses progress between packets; contact stays aligned to recovered per-hit schedule',()=>{
 const clock=new RogueVisualClock();clock.receive(0,0);const {duration,hitAt}=rogueAttackTiming(1);
 const samples=Array.from({length:6},(_,i)=>hongMotionTime(clock.sample(i/60),duration,hitAt,.5,.2,true));assert.equal(new Set(samples).size,6);
 assert.ok(duration<.56);assert.ok(rogueAttackTiming(5).duration>duration);assert.ok(rogueAttackTiming(5).hitAt>hitAt);
 for(let i=1;i<=5;i++){const t=rogueAttackTiming(i);assert.ok(Math.abs(hongMotionTime(t.hitAt,t.duration,t.hitAt,1,.35,true)-.35)<1e-9);}
});
test('manual preview responds without a server packet, remains bounded and never changes authoritative state',()=>{
 const g=new RogueEngine(3);g.mobs.forEach(m=>m.hp=0);const v=g.view(),before=JSON.stringify(v),input={...idle,x:1,auto:true};
 const predicted=projectRogueHero(v,g.map,.1,input);assert.equal(predicted.x,v.hero.x+ROGUE_PACE.moveSpeed*.1);assert.equal(predicted.action,'run1');assert.equal(JSON.stringify(v),before);assert.equal(g.kills,0);assert.equal(g.gold,0);
 assert.equal(projectRogueHero(v,g.map,100,input).x,v.hero.x+ROGUE_PACE.moveSpeed*.15);
 Object.assign(v.hero,{x:(g.map.rooms[0].x2+1)*48-13,action:'run1'});const boundary=projectRogueHero(v,g.map,.15,input);assert.ok(boundary.x<=(g.map.rooms[0].x2+1)*48-12);
 assert.equal(projectRogueHero(v,g.map,.15,idle).action,'stay1');v.status='dead';assert.equal(projectRogueHero(v,g.map,.15,input).x,v.hero.x);
});
test('manual preview cannot tunnel through an intervening monster',()=>{
 const g=new RogueEngine(2);g.mobs.forEach(m=>m.hp=0);const m=g.mobs[0];m.hp=100;m.x=g.hero.x+30;
 const v=g.view(),p=projectRogueHero(v,g.map,.15,{...idle,x:1});assert.ok(m.x-p.x>=12+m.radius-1);assert.equal(v.mobs[0].hp,100);
});
test('jump presentation samples the real traversal but cannot spawn the next room or grant rewards',()=>{
 const g=new RogueEngine(5);g.mobs.forEach(m=>m.hp=0);g.step(.01,idle);const gate=g.map.gates[0];Object.assign(g.hero,gate.from);g.command({...idle,jump:true});const view=g.view(),before=JSON.stringify(view),m=view.hero.motion!;
 const p=projectRogueHero(view,g.map,m.start+m.duration*.5,idle);assert.ok(p.x>m.from.x&&p.x<m.to.x);assert.ok(p.airHeight>0);assert.equal(JSON.stringify(view),before);assert.equal(g.room,0);assert.deepEqual(g.transitions,[]);
});
test('server catches up 50–1000ms jitter, duplicates do not manufacture time, reconnects stay bounded',()=>{
 let now=0;const service=new RogueService(()=>now,()=>4),v=service.start('pace','hong');service.command('pace',v.id,1,idle);
 now=600;const a=service.command('pace',v.id,2,idle);assert.ok(Math.abs(a.elapsed-.6)<1e-8);
 now=1100;assert.deepEqual(service.command('pace',v.id,2,idle),a);const b=service.command('pace',v.id,3,idle);assert.ok(Math.abs(b.elapsed-1.1)<1e-8);
 assert.throws(()=>service.command('pace',v.id,5,idle));now=1050;const back=service.command('pace',v.id,4,idle);assert.equal(back.elapsed,b.elapsed);now=1200;const c=service.command('pace',v.id,5,idle);assert.ok(Math.abs(c.elapsed-1.2)<1e-8);
 now=100000;const d=service.command('pace',v.id,6,{...idle,auto:true});assert.ok(Math.abs(d.elapsed-c.elapsed-.25)<1e-8);assert.equal(d.kills,0);assert.equal(d.gold,0);
});
test('normal latency partitions preserve elapsed time without client timestamps',()=>{
 for(const spacing of [50,100,200,400,800,1000]){let now=0;const service=new RogueService(()=>now,()=>3),v=service.start('jitter','hong');let view=v;for(let i=1;i<=4000/spacing;i++){now=i*spacing;view=service.command('jitter',v.id,i,idle);}assert.ok(Math.abs(view.elapsed-4)<1e-7,`spacing=${spacing}`);}
});
function rushGame(){const g=new RogueEngine(3);g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+220;m.hp=m.maxHP=10000;m.until=999;g.step(.01,{...idle,auto:true});assert.equal(g.hero.motion?.kind,'rush');return g;}
test('AUTO Rush closes distance, stays grounded/collidable and leads into normal combat',()=>{
 const g=rushGame(),m=g.mobs[0],start=g.hero.x;for(let i=0;i<70;i++){g.step(.01,{...idle,auto:true});assert.ok(m.x-g.hero.x>=12+m.radius-1);assert.equal(g.room,0);}assert.ok(g.hero.x-start>80);assert.notEqual(g.hero.motion?.kind,'rush');assert.ok(g.cooldowns[0]>0||m.hp<10000);
});
test('Rush cancels for manual control, target death, or evasion; it never makes the hero invulnerable',()=>{
 for(const input of [{...idle,x:-1,auto:true},idle]){const g=rushGame(),x=g.hero.x;g.step(.01,input);assert.equal(g.hero.motion,null);assert.equal(g.hero.x,x);}
 const dead=rushGame();dead.mobs[0].hp=0;dead.step(.01,{...idle,auto:true});assert.equal(dead.hero.motion,null);
 const dodge=rushGame();dodge.command({...idle,dodge:true});assert.equal(dodge.hero.motion?.kind,'dodge');
 const g=rushGame(),m=g.mobs[0];m.x=g.hero.x+25;m.state='windup';m.until=0;m.target={x:g.hero.x,y:g.hero.y};const hp=g.hero.hp;g.step(.01,{...idle,auto:true});assert.ok(g.hero.hp<hp);
});

test('input bursts honor a 50ms request floor and never push the fixed retry deadline back',()=>{
 for(let now=0;now<=100;now+=5)assert.equal(now+roguePollDelay(0,now),Math.max(50,now));
 for(let now=100;now<=300;now+=5)assert.equal(now+roguePollDelay(100,now,300),300);
 assert.equal(roguePollDelay(100,310,300),0);assert.equal(roguePollDelay(100,310,0,true),290);
});
