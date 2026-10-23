import {makeDeck,type Card} from './poker-engine';

/** Public non-standard house dealing rule. Rejection strengths become weights;
 * final frequencies are normalized and are NOT promised percentage reductions.
 * No opponent cards, hand outcomes, stack sizes or future board enter selection.
 */
export const DEALING_PROFILE = Object.freeze({
  id:'paced-textures-v2',method:'weighted-pairs',overlap:'maximum',sameForAllSeats:true,
  pairRejection:0.6,suitedRejection:0.5,connectorRejection:0.4,
});
export const DEALING_NOTICE = '밸런스 배분: 페어·수딧·커넥터/원갭 출현 억제 · 플레이어/CPU 동일 기준 (일반 무작위 배분과 다름)';
const ranks='23456789TJQKA';
export function startingHandFeatures(a:Card,b:Card) {
  const av=ranks.indexOf(a.rank)+2,bv=ranks.indexOf(b.rank)+2,diff=Math.abs(av-bv);
  return {pair:a.rank===b.rank,suited:a.suit===b.suit,
    connector:diff===1||diff===2||Math.min(av,bv)===2&&Math.max(av,bv)===14};
}
export function startingHandWeight(a:Card,b:Card) {
  const f=startingHandFeatures(a,b);
  const rejection=f.pair?DEALING_PROFILE.pairRejection:Math.max(
    f.suited?DEALING_PROFILE.suitedRejection:0,f.connector?DEALING_PROFILE.connectorRejection:0);
  return 1-rejection;
}
export function isPremiumStartingHand(hole:readonly Card[]) {
  if(hole.length!==2)return false;
  const [a,b]=hole;
  return a.rank===b.rank&&'JQKA'.includes(a.rank)
    ||a.rank==='A'&&b.rank==='K'||a.rank==='K'&&b.rank==='A';
}
type DealSeat={seatId:number;isBot:boolean};
function pickPair(deck:Card[],random:()=>number):[number,number] {
  let total=0;
  for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++)total+=startingHandWeight(deck[a],deck[b]);
  let roll=random()*total;
  for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++) {
    roll-=startingHandWeight(deck[a],deck[b]);
    if(roll<0)return random()<.5?[a,b]:[b,a];
  }
  // Floating-point tail fallback, bounded even with a constant injected RNG.
  return [deck.length-2,deck.length-1];
}
export function dealStartingHands(seats:readonly DealSeat[],buttonSeat:number,random=Math.random) {
  if(seats.length<2||seats.length>10||!Number.isSafeInteger(buttonSeat)||buttonSeat<0
    ||seats.some(s=>!Number.isSafeInteger(s.seatId)||s.seatId<0||s.seatId>9||typeof s.isBot!=='boolean')
    ||new Set(seats.map(s=>s.seatId)).size!==seats.length)throw new Error('Invalid deal seats');
  const rng=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid deal RNG');return n;};
  const deck=makeDeck(rng),hands=new Map<number,Card[]>();
  const ring=Math.max(buttonSeat+1,...seats.map(s=>s.seatId+1));
  const ordered=[...seats].sort((a,b)=>(a.seatId-buttonSeat-1+ring)%ring-(b.seatId-buttonSeat-1+ring)%ring);
  for(const seat of ordered) {
    const [a,b]=pickPair(deck,rng);
    hands.set(seat.seatId,[deck[a],deck[b]]);
    deck.splice(Math.max(a,b),1);deck.splice(Math.min(a,b),1);
  }
  // Remaining cards keep their shuffled order; no runout selection or forced winner.
  return {deck,hands};
}
