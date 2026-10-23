import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StreetBetting,recordedAction} from '../src/lib/poker-betting';
import {minimumRaiseTo} from '../src/lib/poker-sizing';
import {normalizeLiveAction} from '../src/lib/poker-live';
import {rakedContributionLayers,settleHand} from '../src/lib/poker-rules';
import {uncontestedActionEV} from '../src/lib/poker-ai';
import {positionContext} from '../src/lib/poker-position';
import type {Card} from '../src/lib/poker-engine';
const seats=()=>[0,1,2].map(seatId=>({seatId,stack:5000,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false,name:'P'+seatId,holeCards:[] as Card[]}));
test('600 raise over 200 gives next minimum 1000, then 1400; short all-ins preserve increment',()=>{
 const r=new StreetBetting();assert.equal(r.record(2,200,600),true);assert.equal(minimumRaiseTo(600,200,r.lastFullRaise),1000);
 r.record(0,600,600);assert.equal(r.record(1,600,750),false);assert.equal(r.lastFullRaise,400);
 assert.equal(r.canRaise(2,750),false);assert.equal(r.canRaise(0,750),false);assert.equal(r.canRaise(7,750),true);
 assert.equal(r.canRaise(2,1000),true,'cumulative short all-ins reopen only when a full increment is faced');
 r.record(2,1000,1400);assert.equal(minimumRaiseTo(1400,200,r.lastFullRaise),1800);
});
test('checking before the first short opening bet preserves raise rights',()=>{
 const r=new StreetBetting();r.record(0,0,0);r.record(1,0,100);assert.equal(r.canRaise(0,100),true);
});
test('closed raising rights reject raises and restrict an ALL-IN shortcut to a call',()=>{
 const s=seats();s[0].currentBet=600;s[1].currentBet=750;s[1].allIn=true;s[1].stack=0;
 assert.equal(normalizeLiveAction(s,0,{action:'raise',amount:1150},400,false),null);
 assert.deepEqual(normalizeLiveAction(s,0,{action:'allin',amount:5000},400,false),{action:'call',amount:150});
});
test('preflop minimum bring-in stays BB when a multiway blind is short',()=>{
 const s=seats();s[0].currentBet=100;s[1].currentBet=100;s[1].allIn=true;
 assert.deepEqual(normalizeLiveAction(s,2,{action:'call'},200,true,200),{action:'call',amount:200});
});
test('contested pot and flop entry trigger rake; refunds stay untaxed',()=>{
 const s=seats().slice(0,2);s[0].totalBet=20000;Object.assign(s[0],{peakStreetBet:20000});s[1].totalBet=200;s[1].folded=true;s[1].inHand=false;
 const pre=settleHand(s,[],0);assert.equal(pre.totalRake,0);assert.equal(pre.results[0].refund,19800);assert.equal(pre.results[0].payout,20200);
 const flop=[{rank:'2',suit:'♣'},{rank:'7',suit:'♦'},{rank:'J',suit:'♥'}] as Card[];
 const post=settleHand(s,flop,0);assert.equal(post.totalRake,20);assert.equal(post.results[0].refund,19800);assert.equal(post.results[0].payout,20180);
 assert.equal(post.results.reduce((n,r)=>n+r.payout,0)+post.totalRake,20200);
 assert.equal(uncontestedActionEV({seats:s,actorId:0,boardLength:3},1000),20200);
 const rounded=seats();rounded.forEach((s,i)=>s.totalBet=[1,2,100][i]);const layers=rakedContributionLayers(rounded,.05);
 assert.equal(layers.filter(p=>p.refundSeatId!==undefined).reduce((n,p)=>n+p.rake,0),0);
 assert.equal(layers.reduce((n,p)=>n+p.rake,0),0);
});
test('opening postflop bets and IP/OOP use actionable positions, excluding all-ins',()=>{
 assert.equal(recordedAction('raise',0,3),'bet');assert.equal(recordedAction('raise',200,3),'raise');assert.equal(recordedAction('allin',0,3),'allin');
 const s=seats();assert.equal(positionContext(s,0,2).isOOP,true);assert.equal(positionContext(s,2,2).isOOP,false);
 s[2].allIn=true;s[2].stack=0;assert.equal(positionContext(s,1,2).isOOP,false);
});

test('real server applies short-all-in rights and records standard minima for human/CPU analysis',async()=>{
 const {HybridHoldemRoom}=await import('../mini-services/poker-server/index');
 const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
 room.state.seats=[5000,750,5000].map((start,seatId)=>({...seats()[seatId],isBot:true,hasActed:false,
  stack:start-(seatId===0?100:seatId===1?200:0),currentBet:seatId===0?100:seatId===1?200:0,
  totalBet:seatId===0?100:seatId===1?200:0}));
 room.state.board=[];room.state.phase='PREFLOP';room.currentHistory={actions:[],streets:[]};
 const calls:number[][]=[];const decisions=[{action:'raise',amount:600},{action:'call',amount:500},{action:'allin',amount:550},{action:'call',amount:150},{action:'call',amount:150}];
 room.getDecision=async(a:any,call:number,min:number,max:number)=>{calls.push([a.seatId,call,min,max]);return decisions.shift();};
 await room.runBettingRound(0,2,[]);
 assert.deepEqual(calls.map(a=>a[0]),[2,0,1,2,0]);
 assert.deepEqual(calls.map(a=>a[2]),[400,1000,1000,1150,1150]);
 assert.equal(calls[3][3],750);assert.equal(calls[4][3],750);
 assert.equal(room.state.lastRaiseSize,400);assert.equal(room.state.raiseLevel,1);
 assert.deepEqual(room.currentHistory.actions.map((a:any)=>a.canRaiseBefore),[true,true,true,false,false]);
});
