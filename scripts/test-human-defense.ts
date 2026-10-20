import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowHumanDefense,humanDefenseEstimate,HUMAN_DEFENSE_THRESHOLD} from '../src/lib/poker-human-defense.ts';
import {decideLiveBot,normalizeLiveAction} from '../src/lib/poker-live.ts';
import type {Card} from '../src/lib/poker-engine.ts';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer.ts';
const cards=(a:string,b:string)=>[a,b].map(c=>({rank:c[0],suit:c[1]} as Card));
function spot(own=cards('7♣','7♦'),opponent=cards('A♣','5♦')) {
  return [
    {seatId:0,isBot:true,stack:4400,currentBet:600,totalBet:600,inHand:true,folded:false,allIn:false,holeCards:own},
    {seatId:1,isBot:false,stack:48200,currentBet:1800,totalBet:1800,inHand:true,folded:false,allIn:false,holeCards:opponent},
  ];
}
test('private comparison defends 77 against a deep human A5 three-bet using a boolean only',()=>{
  const seats=spot();const result=humanDefenseEstimate(seats,0,1)!;
  assert.ok(result.equity>HUMAN_DEFENSE_THRESHOLD);assert.ok(result.callEV>0);
  assert.equal(allowHumanDefense({seats,actorId:0,humanId:1,board:[],raiseLevel:2}),true);
  seats[0].stack=19400;
  assert.equal(allowHumanDefense({seats,actorId:0,humanId:1,board:[],raiseLevel:2}),true);
});
test('dominated hands below 46 percent remain folds; CPU raises and postflop never use the oracle',()=>{
  const seats=spot(cards('A♣','5♦'),cards('A♥','A♠'));
  assert.ok(humanDefenseEstimate(seats,0,1)!.equity<HUMAN_DEFENSE_THRESHOLD);
  assert.equal(allowHumanDefense({seats,actorId:0,humanId:1,board:[],raiseLevel:2}),false);
  const good=spot();
  for(const opt of [{board:cards('2♥','3♠'),raiseLevel:2},{board:[],raiseLevel:0}])
    assert.equal(allowHumanDefense({seats:good,actorId:0,humanId:1,...opt}),false);
  good[1].isBot=true;assert.equal(humanDefenseEstimate(good,0,1),null);
});
test('all-in calls cap to CPU stack, not deep human overbet, and exclude the inaccessible side pot',()=>{
  const seats=spot(cards('A♦','Q♦'),cards('Q♠','3♠'));
  seats[0].stack=1000;seats[1].stack=20000;seats[1].currentBet=seats[1].totalBet=30000;
  const result=humanDefenseEstimate(seats,0,1)!;
  assert.ok(result.equity>.65);assert.ok(result.callEV>0&&result.callEV<2040);
  const baseline=humanDefenseEstimate([{...seats[0]},{...seats[1],currentBet:1600,totalBet:1600}],0,1)!;
  assert.deepEqual(result,baseline,'uncallable excess is not counted as winnable chips');
});
test('46 percent alone cannot force a negative-EV call after rake',()=>{
  const seats=spot(cards('K♣','Q♦'),cards('2♥','2♠'));
  seats[0].stack=5000;seats[0].currentBet=seats[0].totalBet=0;
  seats[1].stack=0;seats[1].allIn=true;seats[1].currentBet=seats[1].totalBet=5000;
  const result=humanDefenseEstimate(seats,0,1)!;
  assert.ok(result.equity>=HUMAN_DEFENSE_THRESHOLD);assert.ok(result.callEV<0);
  assert.equal(allowHumanDefense({seats,actorId:0,humanId:1,board:[],raiseLevel:2}),false);
});
test('extra players use modeled ranges, never their actual private cards, and comparison does not mutate state',()=>{
  const seats=spot();seats.push({...seats[0],seatId:2,stack:3200,currentBet:1800,totalBet:1800,holeCards:cards('A♥','A♠')});
  const before=JSON.stringify(seats),first=humanDefenseEstimate(seats,0,1)!;
  assert.equal(JSON.stringify(seats),before);
  seats[2].holeCards=cards('2♥','3♠');
  assert.deepEqual(humanDefenseEstimate(seats,0,1),first);
  seats[1].folded=true;assert.equal(humanDefenseEstimate(seats,0,1),null);
});
test('final defense crosses a hard preflop fold gate; postflop and existing raises stay unchanged',()=>{
  const seats=spot(cards('7♣','2♦'),cards('3♣','2♥'));
  const trainer={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
  const ctx={actor:seats[0],seats,board:[] as Card[],pot:0,minRaise:3600,maxRaise:5000,
    button:1,smallBlind:0,bigBlind:1,hand:1,raiseLevel:2,openedPreflop:true};
  assert.equal(decideLiveBot(trainer,ctx).action,'fold');
  const defense=decideLiveBot(trainer,{...ctx,allowHumanCall:()=>true});
  assert.deepEqual(defense,{action:'call',amount:1200});
  assert.deepEqual(normalizeLiveAction(seats,0,defense,1200),defense);
  seats[0].stack=500;
  const short=decideLiveBot(trainer,{...ctx,allowHumanCall:()=>true});
  assert.deepEqual(short,{action:'allin',amount:500});
  const board=cards('4♥','8♠');board.push({rank:'T',suit:'♥'});
  assert.equal(decideLiveBot(trainer,{...ctx,board,allowHumanCall:()=>{throw Error('postflop oracle accessed');}}).action,'fold');
});
