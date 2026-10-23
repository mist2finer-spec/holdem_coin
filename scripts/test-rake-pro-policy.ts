import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settleHand} from '../src/lib/poker-rules';
import {applyLiveAction,normalizeLiveAction} from '../src/lib/poker-live';
import {afterRakeOdds,calledActionEV} from '../src/lib/poker-ai';
import {assignBotStrategy,RPG_BOT_POOL} from '../src/lib/personas';
import {proCatchDecision} from '../src/lib/poker-pro';
import type {Card} from '../src/lib/poker-engine';
const board='TJQKA'.split('').map(rank=>({rank,suit:'♣'} as Card));
const seats=()=>[0,1].map(seatId=>({seatId,name:'P'+seatId,stack:5000,currentBet:0,totalBet:0,peakStreetBet:0,
 inHand:true,folded:false,allIn:false,hasActed:false,holeCards:[{rank:'2',suit:seatId?'♥':'♠'},{rank:'3',suit:seatId?'♥':'♠'}] as Card[]}));
test('postflop rake uses the whole contested pot, regardless of a single street threshold',()=>{
 for(const price of [899,900]){
  let s=seats().map(p=>applyLiveAction(p,{action:'raise',amount:price}));
  s=s.map(p=>({...p,currentBet:0}));
  s=s.map(p=>applyLiveAction(p,{action:'raise',amount:200}));
  const r=settleHand(s,board,0);
  assert.equal(r.totalRake,Math.floor((price+200)*2*.05));
  assert.equal(r.results.reduce((n,p)=>n+p.payout,0)+r.totalRake,(price+200)*2);
 }
});
test('trigger includes a folded bettor, preflop wins; unmatched amount remains untaxed',()=>{
 const s=seats();s[0]=applyLiveAction(s[0],{action:'allin',amount:5000});
 s[1]={...s[1],totalBet:200,currentBet:200,stack:4800,folded:true,inHand:false};
 const r=settleHand(s,[],0);assert.equal(r.totalRake,0);assert.equal(r.results[0].refund,4800);assert.equal(r.results[0].payout,5200);
 s[0].folded=true;s[0].inHand=false;s[1].inHand=true;s[1].folded=false;
 assert.equal(settleHand(s,[],0).totalRake,0);
});
test('postflop cumulative matched chips activate rake even with sub-900 bets',()=>{
 const s=seats().map(p=>({...p,currentBet:0,totalBet:2000,peakStreetBet:800}));
 assert.equal(settleHand(s,board,0).totalRake,200);
});
test('AI default EV and odds ignore rake even when settlement charges it',()=>{
 const s=seats().map(p=>({...p,totalBet:1000,currentBet:1000,peakStreetBet:1000}));
 assert.equal(afterRakeOdds(300,100),.25);
 assert.equal(calledActionEV(s[0].holeCards,board,{seats:s,actorId:0},200),1000);
 assert.equal(settleHand(s,board,0).totalRake,100);
});
test('one visual identity can independently receive any strategy, including Pro',()=>{
 const appearance=RPG_BOT_POOL[0];const before=JSON.stringify(appearance);
 const assigned=RPG_BOT_POOL.map((_,i)=>assignBotStrategy(appearance,()=>i/RPG_BOT_POOL.length));
 assert.equal(new Set(assigned.map(p=>p.id)).size,RPG_BOT_POOL.length);
 assert.ok(assigned.some(p=>p.role==='pro'));
 assert.ok(assigned.every(p=>p.name===appearance.name&&p.portrait===appearance.portrait));
 assert.equal(JSON.stringify(appearance),before);
});
test('Pro profitable tied-board calls bypass a 52% personality threshold',()=>{
 const s=seats();s[1]={...s[1],currentBet:1000,totalBet:2000};s[0].totalBet=1000;
 const pro={...RPG_BOT_POOL[0],role:'pro' as const,catchEquity:.45};
 const ctx={persona:pro,hole:s[0].holeCards,board,seats:s,actorId:0};
 assert.equal(proCatchDecision(ctx)?.accepted,true);
 assert.equal(proCatchDecision({...ctx,persona:{...pro,catchEquity:.52}})?.accepted,true);
 assert.equal(proCatchDecision({...ctx,persona:RPG_BOT_POOL[0]}),null);
});
test('Pro never raises or forces a negative-price call; normalization keeps closed rights',()=>{
 const s=seats();s[0].totalBet=1;s[1]={...s[1],currentBet:5000,totalBet:5000,stack:0,allIn:true};
 const ctx={persona:{...RPG_BOT_POOL[0],role:'pro' as const,catchEquity:.45},hole:s[0].holeCards,board:'AKQJ9'.split('').map(rank=>({rank,suit:'♣'} as Card)),seats:s,actorId:0};
 assert.equal(proCatchDecision(ctx)?.accepted,false);
 assert.deepEqual(normalizeLiveAction(s,0,{action:'call'},200,false),{action:'allin',amount:5000});
});
