import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Card} from '../src/lib/poker-engine';
import {shortStackOptions,decideShortStack} from '../src/lib/poker-shortstack';
import {positionContext} from '../src/lib/poker-position';
import {stackContext} from '../src/lib/poker-stack';
import {mapLiveDecision,normalizeLiveAction,decideLiveBot} from '../src/lib/poker-live';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer';
import {RPG_BOT_POOL} from '../src/lib/personas';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/priced-three-bet-flats.json',import.meta.url),'utf8'));
function spot(hand:number){
 const f=structuredClone(fixtures.find((f:{hand:number})=>f.hand===hand));
 const actor=f.seats.find((p:{seatId:number})=>p.seatId===f.actorId);
 return {...f,board:[] as Card[],hole:f.hole.map((c:string)=>({rank:c[0],suit:c.slice(1)} as Card)),
  stack:actor.stack,currentBet:actor.currentBet,
  context:{seats:f.seats,actorId:f.actorId,openedPreflop:true,lastRaiserSeat:f.lastRaiserSeat,threeBetRead:f.threeBetRead,
   position:positionContext(f.seats,f.actorId,f.button),stack:stackContext(f.seats,f.actorId)}};
}
for(const hand of [11,111,152,191])test(`history #${hand}: priced original-opener flat reaches EV, never a four-bet`,(t)=>{
 const s=spot(hand),o=shortStackOptions(s)!;assert.equal(o.callOnlyDefense,true);
 assert.ok(o.callEV>Math.max(1,s.pot*.02));assert.equal(o.jamEV,-Infinity);assert.equal(o.strongRaiseEV,-Infinity);
 let calls=0;
 for(let i=0;i<100;i++){
  t.mock.method(Math,'random',()=>(i+.5)/100);
  const d=decideShortStack(s)!;assert.ok([0,1].includes(d.action));calls+=Number(d.action===1);
  assert.ok(normalizeLiveAction(s.context.seats,s.actorId,mapLiveDecision(d,s.call,s.stack,s.currentBet),s.minRaise-s.currentBet-s.call));
  t.mock.restoreAll();
 }
 assert.ok(calls>=60&&calls<100);
});
test('negative controls keep weak offsuit hands excluded regardless of a cheap price',()=>{
 for(const hand of [195,217]){const s=spot(hand);assert.equal(shortStackOptions(s)!.callOnlyDefense,false);assert.equal(decideShortStack(s)!.action,0);}
});
test('extra flats are unavailable to cold callers, short stacks, shoves or larger reraises',()=>{
 for(const change of ['cold','short','allin','expensive','fourbet']){
  const s=spot(152),actor=s.context.seats.find((p:{seatId:number})=>p.seatId===s.actorId);
  if(change==='cold')s.context.openedPreflop=false;
  if(change==='short')s.context.stack.ownStack=2000;
  if(change==='allin')s.context.seats.find((p:{seatId:number})=>p.seatId===s.lastRaiserSeat).allIn=true;
  if(change==='expensive'){s.call=1000;s.pot=2700;s.context.seats.find((p:{seatId:number})=>p.seatId===s.lastRaiserSeat).currentBet=actor.currentBet+s.call;}
  if(change==='fourbet')s.raiseLevel=3;
  assert.ok(!shortStackOptions(s)?.callOnlyDefense,change);
 }
});
test('a marginal positive call EV still folds rather than treating every wider entry as a call',(t)=>{
 const s=spot(152);s.hole=[{rank:'A',suit:'♣'},{rank:'2',suit:'♣'}];
 s.persona={vpip:.4,aggression:.6,bluffFreq:.15};
 Object.assign(s,{stack:4725,currentBet:500,call:600,pot:1600,minRaise:1700,maxRaise:5225});
 s.context.seats=[{seatId:s.actorId,stack:4725,currentBet:500,totalBet:500,inHand:true,folded:false,allIn:false},
  {seatId:s.lastRaiserSeat,stack:3900,currentBet:1100,totalBet:1100,inHand:true,folded:false,allIn:false}];
 s.context.position={...s.context.position,isOOP:true,preflopEquityPremium:.07};
 s.context.stack={...s.context.stack,ownStack:5225,effectiveStack:5000,equityPremium:.04};
 s.context.threeBetRead={...s.context.threeBetRead,looseness:0};
 const o=shortStackOptions(s)!;assert.equal(o.callOnlyDefense,true);assert.ok(o.callEV>0&&o.callEV<20,JSON.stringify(o));
 t.mock.method(Math,'random',()=>0);assert.equal(decideShortStack(s)!.action,0);
});
test('SPR uses the opponent remaining stack rather than a deep covering stack',()=>{
 const s=spot(191);s.context.seats=s.context.seats.map((p:{seatId:number;currentBet:number;totalBet:number;stack:number;inHand:boolean;folded:boolean;allIn:boolean})=>
  p.seatId===s.actorId?p:{...p,inHand:p.seatId===s.lastRaiserSeat,folded:p.seatId!==s.lastRaiserSeat,stack:p.seatId===s.lastRaiserSeat?100:0});
 s.context.stack=stackContext(s.context.seats,s.actorId);
 const o=shortStackOptions(s)!;assert.ok(o.spr<.1,JSON.stringify(o));
});
test('shared single/server policy routes a priced AJo call without any opponent private cards',(t)=>{
 t.mock.method(Math,'random',()=>0);
 const s=spot(152),actor=s.context.seats.find((p:{seatId:number})=>p.seatId===s.actorId);
 for(const other of s.context.seats)if(other.seatId!==s.actorId)Object.defineProperty(other,'holeCards',{enumerable:true,get(){throw Error('private cards read');}});
 const base=RPG_BOT_POOL.find(p=>p.id==='goblin_thief')!;
 let audit:Record<string,unknown>={};
 const d=decideLiveBot(new SelfPlayTrainer(),{actor:{...actor,holeCards:s.hole,persona:base},seats:s.context.seats,board:[],pot:s.pot-s.context.seats.reduce((n:number,p:{currentBet:number})=>n+p.currentBet,0),
  minRaise:s.minRaise,maxRaise:s.maxRaise,button:s.button,smallBlind:s.smallBlind,bigBlind:s.bigBlind,hand:s.hand,raiseLevel:2,
  openedPreflop:true,lastRaiserSeat:s.lastRaiserSeat,threeBetRead:s.threeBetRead,onAudit:a=>{audit=a;}});
 assert.equal(d.action,'call');assert.equal(d.amount,400);assert.equal(audit.decisionPath,'priced-three-bet-flat');
});
