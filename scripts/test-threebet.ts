import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Card} from '../src/lib/poker-engine.ts';
import {shortStackOptions,decideShortStack} from '../src/lib/poker-shortstack.ts';
import {stackContext} from '../src/lib/poker-stack.ts';
import {positionContext} from '../src/lib/poker-position.ts';
import {planPreflop} from '../src/lib/poker-preflop.ts';
import {mapLiveDecision,normalizeLiveAction} from '../src/lib/poker-live.ts';

function spot(a:Card['rank']='9',b:Card['rank']=a,price=1800) {
  const seats=[
    {seatId:0,stack:4400,currentBet:600,totalBet:600,inHand:true,folded:false,allIn:false},
    {seatId:1,stack:5000-price,currentBet:price,totalBet:price,inHand:true,folded:false,allIn:price===5000},
    {seatId:2,stack:4700,currentBet:300,totalBet:300,inHand:false,folded:true,allIn:false},
  ];
  const hole:Card[]=[{rank:a,suit:'♠'},{rank:b,suit:a===b?'♥':'♠'}];
  const context={actorId:0,seats,openedPreflop:true,stack:stackContext(seats,0),position:positionContext(seats,0,1)};
  return {hole,board:[] as Card[],call:price-600,minRaise:price+(price-600),maxRaise:5000,
    pot:price+900,stack:4400,currentBet:600,raiseLevel:2,smallBlind:0,persona:{vpip:.45,aggression:.6,bluffFreq:.15},context};
}
function sample(s:ReturnType<typeof spot>,count=600) {
  const original=Math.random;let seed=2001;const counts=[0,0,0,0,0];
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{for(let i=0;i<count;i++) {
    const d=decideShortStack(s)!;counts[d.action]++;
    const mapped=mapLiveDecision(d,s.call,s.stack,s.currentBet);
    assert.ok(normalizeLiveAction(s.context.seats,0,mapped,s.minRaise-(s.currentBet+s.call)));
  }}finally{Math.random=original;}
  return counts;
}

test('original opener gets a three-bet policy at ordinary 9BB sizing; cold calls and four-bets do not',()=>{
  const s=spot();
  assert.equal(shortStackOptions(s)!.threeBet,true);
  assert.equal(shortStackOptions({...s,context:{...s.context,openedPreflop:false}}),null);
  assert.equal(shortStackOptions({...s,raiseLevel:3}),null);
  assert.equal(planPreflop(s).decision,null,'planner must defer to EV defense');
});

test('88/99/AQs defend a reasonably priced three-bet with calls and/or reshoves',()=>{
  for(const [a,b] of [['8','8'],['9','9'],['A','Q']] as [Card['rank'],Card['rank']][]) {
    const s=spot(a,b),counts=sample(s);
    assert.ok(counts[0]<220,JSON.stringify({a,b,counts}));
    assert.ok(counts[1]>100,JSON.stringify({a,b,counts}));
    assert.ok(counts[1]+counts[2]+counts[4]>380);
  }
});

test('defense remains price sensitive: expensive 88 and KQs do not force marginal shoves',()=>{
  for(const [a,b] of [['8','8'],['K','Q']] as [Card['rank'],Card['rank']][]) {
    const s=spot(a,b,2400),counts=sample(s,100);
    assert.equal(counts[0],100,JSON.stringify({a,b,counts,options:shortStackOptions(s)}));
  }
});

test('all-in three-bet can only be called or folded, with no dry-side-pot raises',()=>{
  const s=spot('A','A',5000),options=shortStackOptions(s)!;
  assert.equal(options.canRaise,false);assert.ok(options.callEV>0);
  const counts=sample(s,100);
  assert.equal(counts[1],100);assert.equal(counts[2]+counts[4],0);
});

test('very low connectors keep their rare-call gate and cannot enter three-bet defense',()=>{
  const s=spot('2','3');
  assert.equal(planPreflop(s).decision?.action,'fold');
  assert.equal(shortStackOptions(s)!.playable,false);
});

test('opened suited connectors reach the EV policy rather than a hard price cutoff',()=>{
  const s=spot('7','6',1200);
  assert.equal(planPreflop(s).decision,null);
  assert.ok(shortStackOptions(s));
});

