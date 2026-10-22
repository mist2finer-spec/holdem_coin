import test from 'node:test';
import assert from 'node:assert/strict';
import {marginalThreeBetFlat,marginalFlatFrequency} from '../src/lib/poker-marginal-flat';
import {decideLiveBot,normalizeLiveAction} from '../src/lib/poker-live';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer';
import {RPG_BOT_POOL} from '../src/lib/personas';
import {stackContext} from '../src/lib/poker-stack';
import type {Card} from '../src/lib/poker-engine';
const cards=(s:string):Card[]=>s.split(' ').map(c=>({rank:c[0],suit:c.slice(1)} as Card));
function spot(){
 const seats=[{seatId:0,stack:4600,totalBet:400,currentBet:400,inHand:true,folded:false,allIn:false},
  {seatId:1,stack:4200,totalBet:800,currentBet:800,inHand:true,folded:false,allIn:false},
  {seatId:2,stack:4700,totalBet:300,currentBet:300,inHand:false,folded:true,allIn:false}];
 return {hole:cards('5♠ 5♥'),board:[] as Card[],base:{...RPG_BOT_POOL[0],vpip:.45,aggression:.7},
  persona:{vpip:.45,aggression:.7},raiseLevel:2,context:{actorId:0,seats,openedPreflop:true,lastRaiserSeat:1,
   threeBetRead:{opportunities:12,rate:.25,looseness:.4},stack:stackContext(seats,0),
   position:{isOOP:false,relativePosition:1,opponents:1,checkedThisStreet:false,preflopEquityPremium:0}}};
}
test('conditional call mixture is bounded to 5–15 percent and respects character, position and public read',()=>{
 const tight={vpip:.18,aggression:.2},loose={vpip:.65,aggression:.85};
 assert.equal(marginalFlatFrequency(tight,tight,true),.05);
 assert.ok(marginalFlatFrequency(loose,loose,false,.8)>marginalFlatFrequency(tight,tight,false));
 for(const base of [tight,loose])for(const isOOP of [true,false])for(const read of [0,.5,1]){
  const rate=marginalFlatFrequency(base,loose,isOOP,read);assert.ok(rate>=.05&&rate<=.15);
 }
 const s=spot(),audit=marginalThreeBetFlat(s,()=>.99)!;assert.equal(audit.eligible,true);
 let calls=0;for(let i=0;i<1000;i++)calls+=Number(marginalThreeBetFlat(s,()=>(i+.5)/1000)?.accepted);
 assert.ok(Math.abs(calls-1000*audit.frequency)<=1);assert.ok(calls>=50&&calls<=150);
});
test('an otherwise folded pocket pair/suited broadway gets only a legal affordable flat',()=>{
 for(const hole of ['5♠ 5♥','T♠ J♠','A♠ J♠','K♠ Q♠']){
  const s=spot();s.hole=cards(hole);const r=marginalThreeBetFlat(s,()=>0)!;
  assert.equal(r.accepted,true,JSON.stringify({hole,r}));assert.equal(r.cost,400);
  const legal=normalizeLiveAction(s.context.seats,0,{action:'call',amount:r.cost},400,false,200)!;
  assert.equal(legal.action,'call');assert.ok(legal.amount<s.context.seats[0].stack);
 }
});
test('no premium oracle: changing an opponent hidden card or identity cannot affect the result',()=>{
 const s=spot(),before=marginalThreeBetFlat(s,()=>0);
 Object.defineProperty(s.context.seats[1],'holeCards',{enumerable:true,get(){throw Error('private cards read');}});
 Object.defineProperty(s.context.seats[1],'name',{enumerable:true,get(){throw Error('identity read');}});
 assert.deepEqual(marginalThreeBetFlat(s,()=>0),before);
});
test('cold calls, four-bets, shoves, multiway, weak trash, huge prices and very short stacks retain folds',()=>{
 for(const kind of ['cold','fourbet','allin','multiway','trash','large','short','postflop','stackcall','oopprice']){
  const s=spot();
  if(kind==='cold')s.context.openedPreflop=false;
  if(kind==='fourbet')s.raiseLevel=3;
  if(kind==='allin')s.context.seats[1].allIn=true;
  if(kind==='multiway')Object.assign(s.context.seats[2],{inHand:true,folded:false});
  if(kind==='trash')s.hole=cards('4♠ 3♥');
  if(kind==='large')s.context.seats[1].currentBet=2800;
  if(kind==='short')s.context.seats[0].stack=1800;
  if(kind==='postflop')s.board=cards('A♦ K♦ Q♦');
  if(kind==='stackcall')s.context.seats[0].stack=400;
  if(kind==='oopprice'){s.context.position.isOOP=true;s.context.seats[1].currentBet=1000;}
  assert.equal(marginalThreeBetFlat(s,()=>0),null,kind);
 }
});
test('public-read adaptation needs six observations and negative EV cannot exceed the small loss budget',()=>{
 const s=spot();s.context.threeBetRead={opportunities:1,rate:1,looseness:1};
 const a=marginalThreeBetFlat(s,()=>0)!;s.context.threeBetRead.looseness=0;
 assert.deepEqual(marginalThreeBetFlat(s,()=>0),a);
 for(const hole of ['5♠ 5♥','A♠ 5♠','K♠ T♠','Q♠ J♠']){
  s.hole=cards(hole);const r=marginalThreeBetFlat(s,()=>0)!;
  assert.ok(r.lossBudget<=r.cost*.10);
  if(r.accepted){assert.ok(r.ev>=-r.lossBudget);assert.ok(r.equity>=r.odds+.02);}
 }
});
test('shared single/server finish path runs one extra roll only after a fold; normal calls/raises remain intact',(t)=>{
 const s=spot(),trainer=new SelfPlayTrainer();t.mock.method(Math,'random',()=>0);
 // The original 55 gate excludes this passive persona, then the final small
 // mixture admits it. The shared trainer method remains a fold otherwise.
 t.mock.method(trainer,'decideActionForLive',()=>({action:0,amount:0}));
 const ctx={actor:{...s.context.seats[0],holeCards:s.hole,persona:{...RPG_BOT_POOL[0],vpip:.22,aggression:.3}},
  seats:s.context.seats,board:s.board,pot:0,minRaise:1200,maxRaise:5000,button:0,smallBlind:1,bigBlind:2,
  hand:1,raiseLevel:2,lastRaiserSeat:1,openedPreflop:true};
 let audit:Record<string,unknown>={};
 const d=decideLiveBot(trainer,{...ctx,onAudit:a=>{audit=a;}});
 assert.equal(d.action,'call');assert.equal(d.amount,400);assert.equal(audit.decisionPath,'marginal-three-bet-flat');
 for(const nn of [{action:1,amount:400},{action:2,amount:1600}]){
  t.mock.method(trainer,'decideActionForLive',()=>nn);
  const d=decideLiveBot(trainer,{...ctx,onAudit:a=>{audit=a;}});
  assert.equal(d.action,nn.action===1?'call':'raise');assert.equal(audit.marginalFlat,null);
 }
});
