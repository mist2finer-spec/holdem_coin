import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settleHand, bettingLocked, hasBettingOpponent, dealNextStreet, contributionLayers} from '../src/lib/poker-rules.ts';
import {estimateEquity, afterRakeOdds, calledActionEV, uncontestedActionEV} from '../src/lib/poker-ai.ts';
import {makeDeck, Card} from '../src/lib/poker-engine.ts';
import {HybridHoldemRoom} from '../mini-services/poker-server/index.ts';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer.ts';

const board:Card[]=[{rank:'2',suit:'♣'},{rank:'3',suit:'♦'},{rank:'4',suit:'♣'},{rank:'8',suit:'♥'},{rank:'9',suit:'♦'}];
function seats(bets:number[]) {
 const ranks=['A','K','Q','J'] as const;
 return bets.map((totalBet,seatId)=>({seatId,name:'P'+seatId,totalBet,currentBet:totalBet,stack:20000-totalBet,
  inHand:true,folded:false,allIn:totalBet===20000,
  holeCards:[{rank:ranks[seatId%4],suit:'♠'},{rank:ranks[seatId%4],suit:'♥'}] as Card[]}));
}
test('5% rake and net profit: equal 20k all-ins pay 38k and display +18k',()=>{
 const result=settleHand(seats([20000,20000]),board,0);
 assert.equal(result.totalRake,2000);assert.equal(result.results[0].payout,38000);assert.equal(result.results[0].netProfit,18000);
});
test('uncalled excess returns in full and never belongs to the main-pot winner',()=>{
 const result=settleHand(seats([5000,20000]),board,0);
 assert.equal(result.totalRake,500);assert.equal(result.results[0].award,9500);
 assert.equal(result.results[1].refund,15000);assert.equal(result.results[1].award,0);
 assert.equal(result.results[1].netProfit,-5000);
});
test('main and side pot are independently raked; short stack cannot win side pot',()=>{
 const result=settleHand(seats([5000,10000,10000]),board,0);
 assert.equal(result.totalRake,1250);assert.equal(result.results[0].payout,14250);assert.equal(result.results[1].payout,9500);
});
test('folded overcontribution is layered, not added entirely to main pot',()=>{
 const s=seats([5000,20000,20000,20000]);s[3].folded=true;s[3].inHand=false;
 const r=settleHand(s,board,0);assert.deepEqual(r.pots.map(p=>p.rake),[1000,2250]);assert.equal(r.results[0].award,19000);
});
test('subthreshold split pots have no rake; odd chips clockwise from button',()=>{
 const s=seats([101,101]);const royal:Card[]='TJQKA'.split('').map(rank=>({rank:rank as Card['rank'],suit:'♣'}));
 const r=settleHand(s,royal,0);assert.equal(r.totalRake,0);assert.equal(r.results[0].netProfit,0);assert.equal(r.results[1].netProfit,0);
 const odd=settleHand(seats([101,100]),royal,0);assert.equal(odd.results[0].refund,1);
 assert.equal(odd.results.reduce((a,p)=>a+p.payout,0),201);
});
test('triggered preflop fold pot taxes matched chips without mutating input',()=>{
 const s=seats([1000,200]);s[1].folded=true;s[1].inHand=false;const before=JSON.stringify(s);
 const a=settleHand(s,[],0),b=settleHand(s,[],0);assert.equal(a.totalRake,20);assert.deepEqual(a,b);assert.equal(JSON.stringify(s),before);
});
test('matched covering player locks action, unmatched player must still call/fold',()=>{
 const s=seats([5000,5000]);s[0].allIn=true;s[0].stack=0;
 assert.equal(bettingLocked(s),true);assert.equal(hasBettingOpponent(s,1),false);
 s[1].currentBet=200;assert.equal(bettingLocked(s),false);
});
test('two players with remaining chips can continue a side pot',()=>{
 const s=seats([5000,5000,5000]);s[0].allIn=true;s[0].stack=0;
 assert.equal(bettingLocked(s),false);assert.equal(hasBettingOpponent(s,1),true);
 s[1].allIn=true;s[1].stack=0;assert.equal(bettingLocked(s),true);
});
test('runout deals flop/turn/river as 3/1/1 with one burn each',()=>{
 const deck=makeDeck();let current:Card[]=[];const lengths=[];const phases=[];
 while(current.length<5){const next=dealNextStreet(current,deck);current=next.board;lengths.push(current.length);phases.push(next.phase);}
 assert.deepEqual(lengths,[3,4,5]);assert.deepEqual(phases,['FLOP','TURN','RIVER']);assert.equal(deck.length,44);
});
test('real server runout performs no covering-player betting and settles once',async()=>{
 const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
 const s=seats([5000,5000]);s[0].stack=0;s[0].allIn=true;
 room.state.seats=s;room.state.board=[];room.state.phase='PREFLOP';room.state.buttonSeat=0;
 let actions=0;room.runBettingRound=async()=>actions++;
 const phases:string[]=[];room.broadcastTableState=()=>phases.push(room.state.phase);
 await room.advancePhase(makeDeck());assert.equal(actions,0);assert.equal(room.state.board.length,5);
 assert.ok(phases.includes('FLOP')&&phases.includes('TURN')&&phases.includes('RIVER'));
 assert.equal(room.state.seats.reduce((sum:number,p:any)=>sum+p.stack,0),24500);
});
test('real server forbids raises into a dry side pot and limits all-in to call',()=>{
 const room:any=new HybridHoldemRoom(false);const s=seats([5000,200]);s[0].stack=0;s[0].allIn=true;
 room.state.seats=s;room.state.activeSeatId=1;
 assert.equal(room.mapUserAction({action:'raise',amount:6000}),null);
 assert.deepEqual(room.mapUserAction({action:'allin',amount:19800}),{action:'call',amount:4800});
});
test('equity sampler handles ties and nut hands without hidden-card input',()=>{
 const royal:Card[]='TJQKA'.split('').map(rank=>({rank:rank as Card['rank'],suit:'♣'}));
 assert.equal(estimateEquity(seats([0])[0].holeCards,royal,1),0.5);
 assert.equal(estimateEquity(seats([0])[0].holeCards,royal,3),0.25);
 const hole:Card[]=[{rank:'A',suit:'♠'},{rank:'K',suit:'♠'}];
 const nuts:Card[]=[{rank:'Q',suit:'♠'},{rank:'J',suit:'♠'},{rank:'T',suit:'♠'},{rank:'2',suit:'♣'},{rank:'3',suit:'♦'}];
 assert.equal(estimateEquity(hole,nuts,7),1);
});
test('AI ignores rake while called EV accounts for eligible side pots',()=>{
 assert.equal(afterRakeOdds(300,100),0.25);assert.ok(afterRakeOdds(300,100)===0.25);
 const s=seats([5000,5000]);s[0].stack=0;s[0].allIn=true;s[1].currentBet=200;s[1].totalBet=200;
 const royal:Card[]='TJQKA'.split('').map(rank=>({rank:rank as Card['rank'],suit:'♣'}));
 const value=calledActionEV(s[1].holeCards,royal,{seats:s,actorId:1},4800);
 assert.equal(value,5000-4800);
});
test('training uses shared settlement across 25 complete self-play hands',()=>{
 const trainer:any=new SelfPlayTrainer();for(let i=0;i<25;i++) {
  const result=trainer._playOneHand();assert.ok(Number.isFinite(result.loss));
 }
});
test('randomized settlement conserves chips minus only rake',()=>{
 let seed=7;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let k=0;k<100;k++) {
  const s=seats([rand()%10000+1,rand()%10000+1,rand()%10000+1,rand()%10000+1]);
  const max=Math.max(...s.map(p=>p.totalBet));
  s.forEach(p=>{if(p.totalBet<max && rand()%3===0){p.folded=true;p.inHand=false;}});
  const result=settleHand(s,board,0);
  assert.equal(result.results.reduce((a,r)=>a+r.payout,0)+result.totalRake,s.reduce((a,p)=>a+p.totalBet,0));
  assert.equal(result.results.reduce((a,r)=>a+r.netProfit,0),-result.totalRake);
  const sorted=s.map(p=>p.totalBet).sort((a,b)=>b-a);
  assert.equal(result.totalRake,Math.floor((s.reduce((sum,p)=>sum+p.totalBet,0)-(sorted[0]-sorted[1]))*.05));
 }
});

