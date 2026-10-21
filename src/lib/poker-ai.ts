import { Card, evaluateBestHand } from './poker-engine';
import { BettingSeat, rakedContributionLayers, RAKE_RATE } from './poker-rules';
import type { PositionContext } from './poker-position';
import type { stackContext } from './poker-stack';

// Bounded deterministic rollouts using only the acting player's cards and public board.
// This is an equity estimator, not a GTO solver or knowledge of opponents' cards.
const cache=new Map<string,number>();
export type OpponentRange = 'open' | 'jam-call' | 'three-bet' | 'four-bet-call' | 'wide-three-bet';
export function matchesOpponentRange(hole: Card[], range: OpponentRange) {
  const ranks=hole.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
  const [high,low]=ranks, suited=hole[0].suit===hole[1].suit;
  // Deeper three-bettors continue against a four-bet with a tighter range.
  if(range==='four-bet-call')return high===low ? low>=8
    : high===12&&(low===11||(suited&&low===10)); // TT+, AK, AQs
  if(range==='wide-three-bet')return high===low ? low>=2
    : (high===12&&(suited||low>=6))||(high===11&&(suited?low>=5:low>=8))
      ||(high===10&&(suited?low>=6:low>=8))||(high===9&&low>=7)
      ||(suited&&low>=3&&high-low<=2);
  if(range==='three-bet')return high===low ? low>=5
    : (high===12&&low>=10)||(suited&&high===12&&(low>=8||low===3))
      ||(suited&&high===11&&low>=9)||(suited&&high===10&&low===9);
  return high===low ? low >= (range==='jam-call'?4:3)
    : range==='jam-call' ? (high===12 && low>=10) || (suited && high===12 && low>=9) || (suited && high===11 && low===10)
    : (high===12 && low>=8) || (high===11 && low>=9) || (suited && high>=9 && low>=7)
      || (suited&&low>=3&&high-low<=2);
}
export function estimateEquity(hole: Card[], board: Card[], opponents: number, samples=48, range?: OpponentRange, opponentRanges?:OpponentRange[]): number {
  if(opponents<=0)return 1;
  const key=[hole.map(c=>c.rank+c.suit).sort().join(''),board.map(c=>c.rank+c.suit).join(''),opponents,samples,range||'random',...(opponentRanges?[opponentRanges.join(',')]:[])].join('|');
  const saved=cache.get(key);if(saved!==undefined)return saved;
  const known=new Set([...hole,...board].map(c=>c.rank+c.suit));
  const deck: Card[]=[];
  for(const suit of ['♠','♥','♦','♣'] as const)for(const rank of '23456789TJQKA') {
    if(!known.has(rank+suit))deck.push({rank:rank as Card['rank'],suit});
  }
  let seed=2166136261;for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let share=0;
  for(let n=0;n<samples;n++) {
    const cards=[...deck];
    const draw=()=>cards.splice(Math.floor(random()*cards.length),1)[0];
    const drawHole=(opponentRange=range)=>{
      if(!opponentRange)return [draw(),draw()];
      let a=0,b=1;
      // Bounded rejection sampling; fallback to the final legal pair if a very
      // depleted deck has no matching pair. Never inspect actual opponent cards.
      for(let attempt=0;attempt<64;attempt++) {
        a=Math.floor(random()*cards.length);b=Math.floor(random()*(cards.length-1));if(b>=a)b++;
        if(matchesOpponentRange([cards[a],cards[b]],opponentRange))break;
      }
      const result=[cards[a],cards[b]];
      cards.splice(Math.max(a,b),1);cards.splice(Math.min(a,b),1);return result;
    };
    // Select range-conditioned hole cards before unknown board runouts.
    const hands=Array.from({length:opponents},(_,i)=>drawHole(opponentRanges?.[i]));
    const fullBoard=[...board];while(fullBoard.length<5)fullBoard.push(draw());
    const myScore=evaluateBestHand(hole,fullBoard);let ties=1,beaten=false;
    for(let i=0;i<opponents;i++) {
      const score=evaluateBestHand(hands[i],fullBoard);
      if(score>myScore)beaten=true;
      else if(score===myScore)ties++;
    }
    if(!beaten)share+=1/ties;
  }
  const result=share/samples;
  if(cache.size>=256)cache.delete(cache.keys().next().value!);
  cache.set(key,result);return result;
}

export interface DecisionContext { preflopPosition?: {early:boolean;inPositionVsRaiser:boolean}; seats: BettingSeat[]; actorId: number; position?: PositionContext; stack?: ReturnType<typeof stackContext>; forbidLimp?:boolean; limpedPreflop?:boolean; initiative?:boolean; openedPreflop?:boolean; isBlind?:boolean; threeBetRead?: {opportunities:number;rate:number;looseness:number}; lastRaiserSeat?:number }
export function afterRakeOdds(pot: number, cost: number, rate=RAKE_RATE) {
  return cost>0?cost/Math.max(1,(pot+cost)*(1-rate)):0;
}

// Conservative called EV: all eligible live opponents call up to their own stacks.
// Side-pot eligibility and uncalled refunds are accounted for at contribution level.
export function calledActionEV(hole: Card[], board: Card[], context: DecisionContext, cost: number, rate=RAKE_RATE, range?: OpponentRange, samples=range?192:48, rangesBySeat?:Record<number,OpponentRange>) {
  const actor=context.seats.find(s=>s.seatId===context.actorId)!;
  const target=actor.currentBet+cost;
  const projected=context.seats.map(seat=>{
    const extra=seat.seatId===actor.seatId?cost:seat.inHand&&!seat.folded&&!seat.allIn?Math.min(seat.stack,Math.max(0,target-seat.currentBet)):0;
    return {...seat,totalBet:seat.totalBet+extra};
  });
  let expected=0;
  for(const layer of rakedContributionLayers(projected,rate)) {
    if(layer.refundSeatId!==undefined){if(layer.refundSeatId===actor.seatId)expected+=layer.amount-layer.rake;continue;}
    if(!layer.eligibleSeatIds.includes(actor.seatId))continue;
    const opponentIds=layer.eligibleSeatIds.filter(id=>id!==actor.seatId);
    const ranges=rangesBySeat ? opponentIds.map(id=>rangesBySeat[id]||range||'open') : undefined;
    const q=estimateEquity(hole,board,opponentIds.length,samples,range,
      ranges?.some(r=>r!==range)?ranges:undefined);
    expected+=q*(layer.amount-layer.rake);
  }
  return expected-cost; // previously committed chips are sunk at this decision
}

// If everyone folds, our new bet returns to us AFTER the same house rake.
// Previous contributions are sunk; subtract only the incremental action cost.
export function uncontestedActionEV(context:DecisionContext,cost:number,rate=RAKE_RATE) {
  const pot=context.seats.reduce((sum,seat)=>sum+seat.totalBet,0);
  return pot-Math.floor((pot+cost)*rate);
}
