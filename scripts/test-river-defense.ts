import {test} from 'node:test';
import assert from 'node:assert/strict';
import {riverCatchDecision,riverCatchFrequency} from '../src/lib/poker-river-defense';
import {RPG_BOT_POOL} from '../src/lib/personas';
import {decideLiveBot} from '../src/lib/poker-live';
import type {Card} from '../src/lib/poker-engine';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer';
const cards=(s:string)=>s.split(' ').map(c=>({rank:c[0],suit:c[1]} as Card));
const base=RPG_BOT_POOL.find(p=>p.id==='paladin_captain')||RPG_BOT_POOL.reduce((a,b)=>a.vpip<b.vpip?a:b);
const actor={seatId:0,stack:1000,currentBet:0,totalBet:500,inHand:true,folded:false,allIn:false,holeCards:cards('A♠ A♥'),persona:base};
const rival={seatId:1,stack:1000,currentBet:100,totalBet:600,inHand:true,folded:false,allIn:false};
const ctx={hole:actor.holeCards,board:cards('A♦ K♥ 8♣ 8♠ 2♦'),seats:[actor,rival],actorId:0,base,persona:base};
test('tight identities get higher 5–40 percent catch frequency',()=>{
 assert.ok(Math.abs(riverCatchFrequency({vpip:.18,aggression:.20})-.4)<1e-12);
 assert.equal(riverCatchFrequency({vpip:.65,aggression:.82}),.05);
 for(const p of RPG_BOT_POOL)assert.ok(riverCatchFrequency(p)>=.05&&riverCatchFrequency(p)<=.4);
});
test('clear positive EV bypasses the frequency gate; no opponent card dependency',()=>{
 const a=riverCatchDecision(ctx,()=>0)!;assert.ok(a.accepted&&a.callEV>0);
 assert.equal(riverCatchDecision(ctx,()=>.99)!.accepted,true);
 const hidden={...rival,holeCards:cards('Q♠ J♠')};
 assert.deepEqual(riverCatchDecision({...ctx,seats:[actor,hidden]},()=>0),a);
 assert.equal(riverCatchDecision({...ctx,board:ctx.board.slice(0,4)},()=>0),null);
 assert.equal(riverCatchDecision({...ctx,seats:[actor,rival,{...rival,seatId:2}]},()=>0),null);
});
test('weak bluff catcher cannot call a negative EV shove; excess bets do not inflate winnings',()=>{
 const own={...actor,holeCards:cards('3♣ 4♣'),stack:100};
 const other={...rival,currentBet:10000,totalBet:10500};
 const a=riverCatchDecision({...ctx,hole:own.holeCards,seats:[own,other]},()=>0)!;
 const b=riverCatchDecision({...ctx,hole:own.holeCards,seats:[own,{...other,currentBet:100,totalBet:600}]},()=>0)!;
 assert.deepEqual(a,b);
 const bad=riverCatchDecision({...ctx,hole:cards('7♣ 2♣'),seats:[{...actor,stack:10000,totalBet:0},{...other,totalBet:10000}]},()=>0)!;
 assert.ok(bad.callEV<0);assert.equal(bad.accepted,false);
});
test('shared live policy logs river estimates, preserves raises and never accesses private referee',(t)=>{
 t.mock.method(Math,'random',()=>0);
 const args={actor,seats:[actor,rival],board:ctx.board,pot:1000,minRaise:200,maxRaise:1000,button:1,smallBlind:0,bigBlind:1,hand:1,raiseLevel:1,
 allowHumanCall:()=>{throw Error('private referee accessed');}};
 let audit:Record<string,unknown>={};
 const fold={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 const result=decideLiveBot(fold,{...args,onAudit:a=>{audit=a;}});assert.ok(audit.riverCatch);
 assert.equal(result.action,'call');assert.equal(result.amount,100);assert.equal(audit.decisionPath,'river-bluff-catch');
 const raise={decideActionForLive:()=>({action:2,amount:200})} as unknown as SelfPlayTrainer;
 assert.equal(decideLiveBot(raise,args).action,'raise');
});
