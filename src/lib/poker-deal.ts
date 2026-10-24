import {makeDeck,type Card} from './poker-engine';

/** Uniform 52-card Fisher-Yates shuffle, then two clockwise dealing rounds.
 * Seat role, stacks, private cards and outcomes never influence selection. */
export const DEALING_PROFILE = Object.freeze({
  id:'uniform-shuffle-v1',method:'fisher-yates-round-robin',sameForAllSeats:true,
  pairRejection:0,suitedRejection:0,connectorRejection:0,
});
export const DEALING_NOTICE = '52장 균등 셔플 · 플레이어/CPU 동일 확률';
const ranks='23456789TJQKA';
export function startingHandFeatures(a:Card,b:Card) {
  const av=ranks.indexOf(a.rank)+2,bv=ranks.indexOf(b.rank)+2,diff=Math.abs(av-bv);
  return {pair:a.rank===b.rank,suited:a.suit===b.suit,
    connector:diff===1||diff===2||Math.min(av,bv)===2&&Math.max(av,bv)===14};
}
/** Kept for diagnostics: every legal two-card combination has equal weight. */
export function startingHandWeight(_a:Card,_b:Card) { return 1; }
export function isPremiumStartingHand(hole:readonly Card[]) {
  if(hole.length!==2)return false;
  const [a,b]=hole;
  return a.rank===b.rank&&'JQKA'.includes(a.rank)
    ||a.rank==='A'&&b.rank==='K'||a.rank==='K'&&b.rank==='A';
}
type DealSeat={seatId:number;isBot:boolean};
export function dealStartingHands(seats:readonly DealSeat[],buttonSeat:number,random=Math.random) {
  if(seats.length<2||seats.length>10||!Number.isSafeInteger(buttonSeat)||buttonSeat<0||buttonSeat>9
    ||seats.some(s=>!Number.isSafeInteger(s.seatId)||s.seatId<0||s.seatId>9||typeof s.isBot!=='boolean')
    ||new Set(seats.map(s=>s.seatId)).size!==seats.length)throw new Error('Invalid deal seats');
  const rng=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid deal RNG');return n;};
  const deck=makeDeck(rng),hands=new Map<number,Card[]>();
  const ring=Math.max(buttonSeat+1,...seats.map(s=>s.seatId+1));
  const ordered=[...seats].sort((a,b)=>(a.seatId-buttonSeat-1+ring)%ring-(b.seatId-buttonSeat-1+ring)%ring);
  for(const seat of ordered)hands.set(seat.seatId,[]);
  for(let round=0;round<2;round++)for(const seat of ordered)hands.get(seat.seatId)!.push(deck.pop()!);
  // Runout uses the remaining shuffled deck, with no redraws or weighted picks.
  return {deck,hands};
}
