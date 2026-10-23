import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settleHand,type SettlementSeat} from '../src/lib/poker-rules';
import {decideLiveBot} from '../src/lib/poker-live';
import {RPG_BOT_POOL} from '../src/lib/personas';
import {proCatchDecision} from '../src/lib/poker-pro';
import {riverCatchDecision,riverRangeEquity} from '../src/lib/poker-river-defense';
import {smallOpenDefenseHand,preflopPosition} from '../src/lib/poker-preflop';
import {pricedCallGuard} from '../src/lib/poker-priced-call';
import type {Card} from '../src/lib/poker-engine';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer';
const cards=(raw:string)=>raw.split(' ').map(s=>({rank:s[0],suit:s.slice(1)} as Card));
const seat=(seatId:number,totalBet=200,currentBet=200):SettlementSeat=>({seatId,name:`P${seatId}`,totalBet,currentBet,stack:5000-totalBet,inHand:true,folded:false,allIn:false,holeCards:cards(seatId?'K♠ K♥':'A♠ A♥')});
const fake={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
test('priced preflop floor protects the full requested hand families despite rejected EV branches',(t)=>{
 t.mock.method(Math,'random',()=>.999);
 const hands=['2♠ 2♥','8♠ 8♥','A♠ 2♠','A♠ 5♠','K♠ 9♠','Q♠ 9♠','J♠ 9♠','5♠ 4♠','7♠ 6♠','A♠ T♥','K♠ J♥','Q♠ J♥'];
 for(const hole of hands){
  assert.equal(smallOpenDefenseHand(cards(hole)),true,hole);
  const seats=[seat(0),seat(1,400,400)];
  const action=decideLiveBot(fake,{actor:{...seats[0],holeCards:cards(hole),persona:RPG_BOT_POOL[0]},seats,board:[],pot:0,minRaise:800,maxRaise:5000,button:0,smallBlind:0,bigBlind:1,hand:1,raiseLevel:1});
  assert.ok(['call','raise','allin'].includes(action.action),hole);
 }
 assert.equal(smallOpenDefenseHand(cards('7♠ 2♥')),false);
 const seats=[seat(0),seat(1,1200,1200)];
 assert.equal(decideLiveBot(fake,{actor:{...seats[0],holeCards:cards('5♠ 4♠')},seats,board:[],pot:0,minRaise:2400,maxRaise:5000,button:0,smallBlind:0,bigBlind:1,hand:1,raiseLevel:3}).action,'fold');
});
test('late seats are physical CO/BTN/SB, not an isOOP proxy after folds',()=>{
 const ids=[0,1,2,3,4,5];
 assert.deepEqual(ids.filter(id=>preflopPosition(ids,id,3,5).late),[2,3,4]);
 assert.equal(preflopPosition(ids,5,3,5).late,false);
});
test('Pro below a 52% trait threshold accepts a profitable priced AJo without private cards',()=>{
 const seats=[seat(0,1000,400),seat(1,1200,600)];
 Object.defineProperty(seats[1],'holeCards',{get(){throw Error('Private cards read');}});
 const g=proCatchDecision({persona:{...RPG_BOT_POOL[0],role:'pro',catchEquity:.52},hole:cards('A♣ J♦'),board:[],seats,actorId:0})!;
 assert.ok(g.equity<g.threshold);assert.ok(g.callEV>0);assert.equal(g.accepted,true);
});
test('river clear-EV full house calls even when the random roll would always reject',()=>{
 const board=cards('A♦ K♥ 8♣ 8♠ 2♦'),seats=[seat(0,1000,0),seat(1,2000,1000)];
 const g=riverCatchDecision({hole:cards('A♠ A♥'),board,seats,actorId:0,base:RPG_BOT_POOL[0],persona:RPG_BOT_POOL[0]},()=>{throw Error('Frequency sampled for a forced catch');})!;
 assert.ok(g.forced&&g.accepted&&g.callEV>0);
});
test('marginal positive-EV river air still uses the personality mix',()=>{
 const hole=cards('A♠ 3♥'),board=cards('K♣ Q♦ 9♠ 7♥ 2♣');
 const equity=riverRangeEquity(hole,board);assert.ok(equity>0&&equity<.5);
 const price=equity-.005,cost=Math.max(1,Math.round(price*1000/(1-2*price)));
 const ctx={hole,board,seats:[seat(0,500,0),seat(1,500+cost,cost)],actorId:0,base:RPG_BOT_POOL[0],persona:RPG_BOT_POOL[0]};
 const g=riverCatchDecision(ctx,()=>.999)!;assert.ok(g.eligible&&!g.forced&&!g.accepted,JSON.stringify(g));
 assert.equal(riverCatchDecision(ctx,()=>0)!.accepted,true);
});
test('15% cheap-call floor works on a flop with live side-pot actors, but never prices ineligible money',()=>{
 const seats=[seat(0,1000,0),seat(1,1100,100),seat(2,1100,100)];
 const g=pricedCallGuard({hole:cards('A♦ 3♣'),board:cards('K♠ Q♥ 9♣'),seats,actorId:0,bigBlindSeat:2,raiseLevel:1,bigBlind:200})!;
 assert.ok(g.forced&&g.accepted&&g.requiredEquity<=.15);
});
test('contested rake handles preflop steal, aggregate flop pot, side pots, short three-bet and BB scaling',()=>{
 const steals=[seat(0,5000,5000),{...seat(1),inHand:false,folded:true}];
 const steal=settleHand(steals,[],0);assert.equal(steal.rakePolicy.contestedPot,400);assert.equal(steal.totalRake,0);assert.equal(steal.results[0].refund,4800);
 const flop=cards('2♣ 7♦ J♥');
 assert.equal(settleHand([seat(0,1300,800),seat(1,1300,800)],flop,0).totalRake,130);
 assert.equal(settleHand([seat(0),seat(1)],[],0,undefined,{preflopRaiseLevel:2}).totalRake,20);
 assert.equal(settleHand([seat(0,400,400),seat(1,400,400)],[],0).totalRake,40);
 assert.equal(settleHand([seat(0,400,400),seat(1,400,400)],[],0,undefined,{bigBlind:400}).totalRake,0);
 const side=settleHand([seat(0,1000),seat(1,2000),seat(2,3000)],cards('2♣ 7♦ J♥ 8♣ 9♦'),0);
 assert.deepEqual(side.pots.map(p=>p.rake),[150,100,0]);
 assert.equal(side.results.reduce((sum,r)=>sum+r.payout,0)+side.totalRake,6000);
});
