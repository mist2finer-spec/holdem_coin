import test from 'node:test';
import assert from 'node:assert/strict';
import {postflopSupport} from '../src/lib/poker-postflop-support';
import {RPG_BOT_POOL} from '../src/lib/personas';
import type {Card} from '../src/lib/poker-engine';
const cards=(r:string)=>[...r].map((rank,i)=>({rank:rank as Card['rank'],suit:(i%2?'♥':'♠') as Card['suit']}));
const aggressive=RPG_BOT_POOL.find(p=>p.id==='orc_berserker')!;
const tight=RPG_BOT_POOL.find(p=>p.id==='paladin_commander')!;
const spot:Parameters<typeof postflopSupport>[0]={hole:cards('AK'),board:cards('279'),base:aggressive,persona:aggressive,call:0,pot:1200,stack:4000,currentBet:0,minRaise:200,maxRaise:4000,canRaise:true,isOOP:true,initiative:true,checked:false,opponents:1};
const check={action:'check' as const,amount:0};
test('missed flop cbet is 65 percent with quarter-pot sizing, once only',()=>{
 let bets=0;for(let i=0;i<100;i++){const d=postflopSupport(spot,check,()=>i/100);if(d.action.action==='raise'){bets++;assert.equal(d.action.amount,300);}}
 assert.equal(bets,65);
 for(const patch of [{checked:true},{initiative:false},{board:cards('279J')},{call:200},{canRaise:false}])assert.deepEqual(postflopSupport({...spot,...patch},check,()=>0).action,check);
});
test('made hands retain larger value actions and short stacks do not turn probes into shoves',()=>{
 const shove={action:'allin' as const,amount:4000};
 assert.deepEqual(postflopSupport({...spot,hole:cards('99')},shove,()=>0).action,shove);
 assert.deepEqual(postflopSupport({...spot,maxRaise:250,stack:250},check,()=>0).action,check);
});
test('tight probes use own equity, position and personality instead of hidden hit flags',()=>{
 const c={...spot,base:tight,persona:{...tight,bluffFreq:.2},isOOP:false};
 const rolls=[0,.9];const d=postflopSupport(c,check,()=>rolls.shift()!);
 assert.equal(d.action.action,'raise');assert.ok(d.action.amount>=400&&d.action.amount<=900);
 assert.deepEqual(postflopSupport({...c,isOOP:true},check,()=>0).action,check);
 assert.deepEqual(postflopSupport({...c,persona:{...tight,bluffFreq:0}},check,()=>0).action,check);
});
test('public range defense cannot force an expensive/all-in call or an air-hand catch',()=>{
 const fold={action:'fold' as const,amount:0};
 const c={...spot,base:tight,persona:tight,call:1000};
 assert.deepEqual(postflopSupport(c,fold,()=>0).action,fold);
 assert.deepEqual(postflopSupport({...c,call:200},fold,()=>0).action,fold);
});
const parse=(s:string):Card[]=>s.split(' ').map(c=>({rank:c[0],suit:c[1]} as Card));
const valueSpot={...spot,hole:parse('A♠ A♥'),board:parse('A♦ 7♣ 2♥'),initiative:false};
test('strong value checks can lead OOP or bet IP; pot sizes have equal selection mass',()=>{
 for(const isOOP of [true,false]){
  const counts=new Map<number,number>();
  for(let i=0;i<300;i++){
   const rolls=[0,(i+.5)/300];const d=postflopSupport({...valueSpot,isOOP},check,()=>rolls.shift()!);
   assert.equal(d.path,'persona-value-bet');assert.equal(d.action.isBluff,false);
   counts.set(d.action.amount,(counts.get(d.action.amount)||0)+1);
  }
  assert.deepEqual([...counts.entries()],[[300,100],[600,100],[900,100]]);
 }
});
test('personality controls value lead frequency and preserves traps and existing value raises',()=>{
 const run=(persona:typeof aggressive)=>Array.from({length:100},(_,i)=>{const rolls=[i/100,0];return postflopSupport({...valueSpot,persona},check,()=>rolls.shift()!).path==='persona-value-bet';}).filter(Boolean).length;
 assert.ok(run(aggressive)>run(tight));assert.ok(run(tight)>0&&run(aggressive)<100);
 const raise={action:'raise' as const,amount:1800};assert.deepEqual(postflopSupport(valueSpot,raise,()=>0).action,raise);
});
test('value support does not act into a bet, after own check, or in dry side pots; board-only nuts stay checks',()=>{
 for(const patch of [{call:200},{checked:true},{canRaise:false},{minRaise:1000},{maxRaise:250}])
  assert.deepEqual(postflopSupport({...valueSpot,...patch},check,()=>0).action,check);
 assert.deepEqual(postflopSupport({...valueSpot,hole:parse('2♣ 3♦'),board:parse('A♠ K♠ Q♠ J♠ T♠')},check,()=>0).action,check);
});
