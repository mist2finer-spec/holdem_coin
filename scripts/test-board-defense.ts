import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boardDefenseDecision,drawBoard,drawCallFrequency} from '../src/lib/poker-board-defense';
import {RPG_BOT_POOL} from '../src/lib/personas';
import {decideLiveBot,normalizeLiveAction} from '../src/lib/poker-live';
import {hasBettingOpponent} from '../src/lib/poker-rules';
import type {Card} from '../src/lib/poker-engine';
import type {SelfPlayTrainer} from '../src/lib/self-play-trainer';
const cards=(s:string[])=>s.map(c=>({rank:c[0],suit:c.slice(1)} as Card));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/cheap-river-at.json',import.meta.url),'utf8'));
const base=RPG_BOT_POOL.find(p=>p.id==='dragon_slayer')!;
const spot=()=>({...fixture,hole:cards(fixture.hole),board:cards(fixture.board),seats:structuredClone(fixture.seats),base,persona:base});

test('historical AT river: 250 into 13,750 is no longer lost to a random catch gate',()=>{
 const c=spot(),g=boardDefenseDecision(c,()=>.999)!;
 assert.equal(g.kind,'cheap-river');assert.equal(g.cost,250);assert.equal(g.pot,14000);
 assert.equal(g.frequency,1);assert.ok(g.eligible&&g.accepted&&g.callEV>0);
 const actor=c.seats.find((p:any)=>p.seatId===c.actorId);
 const trainer={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 let audit:Record<string,unknown>={};
 for(const other of c.seats)if(other.seatId!==actor.seatId)
  Object.defineProperty(other,'holeCards',{get(){throw Error('Opponent cards read');},enumerable:true});
 const decision=decideLiveBot(trainer,{actor:{...actor,holeCards:c.hole,persona:base},seats:c.seats,board:c.board,pot:13500,
  minRaise:500,maxRaise:250,button:0,smallBlind:1,bigBlind:2,hand:8,raiseLevel:1,onAudit:a=>{audit=a;}});
 assert.deepEqual(decision,{action:'call',amount:250});assert.equal(audit.decisionPath,'priced-river-call');
 assert.ok(normalizeLiveAction(c.seats,c.actorId,decision,200,false));
});
test('public textures include wheel, flop flush draws, completed flush and straight threats',()=>{
 for(const b of ['2♠ 3♥ 4♦','A♣ 2♦ 4♥','K♠ 8♠ 2♦','Q♠ 7♠ J♣ 2♠','8♠ 9♦ T♣ J♠ 2♦'])assert.equal(drawBoard(cards(b.split(' '))),true,b);
 assert.equal(drawBoard(cards(['A♠','K♥','8♦'])),false);
 assert.equal(drawBoard(cards(['A♠','K♥','8♦','8♣','2♣'])),false);
 assert.equal(drawBoard([]),false);
});
test('draw catch is one 40–60% monotonic personality mixture',()=>{
 assert.equal(drawCallFrequency({aggression:.2}),.4);
 assert.ok(Math.abs(drawCallFrequency({aggression:.82})-.6)<1e-12);
 let previous=0;
 for(let a=.2;a<1;a+=.05){const f=drawCallFrequency({aggression:a});assert.ok(f>=.4&&f<=.60000000001&&f>=previous);previous=f;}
 const c=spot();c.seats.find((p:any)=>p.seatId===c.actorId).stack=10000;
 c.seats[0].currentBet=2000;c.seats[0].totalBet=7650;
 for(const aggression of [.2,.51,.82]){
  const ctx={...c,base:{...base,aggression},persona:{...base,aggression}};
  const guard=boardDefenseDecision(ctx,()=>0)!;assert.equal(guard.kind,'draw-board');assert.ok(guard.eligible);
  let calls=0;for(let i=0;i<1000;i++)calls+=Number(boardDefenseDecision(ctx,()=>(i+.5)/1000)!.accepted);
  assert.ok(Math.abs(calls/1000-guard.frequency)<.001);
 }
});
test('no automatic river call with a missed draw, board-only hand or negative EV',()=>{
 const c=spot();c.hole=cards(['7♥','6♦']);assert.equal(boardDefenseDecision(c,()=>0),null);
 c.hole=cards(['4♥','4♦']);c.board=cards(['A♠','K♠','Q♠','J♠','T♠']);assert.equal(boardDefenseDecision(c,()=>0),null);
 c.board=cards(['A♠','K♠','Q♠','J♠','2♦']);const actor=c.seats.find((p:any)=>p.seatId===c.actorId);actor.totalBet=0;actor.stack=10000;
 c.seats[0].currentBet=10000;c.seats[0].totalBet=10000;
 const bad=boardDefenseDecision(c,()=>0)!;assert.equal(bad.accepted,false);assert.ok(bad.callEV<0);
});
test('side pots, unmatched excess and capped calls cannot invent cheap eligible money',()=>{
 const c=spot();c.seats=[
  {seatId:0,stack:0,currentBet:10000,totalBet:10000,inHand:true,folded:false,allIn:true},
  {seatId:1,stack:0,currentBet:10000,totalBet:10000,inHand:true,folded:false,allIn:true},
  {seatId:2,stack:10,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false}];
 const g=boardDefenseDecision(c,()=>0)!;assert.equal(g.cost,10);assert.equal(g.pot,30);assert.ok(g.price>0.3);
});
test('a responder needs capacity above the price for a legal raise, not just remaining chips',()=>{
 const seats=[{seatId:0,stack:5300,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false},
  {seatId:1,stack:5000,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false},
  {seatId:2,stack:0,currentBet:5000,totalBet:5000,inHand:true,folded:false,allIn:true}];
 assert.equal(hasBettingOpponent(seats,0),false);
 assert.deepEqual(normalizeLiveAction(seats,0,{action:'allin'},4800),{action:'call',amount:5000});
 seats[1].stack=5001;assert.equal(hasBettingOpponent(seats,0),true);
});

test('small heads-up flush-draw calls bypass mixing, while raises retain the single mix',()=>{
 const c=spot();c.board=cards(['Q♠','7♠','2♦']);c.hole=cards(['A♠','K♠']);
 c.seats=c.seats.slice(0,2).map((s:any,i:number)=>({...s,seatId:i,stack:4800,currentBet:i?100:0,totalBet:i?300:200,inHand:true,folded:false,allIn:false}));c.actorId=0;
 const g=boardDefenseDecision(c,()=>0)!;assert.equal(g.kind,'small-bet-defense');assert.ok(g.eligible&&g.accepted);
 assert.equal(boardDefenseDecision(c,()=>.999)!.accepted,true,'a well-priced heads-up draw no longer loses a random roll');
 c.raiseLevel=2;const raised=boardDefenseDecision(c,()=>.999)!;assert.equal(raised.forced,false);assert.equal(raised.rangeModel,'board-value');
 c.hole=cards(['J♥','T♣']);assert.equal(boardDefenseDecision(c,()=>0),null,'mere backdoors must not unlock a call');
});
test('declined draw mix cannot veto a deterministic positive-EV call',(t)=>{
 t.mock.method(Math,'random',()=>.999);
 const c=spot();const own=c.seats.find((s:any)=>s.seatId===c.actorId);own.stack=10000;
 c.seats[0].currentBet=2000;c.seats[0].totalBet=7650;
 const pro={...base,id:'pro',role:'pro' as const,aggression:.82,catchEquity:.45};
 let audit:Record<string,unknown>={};
 const args={actor:{...own,holeCards:c.hole,persona:pro},seats:c.seats,board:c.board,pot:13500,minRaise:4000,maxRaise:10000,button:0,smallBlind:1,bigBlind:2,hand:8,raiseLevel:1,onAudit:(a:Record<string,unknown>)=>{audit=a;}};
 const fake={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
 assert.equal(decideLiveBot(fake,args).action,'call');
 assert.ok(audit.boardDefense);assert.ok(audit.riverCatch||audit.proCatch||audit.pricedCall);
 const raise={decideActionForLive:()=>({action:2,amount:4000})} as unknown as SelfPlayTrainer;
 assert.equal(decideLiveBot(raise,args).action,'raise');
});

test('a short big blind still uses the full bring-in for responder capacity',()=>{
 const seats=[{seatId:0,stack:5000,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false},
 {seatId:1,stack:50,currentBet:100,totalBet:100,inHand:true,folded:false,allIn:false},
 {seatId:2,stack:0,currentBet:50,totalBet:50,inHand:true,folded:false,allIn:true}];
 assert.equal(hasBettingOpponent(seats,0,200),false);
 assert.deepEqual(normalizeLiveAction(seats,0,{action:'allin'},200,true,200),{action:'call',amount:200});
});

const history=JSON.parse(fs.readFileSync(new URL('./fixtures/small-bet-defense-spots.json',import.meta.url),'utf8'));
for(const hand of [84,192])test(`history #${hand}: a profitable pair/draw facing a quarter-pot c-bet cannot randomly fold`,()=>{
 const f=history.find((f:any)=>f.hand===hand),c={...f,hole:cards(f.hole),board:cards(f.board),base,persona:base};
 const g=boardDefenseDecision(c,()=>.999)!;assert.equal(g.kind,'small-bet-defense');assert.equal(g.forced,true);assert.equal(g.accepted,true);assert.ok(g.callEV>g.margin);
 for(const s of c.seats)Object.defineProperty(s,'holeCards',{enumerable:true,get(){throw Error('Private cards read');}});
 assert.equal(boardDefenseDecision(c,()=>.999)!.accepted,true);
});
test('history #271: a flop check-raise uses board-conditioned value rather than a preflop opening range',()=>{
 const f=history.find((f:any)=>f.hand===271),c={...f,hole:cards(f.hole),board:cards(f.board),base,persona:base};
 const g=boardDefenseDecision(c,()=>.999)!;assert.equal(g.rangeModel,'board-value');assert.equal(g.forced,false);assert.equal(g.accepted,false);
});