test('real server continues side-pot betting while two solvent players remain',async()=>{
 const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
 const s=seats([5000,5000,5000]);s[0].stack=0;s[0].allIn=true;s.forEach(p=>p.currentBet=0);
 room.state.seats=s;room.state.phase='FLOP';room.state.board=board.slice(0,3);room.state.pot=15000;
 let actions=0;room.getDecision=async()=>{actions++;return {action:'check',amount:0};};
 await room.runBettingRound(0,1,makeDeck());assert.equal(actions,2);
});
test('real server waits for one covering call, then skips all later betting',async()=>{
 const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
 const s=seats([5000,200]);s[0].stack=0;s[0].allIn=true;
 room.state.seats=s;room.state.phase='PREFLOP';room.state.board=[];
 let actions=0;room.getDecision=async()=>{actions++;return {action:'call',amount:4800};};
 await room.runBettingRound(0,1,makeDeck());assert.equal(actions,1);
 await room.advancePhase(makeDeck());assert.equal(actions,1);
});

test('preflop fold-win all-in returns excess with matched rake',()=>{
 const s=seats([20000,200]);s[1].folded=true;s[1].inHand=false;
 const r=settleHand(s,[],0);
 assert.equal(r.totalRake,20);assert.equal(r.results[0].payout,20180);
 assert.equal(r.results[0].netProfit,180);assert.equal(r.results[1].payout,0);
});

test('zero-rake AI EV exceeds charged settlement only by expected rake share',()=>{
 const s=seats([5000,200]);s[0].allIn=true;s[0].stack=0;
 const royal:Card[]='TJQKA'.split('').map(rank=>({rank:rank as Card['rank'],suit:'♣'}));
 // Covering player bets 19,800 more, but only 4,800 can be matched.
 const ev=calledActionEV(s[1].holeCards,royal,{seats:s,actorId:1},19800);
 const projected=s.map((p,i)=>i===1?{...p,totalBet:20000,currentBet:20000}:p);
 const payout=settleHand(projected,royal,0).results[1].payout;
 assert.equal(ev,payout-19800+250);assert.equal(ev,200);
});

test('fold-win AI EV is gross and excludes returned chips from profit',()=>{
 const s=seats([200,200]);
 const context={seats:s,actorId:0};
 assert.equal(uncontestedActionEV(context,400),400);
 assert.equal(uncontestedActionEV(context,19800),400);
});

test('real server preflop trigger taxes only matched chips and fully returns excess',async()=>{
 const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
 const s=seats([20000,200]);s[1].folded=true;s[1].inHand=false;
 room.state.seats=s;room.state.board=[];room.state.buttonSeat=0;
 let observed:any;room.broadcastTableState=()=>{if(room.state.winnerInfo)observed=structuredClone(room.state.winnerInfo);};
 await room.finishHand(false);
 assert.equal(observed.rake,20);
 assert.equal(observed.results[0].payout,20180);
 assert.equal(room.state.seats[0].stack,20180);
});
