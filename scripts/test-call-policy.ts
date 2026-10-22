import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Card} from '../src/lib/poker-engine.ts';
import type {DecisionContext} from '../src/lib/poker-ai.ts';
import {estimateCallEquity,estimateEquity,modeledCallEV,calledActionEV} from '../src/lib/poker-ai.ts';
import {preflopCallModel} from '../src/lib/poker-opponent-model.ts';
import {planPreflop,preflopPosition} from '../src/lib/poker-preflop.ts';
import {shortStackOptions,decideShortStack} from '../src/lib/poker-shortstack.ts';
import {stackContext} from '../src/lib/poker-stack.ts';
import {positionContext} from '../src/lib/poker-position.ts';
const hole:Card[]=[{rank:'A',suit:'♣'},{rank:'Q',suit:'♥'}];
function context():DecisionContext {
 const seats=Array.from({length:6},(_,seatId)=>({seatId,stack:10000,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false}));
 Object.assign(seats[0],{currentBet:400,totalBet:400,stack:9600});
 Object.assign(seats[1],{inHand:false,folded:true});
 Object.assign(seats[2],{stack:7447});
 Object.assign(seats[4],{currentBet:100,totalBet:100,stack:4900});
 Object.assign(seats[5],{currentBet:200,totalBet:200,stack:4800});
 return {boardLength:0,actorId:2,seats,lastRaiserSeat:0,stack:stackContext(seats,2),position:positionContext(seats,2,3),preflopPosition:preflopPosition(seats.map(s=>s.seatId),2,3,5,0)};
}

test('unacted seats are uncertain callers; the opener and dead contributions are retained',()=>{
 const c=context(),before=JSON.stringify(c),m=preflopCallModel(c);
 assert.equal(m.committed,1);assert.equal(m.pending,3);assert.equal(m.scenarios.length,2);
 assert.ok(Math.abs(m.scenarios.reduce((sum,s)=>sum+s.weight,0)-1)<1e-12);
 assert.deepEqual(m.scenarios.map(s=>s.context.seats.filter(p=>p.inHand&&!p.folded&&p.seatId!==2).length),[1,2]);
 for(const s of m.scenarios){
  assert.ok(s.context.seats[0].inHand);
  assert.deepEqual(s.context.seats.map(p=>p.totalBet),c.seats.map(p=>p.totalBet));
 }
 assert.equal(JSON.stringify(c),before,'decision projections cannot mutate the live table');
});

test('actual cold callers and all-in players cannot be projected away',()=>{
 const c=context();Object.assign(c.seats[1],{inHand:true,folded:false,currentBet:400,totalBet:400});
 Object.assign(c.seats[3],{stack:0,currentBet:100,totalBet:100,allIn:true});
 const m=preflopCallModel(c);assert.equal(m.committed,3);
 for(const s of m.scenarios)for(const id of [0,1,3])assert.ok(s.context.seats[id].inHand&&!s.context.seats[id].folded);
});

test('postflop and unopened pots keep their real multiway field',()=>{
 const c=context();
 assert.equal(preflopCallModel({...c,boardLength:3}).scenarios[0].context.seats,c.seats);
 const unopened={...c,seats:c.seats.map(s=>({...s,currentBet:Math.min(200,s.currentBet)}))};
 assert.equal(preflopCallModel(unopened).scenarios.length,1);
});

test('heads-up called EV is unchanged, including contribution accounting',()=>{
 const c=context();c.seats=c.seats.map(s=>s.seatId===0||s.seatId===2?s:{...s,inHand:false,folded:true});
 assert.equal(modeledCallEV(hole,[],c,400,.05,'open',192),calledActionEV(hole,[],c,400,.05,'open',192));
});

test('history #291: AQo can flat a 2BB open instead of treating three pending seats as callers',()=>{
 const c=context();const eq=estimateCallEquity(hole,[],c,192,'open');
 assert.ok(eq>estimateEquity(hole,[],4,192,'open'));
 const decision=planPreflop({hole,board:[],call:400,pot:700,stack:7447,currentBet:0,minRaise:600,maxRaise:7447,
  raiseLevel:1,smallBlind:4,persona:{vpip:.47,aggression:.35,bluffFreq:.15},context:c}).decision;
 assert.deepEqual(decision,{action:'call',amount:400});
});

test('a priced medium pair at 20BB retains a real call option; short-stack trash stays excluded',()=>{
 const c=context();c.seats[2].stack=3900;c.stack=stackContext(c.seats,2);
 const s={hole:[{rank:'8',suit:'♦'},{rank:'8',suit:'♣'}] as Card[],board:[] as Card[],call:400,pot:700,stack:3900,currentBet:0,minRaise:600,maxRaise:3900,
  raiseLevel:1,smallBlind:4,persona:{vpip:.45,aggression:.60,bluffFreq:.20},context:c};
 const options=shortStackOptions(s)!;assert.ok(options.playable);assert.ok(options.callEV>0,JSON.stringify(options));
 const original=Math.random;Math.random=()=>.25;
 try{assert.equal(decideShortStack(s)?.action,1);}finally{Math.random=original;}
 assert.equal(shortStackOptions({...s,hole:[{rank:'7',suit:'♥'},{rank:'2',suit:'♣'}]})?.playable,false);
});
