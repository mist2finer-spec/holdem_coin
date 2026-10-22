import {test} from 'node:test';
import assert from 'node:assert/strict';
import {humanDefenseEstimate} from '../src/lib/poker-human-defense';
import {decideLiveBot} from '../src/lib/poker-live';
import type {Card} from '../src/lib/poker-engine';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer';
const cards=(a:string,b:string)=>[a,b].map(c=>({rank:c[0],suit:c[1]} as Card));
function spot(){return [
 {seatId:0,isBot:true,stack:4400,currentBet:600,totalBet:600,inHand:true,folded:false,allIn:false,holeCards:cards('7♣','7♦')},
 {seatId:1,isBot:false,stack:48200,currentBet:1800,totalBet:1800,inHand:true,folded:false,allIn:false,holeCards:cards('A♣','5♦')},
];}
test('public range estimate is invariant to every opponent private card and human/CPU identity',()=>{
 const s=spot(),before=JSON.stringify(s),first=humanDefenseEstimate(s,0,1);
 assert.ok(first&&Number.isFinite(first.equity)&&Number.isFinite(first.callEV));assert.equal(JSON.stringify(s),before);
 s[1].holeCards=cards('A♥','A♠');assert.deepEqual(humanDefenseEstimate(s,0,1),first);
 s[1].holeCards=[];s[1].isBot=true;assert.deepEqual(humanDefenseEstimate(s,0,1),first);
});
test('range estimate respects side-pot eligibility and does not count covering excess as winnings',()=>{
 const s=spot();s[0].stack=1000;s[1].currentBet=s[1].totalBet=30000;
 const excess=humanDefenseEstimate(s,0,1);s[1].currentBet=s[1].totalBet=1600;
 assert.deepEqual(humanDefenseEstimate(s,0,1),excess);
});
test('live bot never invokes a private-card referee to bypass entry gates',()=>{
 const seats=spot();seats[0].holeCards=cards('7♣','2♦');
 const trainer={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 const action=decideLiveBot(trainer,{actor:seats[0],seats,board:[],pot:0,minRaise:3000,maxRaise:5000,
  button:1,smallBlind:0,bigBlind:1,hand:1,raiseLevel:2,openedPreflop:true,
  allowHumanCall:()=>{throw Error('private-card callback accessed');}});
 assert.equal(action.action,'fold');
});
