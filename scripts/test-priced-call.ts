import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Card} from '../src/lib/poker-engine';
import {pricedCallGuard,pricedCallEquity} from '../src/lib/poker-priced-call';
import {decideLiveBot,normalizeLiveAction} from '../src/lib/poker-live';
import {RPG_BOT_POOL} from '../src/lib/personas';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/priced-call-spots.json',import.meta.url),'utf8')) as (Omit<Parameters<typeof pricedCallGuard>[0],'hole'|'board'>&{hand:number;hole:string[];board:string[];minRaise:number;maxRaise:number;button:number;smallBlind:number})[];
const cards=(xs:string[])=>xs.map(c=>({rank:c[0],suit:c.slice(1)})) as Card[];
const spot=(hand:number)=>{const s=fixtures.find(f=>f.hand===hand)!;return {...s,hole:cards(s.hole),board:cards(s.board),seats:s.seats.map(p=>({...p}))};};
for(const hand of [355,379,426,438,474,523,539,1047,709,1114])test(`history #${hand}: a profitable priced call is not randomly discarded`,()=>{
 const s=spot(hand),before=JSON.stringify(s),guard=pricedCallGuard(s);
 assert.ok(guard?.accepted,JSON.stringify(guard));
 assert.equal(JSON.stringify(s),before,'valuation must not mutate seats or contributions');
 assert.ok(guard.callEV!>guard.margin!);
});

test('the shared live path can recover a masked overcards fold against an under-raise all-in',()=>{
 const s=spot(523),actor=s.seats.find(p=>p.seatId===s.actorId)!;
 for(const other of s.seats)if(other.seatId!==actor.seatId)
  Object.defineProperty(other,'holeCards',{enumerable:true,get(){throw new Error('Opponent private cards read');}});
 const fake={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 let audit:Record<string,unknown>|undefined;
 const decision=decideLiveBot(fake,{actor:{...actor,holeCards:s.hole,persona:RPG_BOT_POOL.find(p=>p.id==='barbarian_chief')!},
  seats:s.seats,board:s.board,pot:2000,minRaise:s.minRaise,maxRaise:s.maxRaise,button:s.button,smallBlind:s.smallBlind,bigBlind:s.bigBlindSeat,
  hand:s.hand,raiseLevel:s.raiseLevel,onAudit:v=>{audit=v;}});
 assert.deepEqual(decision,{action:'call',amount:159});assert.equal(audit?.decisionPath,'priced-allin-call');
 assert.ok(normalizeLiveAction(s.seats,s.actorId,decision,2200,false));
});

test('a remaining opponent able to bet prevents a locked-runout override',()=>{
 const s=spot(523);s.seats.push({seatId:6,stack:10000,currentBet:4559,totalBet:5359,inHand:true,folded:false,allIn:false});
 assert.equal(pricedCallGuard(s),null);
});

test('history #474 caps the call at 550, and no remaining actor can force additional chips',()=>{
 const s=spot(474),g=pricedCallGuard(s);
 assert.ok(g?.accepted);assert.equal(g.cost,550);
 const opponent=s.seats.find(p=>p.seatId!==s.actorId&&p.inHand&&!p.folded)!;
 opponent.allIn=false;opponent.stack=5000;
 const withSideAction=pricedCallGuard(s);assert.ok(withSideAction?.accepted);
 assert.equal(withSideAction.cost,550);
 assert.equal(withSideAction.netPot,g.netPot,'future side-pot bets must not inflate eligible money');
});

test('ineligible side pots and uncalled refunds cannot subsidize a short stack call',()=>{
 const seats=[
  {seatId:0,stack:10,currentBet:10,totalBet:10,inHand:true,folded:false,allIn:false},
  {seatId:1,stack:0,currentBet:2000,totalBet:2000,inHand:true,folded:false,allIn:true},
  {seatId:2,stack:0,currentBet:2000,totalBet:2000,inHand:true,folded:false,allIn:true},
 ];
 const g=pricedCallGuard({hole:cards(['A♠','A♥']),board:cards(['2♦','4♣','8♥']),seats,actorId:0,bigBlindSeat:0,raiseLevel:2,bigBlind:200});
 assert.ok(g);assert.equal(g.reason,'price');assert.equal(g.accepted,false);assert.ok(g.netPot<100);
});

test('a losing river ace-high cannot auto-call just because the price is cheap',()=>{
 const s=spot(523);s.hole=cards(['A♣','2♣']);s.board=cards(['K♥','Q♦','9♠','7♥','4♣']);
 const g=pricedCallGuard(s);assert.ok(g);assert.equal(g.accepted,false,JSON.stringify(g));
 assert.equal(g.equity,0,'ace-high cannot beat the public value prior on this board');
});

test('a cheap call that consumes the actor stack becomes an all-in CALL, not a new raise',()=>{
 const s=spot(438),actor=s.seats.find(p=>p.seatId===s.actorId)!;actor.stack=100;
 const g=pricedCallGuard(s);assert.ok(g?.accepted);assert.equal(g.cost,100);
 const fake={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 const d=decideLiveBot(fake,{actor:{...actor,holeCards:s.hole,persona:RPG_BOT_POOL.find(p=>p.id==='barbarian_chief')!},
  seats:s.seats,board:[],pot:0,minRaise:s.minRaise,maxRaise:actor.currentBet+actor.stack,button:s.button,smallBlind:s.smallBlind,
  bigBlind:s.bigBlindSeat,hand:s.hand,raiseLevel:s.raiseLevel});
 assert.deepEqual(d,{action:'allin',amount:100});assert.ok(normalizeLiveAction(s.seats,s.actorId,d,400,false));
});

test('pocket-pair defense does not extend to tiny stacks or arbitrary high prices',()=>{
 const s=spot(1114),actor=s.seats.find(p=>p.seatId===s.actorId)!;actor.stack=600;
 assert.equal(pricedCallGuard(s),null);
 const expensive=spot(1114);for(const p of expensive.seats)if(p.seatId!==expensive.actorId&&p.inHand)p.currentBet=800;
 assert.equal(pricedCallGuard(expensive),null);
});

test('public equity is deterministic and shared-board ties are valued as shares',()=>{
 const hole=cards(['2♣','3♦']),board=cards(['T♥','J♥','Q♥','K♥','A♥']);
 assert.equal(pricedCallEquity(hole,board,1),.5);
 assert.ok(Math.abs(pricedCallEquity(hole,board,2)-1/3)<1e-12);
});

test('forced blind chips do not unlock a rare low-connector cold call',()=>{
 const seats=[{seatId:0,stack:4800,currentBet:200,totalBet:200,inHand:true,folded:false,allIn:false},
  {seatId:1,stack:0,currentBet:230,totalBet:230,inHand:true,folded:false,allIn:true}];
 assert.equal(pricedCallGuard({hole:cards(['2♠','3♥']),board:[],seats,actorId:0,bigBlindSeat:0,raiseLevel:1,bigBlind:200}),null);
});
