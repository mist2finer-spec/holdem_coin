import {test} from 'node:test';
import assert from 'node:assert/strict';
import {raiseSizing,minimumRaiseTo,clampRaiseTo,potFractionSizing} from '../src/lib/poker-sizing.ts';
import {OpponentModel} from '../src/lib/poker-opponent-model.ts';
import {normalizeLiveAction} from '../src/lib/poker-live.ts';
import {shortStackOptions,decideShortStack} from '../src/lib/poker-shortstack.ts';
import {stackContext} from '../src/lib/poker-stack.ts';
import {positionContext} from '../src/lib/poker-position.ts';
import type {Card} from '../src/lib/poker-engine.ts';

test('2x raise totals and integer-tenth multipliers do not contain rake or floating-point drift',()=>{
  assert.equal(minimumRaiseTo(200),400);assert.equal(minimumRaiseTo(600),1200);
  assert.equal(minimumRaiseTo(0),200);
  const first=raiseSizing(100,100,4900,400,5000);
  assert.equal(first.target,400);assert.equal(first.label,'2X');
  for(const tenths of [31,32,33,40,100]) {
    const result=raiseSizing(100,100,4900,400,5000,tenths);
    assert.equal(result.target,tenths*20);assert.match(result.label,/^\d+(\.\d)?X$/);
  }
  assert.equal(raiseSizing(0,600,6000,1200,6000,30).target,1800);
  assert.equal(raiseSizing(0,0,5000,200,5000).target,400);
  assert.equal(raiseSizing(100,100,4900,400,5000,0).selected,20);
});

test('short-stack multiplier clamps to the full available total and permits exactly-minimum all-ins',()=>{
  const short=raiseSizing(100,100,350,400,450,30);
  assert.equal(short.target,450);assert.equal(short.allIn,true);assert.equal(short.canRaise,true);
  assert.equal(clampRaiseTo(800,450,900),450);
  const exact=raiseSizing(0,200,400,400,400,30);
  assert.equal(exact.target,400);assert.equal(exact.canRaise,true);assert.equal(exact.allIn,true);
  const noRaise=raiseSizing(0,600,500,1200,600);
  assert.equal(noRaise.canRaise,false);
  const max=raiseSizing(100,100,4873,400,4973,9999);
  assert.equal(max.target,4973);assert.equal(max.allIn,true);
});

test('pot shortcuts use post-call pot and street totals, enforcing minimums and stack caps without rake',()=>{
  for(const [fraction,expected] of [[.25,400],[.5,800],[.75,1200]])
    assert.equal(potFractionSizing(0,0,5000,200,5000,1600,fraction).target,expected);
  assert.equal(potFractionSizing(200,400,4800,1200,5000,1800,.25).target,1200);
  assert.equal(potFractionSizing(200,400,4800,1200,5000,1800,.5).target,1700);
  assert.equal(potFractionSizing(200,400,4800,1200,5000,1800,.75).target,2250);
  const capped=potFractionSizing(100,100,500,400,600,10000,.25);
  assert.deepEqual(capped,{target:600,canRaise:true,allIn:true});
  const short=potFractionSizing(100,100,250,400,350,300,.25);
  assert.deepEqual(short,{target:350,canRaise:true,allIn:true});
  assert.equal(potFractionSizing(0,600,500,1200,500,2000,.75).canRaise,false);
});

test('server enforces a double street total, preserving short all-in exception and chip conservation',()=>{
  const seats=[{seatId:0,stack:1500,currentBet:100,totalBet:100,inHand:true,folded:false,allIn:false},
    {seatId:1,stack:4400,currentBet:600,totalBet:600,inHand:true,folded:false,allIn:false}];
  assert.equal(normalizeLiveAction(seats,0,{action:'raise',amount:1000},400),null);
  assert.deepEqual(normalizeLiveAction(seats,0,{action:'raise',amount:1200},400),{action:'raise',amount:1200});
  seats[0].stack=900;
  assert.deepEqual(normalizeLiveAction(seats,0,{action:'raise',amount:1000},400),{action:'allin',amount:900});
});

test('opponent reads require repeated public opportunities, count once per hand and forget old pressure',()=>{
  const model=new OpponentModel();
  for(let hand=1;hand<=5;hand++) {
    model.observe('wide',hand,1,400,true);model.observe('wide',hand,1,400,true);
    model.observe('irrelevant',hand,0,200,true);
  }
  assert.equal(model.read('wide').opportunities,5);assert.equal(model.read('wide').looseness,0);
  assert.equal(model.read('irrelevant').opportunities,0);
  for(let hand=6;hand<=15;hand++)model.observe('wide',hand,1,400,true);
  assert.ok(model.read('wide').looseness>.7);
  assert.equal(model.read('new-player').looseness,0);
  for(let hand=16;hand<70;hand++)model.observe('wide',hand,1,400,false);
  assert.equal(model.read('wide').opportunities,40);assert.equal(model.read('wide').looseness,0);
  for(let n=0;n<200;n++)model.observe('seat-'+n,1,1,200,true);
  assert.equal(model.read('wide').opportunities,0,'bounded player memory');
});

function multiway() {
  const seats=[
    {seatId:0,stack:2791,currentBet:440,totalBet:440,inHand:true,folded:false,allIn:false},
    {seatId:1,stack:6489,currentBet:968,totalBet:968,inHand:true,folded:false,allIn:false},
    {seatId:2,stack:6874,currentBet:968,totalBet:968,inHand:true,folded:false,allIn:false},
    {seatId:3,stack:15865,currentBet:440,totalBet:440,inHand:true,folded:false,allIn:false},
    {seatId:4,stack:4900,currentBet:100,totalBet:100,inHand:false,folded:true,allIn:false},
  ];
  const hole:Card[]=[{rank:'A',suit:'♥'},{rank:'Q',suit:'♥'}];
  return {hole,board:[] as Card[],call:528,minRaise:1936,maxRaise:3231,pot:2916,stack:2791,currentBet:440,raiseLevel:2,
    persona:{vpip:.565,aggression:.95,bluffFreq:.14},context:{seats,actorId:0,openedPreflop:true,
      stack:stackContext(seats,0),position:positionContext(seats,0,4),lastRaiserSeat:1}};
}
test('multiway AQ suited defense separates the three-bettor from ordinary callers',()=>{
  const spot=multiway();
  const mixed=shortStackOptions(spot)!,uniform=shortStackOptions({...spot,context:{...spot.context,lastRaiserSeat:undefined}})!;
  assert.ok(mixed.callEV>0);assert.ok(mixed.callEV>uniform.callEV);
  const previous=Math.random;Math.random=()=>.25;
  try {assert.notEqual(decideShortStack(spot)!.action,0);}finally {Math.random=previous;}
});

test('public loose three-bet reads improve priced defense but do not force trash or all-in calls',()=>{
  const spot=multiway();
  const normal=shortStackOptions(spot)!;
  const wide={...spot,context:{...spot.context,threeBetRead:{opportunities:16,rate:.5,looseness:.7}}};
  assert.ok(shortStackOptions(wide)!.callEV>normal.callEV);
  const trash={...wide,hole:[{rank:'T',suit:'♠'},{rank:'4',suit:'♥'}] as Card[]};
  assert.equal(decideShortStack(trash)!.action,0);
  const allIn={...wide,context:{...wide.context,seats:wide.context.seats.map((s,i)=>i===1?{...s,stack:0,allIn:true}:s)}};
  assert.equal(shortStackOptions(allIn)!.looseness,0);
});
