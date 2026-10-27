import test from 'node:test';
import assert from 'node:assert/strict';
import {settleDamage,armorDamage} from '../../src/components/rpg/hunt-damage';
const state={hp:100,maxHP:100,shield:50};
test('shield spending, HP damage and gross damage are separate and state remains immutable',()=>{
 const result=settleDamage(state,80);assert.equal(result.hp,70);assert.equal(result.shield,0);assert.equal(result.hpDamage,30);assert.equal(result.grossDamage,80);assert.deepEqual(result.triggers,[15,12]);assert.equal(state.shield,50);
});
test('native positive shield bonus uses the verified conversion expression',()=>{
 const result=settleDamage({...state,shield:200},100,50);assert.equal(result.shieldSpent,150);assert.equal(result.hpDamage,50);assert.equal(result.hp,50);
});
test('invulnerability and invulnerable shield respect the explicit bypass flag',()=>{
 for(const properties of [{invincible:true},{invincibleShield:true}]){
  const result=settleDamage({...state,...properties},100);assert.equal(result.hp,100);assert.equal(result.shield,50);assert.equal(result.flags,BigInt(0x2000));
  assert.equal(settleDamage({...state,...properties},100,0,BigInt(0x4000)).hp,50);
 }
});
test('dead and immune actors dispatch no passive events; one-damage actors cap before absorption',()=>{
 assert.equal(settleDamage({...state,actorFlags:0x200},90).grossDamage,1);
 assert.deepEqual(settleDamage({...state,hp:0},90).triggers,[]);assert.deepEqual(settleDamage({...state,actorFlags:0x400},90).triggers,[]);
 assert.deepEqual(settleDamage({...state,shield:0},500).triggers,[12,11]);
});
test('high damage flags survive settlement, and groggy is independent of HP armor',()=>{
 const flags=BigInt('0x100000001')|BigInt(64);
 assert.equal(settleDamage(state,1,0,flags).flags,flags);
 assert.equal(armorDamage({critical:2,physical:3,magical:4,basic:5,skill:6},flags),10);
});
test('bad numeric inputs cannot corrupt a battle state',()=>{
 assert.throws(()=>settleDamage(state,NaN));assert.throws(()=>settleDamage({...state,shield:-1},1));
});

test('player attacks spend the enemy shield before HP and cannot award a shield-only kill',async()=>{
 const {HuntEngine}=await import('../../src/components/rpg/hunt-engine');
 const g=new HuntEngine();g.enemyX=g.x+40;g.enemies[0].shield=1000;const hp=g.enemyHP,kills=g.kills;
 assert.equal(g.attack(),true);for(let i=0;i<100;i++)g.step(.01,0);
 assert.ok((g.enemies[0].shield??1000)<1000);assert.equal(g.enemyHP,hp);assert.equal(g.lastDamage,0);assert.equal(g.kills,kills);
});
test('fallback monster attacks honor the hero shield and report only HP damage',async()=>{
 const {HuntEngine}=await import('../../src/components/rpg/hunt-engine');
 const g=new HuntEngine(undefined,1,{hostile:true});g.enemyX=g.x+40;g.heroShield=1e6;
 for(let i=0;i<170;i++)g.step(.01,0);
 assert.ok(g.heroShield<1e6);assert.equal(g.hp,g.maxHP);assert.equal(g.lastHeroDamage,0);
});
test('recovered monster impactors use the same shield settlement',async()=>{
 const {HuntEngine}=await import('../../src/components/rpg/hunt-engine');
 const {LABYRINTH}=await import('../../src/components/rpg/hunt-labyrinth');
 const g=new HuntEngine(undefined,7,{hostile:true,campaign:true});g.heroShield=1e6;
 const command=structuredClone(LABYRINTH.actions[2010].commands[0]);command.speed=0;command.width=80;command.effects=[{phase:'Moving',type:1,value:100,duration:0,target:2}];command.moving=true;
 g.impactors.push({id:1,source:g.enemies[0].serial,x:g.x,targetX:g.x,direction:1,command,born:0,expires:1,hits:{}});
 g.step(.01,0);assert.ok(g.heroShield<1e6);assert.equal(g.hp,g.maxHP);assert.equal(g.lastHeroDamage,0);
});
