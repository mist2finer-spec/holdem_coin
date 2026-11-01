import test from 'node:test';import assert from 'node:assert/strict';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';import {RogueService,parseRogueInput} from '../../src/lib/rpg-rogue-service';import {big} from '../../src/components/rpg/combat-big';
import {MANA,POTIONS} from '../../src/components/rpg/rogue/resources';
const idle={x:0,y:0,auto:false},small={initial:2,min:2,max:2,seconds:0,batch:2};
const step=(g:RogueEngine,seconds:number,input=idle)=>{for(let t=0;t<seconds-1e-8;t+=.02)g.step(.02,input);};
function clean(scale=1 as number|string){const g=new RogueEngine(4,small,scale);g.mobs.forEach(m=>m.hp=0);g.step(.02,idle);return g;}
test('full resources do not waste charges, both potion types restore and cap their own resource',()=>{
 const g=clean();assert.equal(g.command({...idle,potion:'health'}),false);assert.equal(g.command({...idle,potion:'mana'}),false);assert.deepEqual(g.potions,{health:3,mana:3});g.hero.hp=5000;g.mana=20;
 assert.equal(g.command({...idle,potion:'health'}),true);assert.equal(g.hero.hp,9000);assert.equal(g.mana,20);assert.equal(g.potions.health,2);assert.equal(g.view().resources.potionCooldowns.health,8);assert.equal(g.command({...idle,potion:'health'}),false);
 assert.equal(g.command({...idle,potion:'mana'}),true);assert.equal(g.mana,70);assert.equal(g.potions.mana,2);assert.equal(g.hero.hp,9000);step(g,8.02);g.hero.hp=9999;assert.equal(g.command({...idle,potion:'health'}),true);assert.equal(g.hero.hp,10000);assert.equal(g.potions.health,1);
});
test('charges exhaust, cooldown is per type, pause freezes mana and resource timers',()=>{
 const g=clean();for(let i=0;i<3;i++){g.mana=0;assert.equal(g.command({...idle,potion:'mana'}),true);step(g,8.02);}assert.equal(g.potions.mana,0);g.mana=0;assert.equal(g.command({...idle,potion:'mana'}),false);g.hero.hp=1000;assert.equal(g.command({...idle,potion:'health'}),true);const v=g.view();g.command({...idle,paused:true,potion:'health'});step(g,2,{...idle,paused:true});assert.equal(g.elapsed,v.elapsed);assert.equal(g.mana,v.resources.mana);assert.equal(g.potions.health,v.resources.potions.health);assert.equal(g.view().resources.potionCooldowns.health,v.resources.potionCooldowns.health);
});
test('mana cost is charged once at cast, regeneration is bounded and low-mana reservation resumes',()=>{
 const g=clean();assert.equal(g.command({...idle,skill:0}),true);assert.equal(g.mana,100-MANA.cost[0]);assert.equal(g.command({...idle,potion:'mana'}),true);assert.equal(g.mana,100);assert.equal(g.hero.motion?.kind,'skill');step(g,2);assert.equal(g.mana,100);
 const a=clean();a.mana=0;a.command({...idle,skill:0});assert.equal(a.cooldowns[0],0);assert.equal(a.view().pendingSkill,0);step(a,.3);assert.equal(a.cooldowns[0],0);step(a,.7);assert.ok(a.cooldowns[0]>0);assert.equal(a.view().pendingSkill,null);assert.ok(a.mana>=0&&a.mana<=100);
});
test('AUTO at zero mana falls back to basic attacks instead of stalling',()=>{
 const g=new RogueEngine(2,small);g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+45;m.hp=m.maxHP=10000;m.until=999;g.mana=0;step(g,.4,{...idle,auto:true});assert.ok(m.hp<10000);assert.ok(g.mana< MANA.cost[0]);
});
test('health potion keeps huge-HP authority in Decimal and does not interrupt an attack',()=>{
 const g=clean('1e1000');g.hero.bigHP='1e1003';g.command({...idle,attack:true});assert.equal(g.command({...idle,potion:'health'}),true);assert.ok(big(g.hero.bigHP!).eq('5e1003'));assert.equal(g.hero.hp,5000);assert.equal(g.hero.motion?.kind,'attack');assert.ok(!JSON.stringify(g.view()).includes('Infinity'));
});
test('server sequence replay cannot double drink; invalid types and mixed actions are rejected',()=>{
 let now=0;const service=new RogueService(()=>now,()=>4),v=service.start('flasks','hong');service.command('flasks',v.id,1,{...idle,skill:0});const used=service.command('flasks',v.id,2,{...idle,potion:'mana'});assert.equal(used.resources.potions.mana,2);now=100;assert.deepEqual(service.command('flasks',v.id,2,{...idle,potion:'mana'}),used);assert.equal(used.resources.mana,100);
 for(const potion of ['gold',1,null,{}])assert.throws(()=>parseRogueInput({...idle,potion}));assert.throws(()=>parseRogueInput({...idle,potion:'mana',skill:0}));assert.throws(()=>parseRogueInput({...idle,potion:'health',jump:true}));assert.equal(parseRogueInput({...idle,potion:'health'}).potion,'health');
});
