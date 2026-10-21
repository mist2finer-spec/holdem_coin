import test from 'node:test';
import assert from 'node:assert/strict';
import {humanHitHint,postflopSupport} from '../src/lib/poker-postflop-support';
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
test('multiple human hit hints are aggregate only and any made hand prevents allMiss',()=>{
 const seats=[{seatId:0,isBot:false,inHand:true,folded:false,holeCards:cards('AK')},{seatId:1,isBot:false,inHand:true,folded:false,holeCards:cards('Q9')}];
 assert.deepEqual(humanHitHint(seats,spot.board,0),{humans:2,allMiss:false,bettorMiss:true});
 assert.equal(humanHitHint(seats.map(s=>({...s,holeCards:cards('AK')})),spot.board,0).allMiss,true);
 assert.equal(humanHitHint([],spot.board,0).allMiss,false);
});
test('tight IP probes stay between one third and three quarters; OOP or hit blocks probe',()=>{
 const c={...spot,base:tight,persona:tight,isOOP:false,hint:{humans:2,allMiss:true,bettorMiss:false}};
 const rolls=[.1,.9];const d=postflopSupport(c,check,()=>rolls.shift()!);
 assert.equal(d.action.action,'raise');assert.ok(d.action.amount>=400&&d.action.amount<=900);
 assert.deepEqual(postflopSupport({...c,isOOP:true},check,()=>0).action,check);
 assert.deepEqual(postflopSupport({...c,hint:{...c.hint,allMiss:false}},check,()=>0).action,check);
});
test('hit hint cannot force an expensive/all-in call or an air-hand catch',()=>{
 const fold={action:'fold' as const,amount:0};
 const c={...spot,base:tight,persona:tight,call:1000,hint:{humans:1,allMiss:true,bettorMiss:true}};
 assert.deepEqual(postflopSupport(c,fold,()=>0).action,fold);
 assert.deepEqual(postflopSupport({...c,call:200},fold,()=>0).action,fold);
});