test('medium and deep original openers get priced defense with actual flat calls',()=>{
  for(const chips of [5001,6000,10000,25000]) {
    const s=spot();
    for(const seat of s.context.seats)seat.stack+=chips-5000;
    s.stack+=chips-5000;s.maxRaise=chips;s.context.stack=stackContext(s.context.seats,0);
    assert.equal(planPreflop(s).decision,null);
    assert.equal(shortStackOptions(s)!.threeBet,true);
    const counts=sample(s);
    assert.ok(counts[1]>250,JSON.stringify({chips,counts}));
    assert.ok(counts[1]>counts[4],JSON.stringify({chips,counts}));
  }
  const s=spot();s.context.stack.ownStack=10001;
  assert.equal(shortStackOptions(s)!.threeBet,true,'deep openers also use the priced defense');
  assert.equal(shortStackOptions({...s,raiseLevel:1,context:{...s.context,openedPreflop:false,stack:{...s.context.stack,ownStack:6000}}}),null,
    'initial-open short-stack policy does not widen automatically');
});

test('affordable opened connectors can be evaluated at 9BB but not forced into a negative-EV call',()=>{
  const s=spot('7','6');
  assert.equal(shortStackOptions(s)!.playable,true,'24% incremental cost is within new 30% gate');
  assert.ok(shortStackOptions(s)!.callEV<0);
  assert.equal(sample(s,100)[0],100);
  const expensive=spot('7','6',2200);
  assert.equal(shortStackOptions(expensive)!.playable,false);
});

test('near-EV 3-bet defense mixes prefer calls over jams without eliminating aggression',()=>{
  for(const aggression of [.60,.78]) {
    const s=spot();s.persona.aggression=aggression;
    const counts=sample(s,2000);
    assert.ok(counts[1]>counts[4],JSON.stringify({aggression,counts}));
    assert.ok(counts[4]>100,JSON.stringify({aggression,counts}));
  }
});

test('clearly profitable non-premium defense has no unconditional random-fold floor',()=>{
  const s=spot('T','T');
  const old=Math.random;Math.random=()=>0.999999;
  try {assert.notEqual(decideShortStack(s)!.action,0);}
  finally {Math.random=old;}
});

test('small blind pairs enter only a priced positive-EV call policy; non-blinds remain restricted',()=>{
  for(const rank of ['2','3','4','5'] as Card['rank'][]) {
    const s=spot(rank,rank,600);
    Object.assign(s.context.seats[0],{stack:4800,currentBet:200,totalBet:200});
    Object.assign(s.context.seats[2],{stack:4800,currentBet:200,totalBet:200});
    for(let seatId=3;seatId<8;seatId++)s.context.seats.push({seatId,stack:4800,currentBet:200,totalBet:200,inHand:false,folded:true,allIn:false});
    Object.assign(s,{call:400,currentBet:200,stack:4800,pot:2000,raiseLevel:1,minRaise:1000});
    s.context={...s.context,openedPreflop:false,stack:stackContext(s.context.seats,0),isBlind:true} as typeof s.context;
    const options=shortStackOptions(s)!;
    assert.equal(options.playable,true);assert.ok(options.callEV>0,JSON.stringify({rank,options}));
    const counts=sample(s);
    assert.ok(counts[1]>250,JSON.stringify({rank,counts}));
    assert.equal(counts[2]+counts[4],0,'extra small-pair entry does not grant a shove');
    assert.equal(shortStackOptions({...s,context:{...s.context,isBlind:false}})!.playable,false);
  }
  const s=spot('2','2',600);
  Object.assign(s.context.seats[0],{stack:4800,currentBet:200,totalBet:200});
  Object.assign(s,{call:400,currentBet:200,stack:4800,pot:1100,raiseLevel:1,minRaise:1000});
  Object.assign(s.context.seats[2],{stack:5000,currentBet:0,totalBet:0});
  s.pot=800;
  const priced={...s,context:{...s.context,openedPreflop:false,isBlind:true,stack:stackContext(s.context.seats,0)}};
  assert.ok(shortStackOptions(priced)!.callEV<0);
  assert.equal(sample(priced,100)[0],100);
});
