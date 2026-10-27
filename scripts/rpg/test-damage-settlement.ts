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
