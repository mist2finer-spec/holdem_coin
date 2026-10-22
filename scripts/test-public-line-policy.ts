import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicLineTracker,publicRangeProfile,checkedThrough,type PublicAction} from '../src/lib/poker-public-line';
import {lineCandidates,selectLineDecision,type LineSpot} from '../src/lib/poker-line-policy';
import {publicLineEquity,calledActionEV,estimateEquity} from '../src/lib/poker-ai';
import {normalizeLiveAction,decideLiveBot,applyLiveAction} from '../src/lib/poker-live';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer';
import {RPG_BOT_POOL} from '../src/lib/personas';
import {stackContext} from '../src/lib/poker-stack';
import type {Card} from '../src/lib/poker-engine';
import {HybridHoldemRoom} from '../mini-services/poker-server/index';
const cards=(s:string):Card[]=>s.split(' ').map(c=>({rank:c[0],suit:c.slice(1)} as Card));
const persona={...RPG_BOT_POOL[0],vpip:.45,aggression:.8,bluffFreq:.3};
const check={action:'check' as const,amount:0};
const fold={action:'fold' as const,amount:0};
const row=(seatId:number,street:number,action:PublicAction['action'],extra:Partial<PublicAction>={}):PublicAction=>
  ({seatId,street,action,call:0,paid:0,to:0,pot:3000,raises:false,...extra});
