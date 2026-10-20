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
