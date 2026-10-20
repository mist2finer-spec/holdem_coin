import {evaluateBestHand, type Card} from './poker-engine';
import {contributionLayers, RAKE_RATE, type BettingSeat} from './poker-rules';
import type {BotPersona} from './personas';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Base identity dominates; current hand mood has a smaller influence.
export function riverCatchFrequency(base:Pick<BotPersona,'vpip'|'aggression'>, effective=base) {
  const tight=(p:typeof base)=>(clamp((0.65-p.vpip)/0.47)+clamp((0.82-p.aggression)/0.62))/2;
  return 0.05+0.35*clamp(tight(base)*0.8+tight(effective)*0.2);
}
const cache=new Map<string,number>();
// Enumerate every legal opponent combination, never actual opponent cards.
// Polarized prior: top 35% of showdown strength = value; bottom 35% = bluff.
// Fixed 35% bluff mass models a bluff-capable bettor; it is a policy prior, not measured truth.
export function riverRangeEquity(hole:Card[],board:Card[]) {
  const key=[...hole.map(c=>c.rank+c.suit).sort(),...board.map(c=>c.rank+c.suit).sort()].join('|');
  const saved=cache.get(key);if(saved!==undefined)return saved;
  const known=new Set([...hole,...board].map(c=>c.rank+c.suit));
  if(hole.length!==2||board.length!==5||known.size!==7)return 0;
  const deck:Card[]=[];
  for(const suit of ['♠','♥','♦','♣'] as const)for(const rank of '23456789TJQKA')
    if(!known.has(rank+suit))deck.push({rank:rank as Card['rank'],suit});
  const scores:number[]=[];
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)scores.push(evaluateBestHand([deck[i],deck[j]],board));
  scores.sort((a,b)=>a-b);
  const mine=evaluateBestHand(hole,board),count=Math.ceil(scores.length*0.35);
  const share=(s:number)=>s<mine?1:s===mine?0.5:0;
  const equity=0.65*scores.slice(-count).reduce((n,s)=>n+share(s),0)/count
    +0.35*scores.slice(0,count).reduce((n,s)=>n+share(s),0)/count;
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  cache.set(key,equity);return equity;
}
export function riverCatchDecision(ctx:{hole:Card[];board:Card[];seats:BettingSeat[];actorId:number;
  base:BotPersona;persona:BotPersona}, random= Math.random) {
  const frequency=riverCatchFrequency(ctx.base,ctx.persona);
  const alive=ctx.seats.filter(s=>s.inHand&&!s.folded),actor=alive.find(s=>s.seatId===ctx.actorId);
  if(ctx.board.length!==5||alive.length!==2||!actor||actor.allIn||actor.stack<=0)return null;
  const cost=Math.min(actor.stack,Math.max(...alive.map(s=>s.currentBet))-actor.currentBet);
  if(cost<=0)return null;
  const equity=riverRangeEquity(ctx.hole,ctx.board);
  // Existing contributions only: calling never invents future opponent bets.
  const projected=ctx.seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actor.seatId?cost:0)}));
  let netPot=0,refund=0;
  for(const layer of contributionLayers(projected)) {
    if(layer.refundSeatId===actor.seatId)refund+=layer.amount;
    else if(layer.eligibleSeatIds.includes(actor.seatId))netPot+=layer.amount-Math.floor(layer.amount*RAKE_RATE);
  }
  const callEV=equity*netPot+refund-cost;
  const eligible=callEV>0;
  return {frequency,equity,callEV,cost,eligible,accepted:eligible&&random()<frequency};
}