function spot(hole='A♠ A♥',board='A♦ 7♣ 2♥ 9♠ J♦'):LineSpot {
 const seats=[0,1].map(seatId=>({seatId,stack:10000,totalBet:1500,currentBet:0,inHand:true,folded:false,allIn:false}));
 return {hole:cards(hole),board:cards(board),persona,call:0,pot:3000,stack:10000,currentBet:0,minRaise:200,
  maxRaise:10000,raiseLevel:0,canRaise:true,context:{actorId:0,seats,stack:stackContext(seats,0),
    position:{isOOP:false,relativePosition:1,opponents:1,checkedThisStreet:false,preflopEquityPremium:0},
    publicLine:{inducing:false,actions:[row(0,3,'check'),row(1,3,'check'),row(0,4,'check'),row(1,4,'check')]}}};
}
test('tracker whitelists public scalars, snapshots are isolated, and all hand/plans are reset',()=>{
 const tracker=new PublicLineTracker();
 const untrusted={...row(1,3,'check'),get holeCards(){throw new Error('private cards accessed');}};
 tracker.observe(1,untrusted);tracker.armInduce(1,3,0);
 assert.equal(tracker.read(1,3,0).inducing,false);
 tracker.observe(1,row(0,3,'check'));
 assert.equal(tracker.read(1,3,0).inducing,true);
 const snapshot=tracker.read(1,3,0);snapshot.actions[0].seatId=9;
 assert.equal(tracker.read(1,3,0).actions[0].seatId,1);
 assert.equal('holeCards' in snapshot.actions[0],false);
 tracker.observe(1,row(0,3,'call'));assert.equal(tracker.read(1,3,0).inducing,false);
 assert.deepEqual(tracker.read(2,3,0),{actions:[],inducing:false});
 for(let i=0;i<1100;i++)tracker.observe(2,row(i%8,3,'check'));
 assert.equal(tracker.read(2,3,0).actions.length,1024);
});
test('checks soften strong-range likelihood without eliminating traps or equating check with air',()=>{
 const empty={actions:[],inducing:false};assert.equal(checkedThrough(empty,4),false);
 const line={actions:[row(1,4,'check'),row(0,4,'check')],inducing:false};
 assert.equal(checkedThrough(line,4),true);
 const p=publicRangeProfile(line,1,5);assert.ok(p.strong>0&&p.strong<p.air);
 assert.equal(checkedThrough({...line,actions:[...line.actions,row(1,4,'raise',{raises:true})]},4),false);
 const s=spot();const q=publicLineEquity(s.hole,s.board,s.context,192);
 assert.ok(Number.isFinite(q)&&q>=0&&q<=1);
 const other=structuredClone(s);other.context.publicLine!.actions=[row(1,5,'raise',{raises:true,paid:3000})];
 assert.notDeepEqual(publicRangeProfile(line,1,5),publicRangeProfile(other.context.publicLine!,1,5));
});
test('river thin-value uses exactly one BB and legal sizing while preserving ordinary decisions most often',()=>{
 const s=spot();const list=lineCandidates(s,check);const thin=list.find(c=>c.path==='line-river-thin-value')!;
 assert.ok(thin,JSON.stringify(list));assert.equal(thin.action.amount,200);assert.ok(thin.ev>0);
 let chosen=0;for(let i=0;i<1000;i++)chosen+=Number(!!selectLineDecision(s,check,()=>(i+.5)/1000));
 assert.ok(chosen>0&&chosen<=350);
 for(const c of list)assert.ok(normalizeLiveAction(s.context.seats,0,c.action,200));
 assert.equal(selectLineDecision(s,check,()=>.99),null);
});
test('induce plan survives a real check, cannot be overwritten by generic value support, and respects incoming price',(t)=>{
 const tracker=new PublicLineTracker();tracker.observe(1,row(1,3,'check'));
 const s=spot('A♠ A♥','A♦ 7♣ 2♥');
 const trainer=new SelfPlayTrainer();t.mock.method(trainer,'decideActionForLive',()=>({action:2,amount:1000}));
 t.mock.method(Math,'random',()=>0);
 let audit:Record<string,unknown>={};
 const decision=decideLiveBot(trainer,{actor:{...s.context.seats[0],holeCards:s.hole,persona},
  seats:s.context.seats,board:s.board,pot:s.pot,minRaise:200,maxRaise:10000,button:0,smallBlind:0,bigBlind:1,
  hand:1,raiseLevel:0,publicLines:tracker,onAudit:a=>{audit=a;}});
 assert.equal(audit.decisionPath,'line-induce-check');assert.deepEqual(decision,check);
 assert.equal(tracker.read(1,3,0).inducing,false);
 tracker.observe(1,row(0,3,'check'));assert.equal(tracker.read(1,3,0).inducing,true);
 s.context.publicLine=tracker.read(1,3,0);s.call=600;s.pot=3600;s.minRaise=1200;
 Object.assign(s.context.seats[1],{currentBet:600,totalBet:2100,stack:9400});
 const called=selectLineDecision(s,fold,()=>.99)!;
 assert.equal(called.path,'line-induce-call');assert.equal(called.action.amount,600);
 s.call=4000;assert.equal(lineCandidates(s,fold).some(c=>c.path==='line-induce-call'),false);
});
test('check-raise mixes require real own draw/value, reopened rights and a bounded legal investment',()=>{
 const s=spot('A♥ Q♥','K♥ 7♥ 2♣');s.call=300;s.pot=3300;s.minRaise=600;
 s.context.position!.isOOP=true;s.context.position!.checkedThisStreet=true;
 Object.assign(s.context.seats[1],{currentBet:300,totalBet:1800,stack:9700});
 const cr=lineCandidates(s,fold).find(c=>c.path==='line-check-raise');
 assert.ok(cr);assert.ok(cr.ev>0);assert.ok(normalizeLiveAction(s.context.seats,0,cr.action,300));
 assert.equal(lineCandidates({...s,canRaise:false},fold).length,0);
 assert.equal(lineCandidates({...s,hole:cards('8♠ 3♦')},fold).length,0);
 assert.equal(lineCandidates({...s,stack:500,maxRaise:500},fold).length,0);
});
test('delayed probe and river probe require completed checked-through prior streets and own draw/blocker evidence',()=>{
 const turn=spot('A♥ Q♥','K♥ 7♥ 2♣ 9♠');
 const candidates=lineCandidates(turn,check);assert.ok(candidates.some(c=>c.path==='line-delayed-barrel'),JSON.stringify(candidates));
 const river=spot('Q♥ T♥','K♥ 7♥ 2♣ 9♠ 3♦');
 const probes=lineCandidates(river,check);assert.ok(probes.some(c=>c.path==='line-river-probe'),JSON.stringify(probes));
 turn.context.publicLine!.actions=[row(0,3,'raise',{raises:true}),row(1,3,'call')];
 assert.equal(lineCandidates(turn,check).some(c=>c.path==='line-delayed-barrel'),false);
});
test('all-in opponents, multiple opponents, shared-board nuts and illegal literal sizes retain baseline policy',()=>{
 const board=spot('2♣ 3♦','A♠ K♠ Q♠ J♠ T♠');assert.deepEqual(lineCandidates(board,check),[]);
 const allin=spot();allin.context.seats[1].allIn=true;assert.deepEqual(lineCandidates(allin,fold),[]);
 const multi=spot();multi.context.seats.push({...multi.context.seats[1],seatId:2});assert.deepEqual(lineCandidates(multi,check),[]);
 const illegal=spot();illegal.minRaise=500;assert.equal(lineCandidates(illegal,check).some(c=>c.path==='line-river-thin-value'),false);
});
test('deep squeeze needs an actual opener plus a flat caller; cannot bypass short-stack or reopening rules',()=>{
 const s=spot('A♠ A♥');s.board=[];s.raiseLevel=1;s.call=400;s.pot=900;s.minRaise=600;
 s.context.seats=[{seatId:0,stack:20000,totalBet:0,currentBet:0,inHand:true,folded:false,allIn:false},
  ...[1,2].map(seatId=>({seatId,stack:19600,totalBet:400,currentBet:400,inHand:true,folded:false,allIn:false}))];
 s.context.stack=stackContext(s.context.seats,0);s.stack=20000;s.maxRaise=20000;
 s.context.publicLine!.actions=[row(1,0,'raise',{to:400,raises:true}),row(2,0,'call',{to:400,call:400})];
 const squeeze=lineCandidates(s,{action:'call',amount:400}).find(c=>c.path==='line-squeeze');
 assert.ok(squeeze);assert.ok(squeeze.ev>0);assert.ok(squeeze.action.amount>=1400&&squeeze.action.amount<20000);
 assert.ok(normalizeLiveAction(s.context.seats,0,squeeze.action,200,true,200));
 s.context.stack= {...s.context.stack,effectiveStack:5000};assert.equal(lineCandidates(s,check).length,0);
 s.context.stack=stackContext(s.context.seats,0);assert.equal(lineCandidates({...s,canRaise:false},check).length,0);
 s.context.preflopPosition={early:true,inPositionVsRaiser:false};s.hole=cards('A♠ Q♠');
 assert.equal(lineCandidates(s,{action:'call',amount:400}).length,0);
 s.context.preflopPosition.early=false;assert.equal(lineCandidates(s,fold).length,0);
 s.context.publicLine!.actions=[row(1,0,'raise',{to:400,raises:true})];assert.equal(lineCandidates(s,check).length,0);
});
test('line-weighted equity can win only the contribution layers the short caller funds',()=>{
 const s=spot('A♠ Q♠');
 s.context.seats=[{seatId:0,stack:100,totalBet:400,currentBet:0,inHand:true,folded:false,allIn:false},
  ...[1,2].map(seatId=>({seatId,stack:0,totalBet:1500,currentBet:0,inHand:true,folded:false,allIn:true}))];
 const profiles=[1,2].map(id=>publicRangeProfile(s.context.publicLine!,id,5));
 const q=estimateEquity(s.hole,s.board,2,192,undefined,undefined,profiles);
 assert.equal(calledActionEV(s.hole,s.board,s.context,100,0,undefined,192),1500*q-100);
});
test('six/eight-seat server loops record normalized actions exactly once and reset per hand',async()=>{
 for(const count of [6,8] as const){
  const room=new HybridHoldemRoom(false,count);
  // Production sleeps only; retain the actual shared decision/rules/history loop.
  const runtime=room as unknown as {state:HybridHoldemRoom['state'];publicLines:PublicLineTracker;sleep:()=>Promise<void>;playOneHand:()=>Promise<void>;history:HybridHoldemRoom['history']};
  runtime.sleep=async()=>{await new Promise<void>(r=>setImmediate(r));};
  for(let i=0;i<2;i++){
   await runtime.playOneHand();const hand=runtime.history.all().at(-1)!;
   assert.equal(hand.status,'completed');
   const line=runtime.publicLines.read(runtime.state.handNumber,5,0);
   assert.equal(line.actions.length,hand.actions.length);
   for(let j=0;j<line.actions.length;j++){
    const a=line.actions[j],b=hand.actions[j];assert.equal(a.seatId,b.seatId);assert.equal(a.paid,b.paid);
    assert.equal(a.pot,b.potBefore);assert.equal(a.to,b.betAfter);
    assert.equal('privateAudit' in a,false);
   }
   assert.ok(runtime.state.seats.every(s=>s.stack>=0));
  }
 }
});
test('public range EV retains contribution-layer eligibility and never reads opponent hole-card getters',()=>{
 const s=spot();for(const opponent of s.context.seats.slice(1))Object.defineProperty(opponent,'holeCards',{get(){throw Error('private cards read');}});
 assert.ok(Number.isFinite(publicLineEquity(s.hole,s.board,s.context)));
 assert.ok(Number.isFinite(calledActionEV(s.hole,s.board,s.context,200)));
 for(const c of lineCandidates(s,check)){
  const legal=normalizeLiveAction(s.context.seats,0,c.action,200)!;
  const actor={...s.context.seats[0],hasActed:false};const after=applyLiveAction(actor,legal);
  assert.ok(after.stack>=0);assert.equal(after.stack+after.totalBet,actor.stack+actor.totalBet);
 }
});
