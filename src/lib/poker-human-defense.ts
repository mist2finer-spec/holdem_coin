import {evaluateBestHand, type Card} from './poker-engine';
import {matchesOpponentRange} from './poker-ai';
import {contributionLayers, RAKE_RATE, type BettingSeat} from './poker-rules';

type PrivateSeat = BettingSeat & {isBot:boolean; holeCards:Card[]};
export const HUMAN_DEFENSE_THRESHOLD = 0.46;
const samples = 1024;
// Private referee data, never an input to the trainer or a public snapshot.
// Bounded cache: no per-hand persistent storage or unbounded learning state.
const cache = new Map<string,{equity:number;callEV:number}>();

export function humanDefenseEstimate(seats:PrivateSeat[], actorId:number, humanId:number) {
  const actor=seats.find(s=>s.seatId===actorId),human=seats.find(s=>s.seatId===humanId);
  if(!actor?.isBot || !human || human.isBot || actor.holeCards.length!==2 || human.holeCards.length!==2
    || !actor.inHand || actor.folded || actor.allIn || actor.stack<=0 || !human.inHand || human.folded) return null;
  const highest=Math.max(...seats.filter(s=>s.inHand&&!s.folded).map(s=>s.currentBet));
  if(human.currentBet!==highest)return null;
  const cost=Math.min(actor.stack,Math.max(0,highest-actor.currentBet));
  if(cost<=0)return null;
  const known=[...actor.holeCards,...human.holeCards].map(c=>c.rank+c.suit);
  if(new Set(known).size!==4 || known.some(c=>!/^([2-9TJQKA])[♠♥♦♣]$/.test(c)))return null;
  // Other players' cards remain UNKNOWN. Project their calls conservatively;
  // each pot is evaluated only against players eligible for that pot.
  const target=actor.currentBet+cost;
  const projected=seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actorId?cost:
    s.inHand&&!s.folded&&!s.allIn?Math.min(s.stack,Math.max(0,target-s.currentBet)):0)}));
  const pots=contributionLayers(projected).filter(p=>p.refundSeatId===actorId||p.eligibleSeatIds.includes(actorId));
  const others=seats.filter(s=>s.seatId!==actorId&&s.seatId!==humanId&&s.inHand&&!s.folded);
  const key=JSON.stringify([known,pots,others.map(s=>s.seatId),cost]);
  const saved=cache.get(key);if(saved)return saved;
  const deck:Card[]=[];
  for(const suit of ['♠','♥','♦','♣'] as const)for(const rank of '23456789TJQKA')
    if(!known.includes(rank+suit))deck.push({rank:rank as Card['rank'],suit});
  // Matchup-based deterministic seed: no access to the actual deck/runout.
  let seed=2166136261;
  for(const char of known.join(''))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let headsUp=0,payout=0;
  for(let sample=0;sample<samples;sample++) {
    const cards=[...deck];
    const draw=()=>cards.splice(Math.floor(random()*cards.length),1)[0];
    const hands=others.map(s=>{
      let a=0,b=1;
      for(let attempt=0;attempt<64;attempt++) {
        a=Math.floor(random()*cards.length);b=Math.floor(random()*(cards.length-1));if(b>=a)b++;
        if(matchesOpponentRange([cards[a],cards[b]],'open'))break;
      }
      const hole=[cards[a],cards[b]];
      cards.splice(Math.max(a,b),1);cards.splice(Math.min(a,b),1);
      return {id:s.seatId,hole};
    });
    const board=Array.from({length:5},draw);
    const own=evaluateBestHand(actor.holeCards,board),opp=evaluateBestHand(human.holeCards,board);
    headsUp+=own>opp?1:own===opp?0.5:0;
    const scores=new Map([[actorId,own],[humanId,opp],...hands.map(h=>[h.id,evaluateBestHand(h.hole,board)] as [number,number])]);
    for(const pot of pots) {
      if(pot.refundSeatId===actorId){payout+=pot.amount;continue;}
      const values=pot.eligibleSeatIds.map(id=>scores.get(id)!);
      const best=Math.max(...values);
      if(own===best)payout+=(pot.amount-Math.floor(pot.amount*RAKE_RATE))/values.filter(v=>v===best).length;
    }
  }
  const result={equity:headsUp/samples,callEV:payout/samples-cost};
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  cache.set(key,result);return result;
}

// Only this boolean crosses into bot decision code. The player-specific oracle
// deliberately uses private cards; it is a game balancing rule, not fair range AI.
export function allowHumanDefense(options:{seats:PrivateSeat[];actorId:number;humanId?:number;board:Card[];raiseLevel:number}) {
  if(options.board.length || options.raiseLevel<1 || options.humanId===undefined)return false;
  const result=humanDefenseEstimate(options.seats,options.actorId,options.humanId);
  return !!result && result.equity>=HUMAN_DEFENSE_THRESHOLD && result.callEV>0;
}
