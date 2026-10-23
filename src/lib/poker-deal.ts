import {makeDeck,type Card} from './poker-engine';

/** Public house rule, not a fair/standard Hold'em shuffle or a win-rate target.
 * Multipliers apply to JJ+/AK versus the 40/1326 standard starting-hand rate.
 * Board runouts, hand strength and settlement are never used in this decision.
 */
export const DEALING_PROFILE = Object.freeze({
  id:'paced-premium-v1', premiumRange:'JJ+/AK',
  humanPremiumMultiplier:0.8, cpuPremiumMultiplier:0.9,
});
export const DEALING_NOTICE = '밸런스 배분: JJ+/AK 시작 패 확률 · 플레이어 20%↓ / CPU 10%↓ (일반 무작위 배분과 다름)';
const premiumPair=(a:Card,b:Card)=>a.rank===b.rank&&'JQKA'.includes(a.rank)
  ||(a.rank==='A'&&b.rank==='K')||(a.rank==='K'&&b.rank==='A');
export function isPremiumStartingHand(hole:readonly Card[]) {
  if(hole.length!==2)return false;
  return premiumPair(hole[0],hole[1]);
}
type DealSeat={seatId:number;isBot:boolean};

function pickPair(deck:Card[],isBot:boolean,random:()=>number):[number,number] {
  const premium:[number,number][]=[];
  for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++)
    if(premiumPair(deck[a],deck[b]))premium.push([a,b]);
  const total=deck.length*(deck.length-1)/2;
  const multiplier=isBot?DEALING_PROFILE.cpuPremiumMultiplier:DEALING_PROFILE.humanPremiumMultiplier;
  // Use the full-deck baseline at EVERY seat. A remaining-deck baseline would
  // partly undo later CPUs' reduction when earlier humans receive fewer premiums.
  const premiumProbability=40/1326*multiplier;
  if(premium.length&&random()<premiumProbability) {
    const [a,b]=premium[Math.floor(random()*premium.length)];
    return random()<.5?[a,b]:[b,a];
  }
  // Uniform ordinary pairs. A bounded fallback also handles a pathological
  // injected RNG without an event-loop freeze. It still excludes premiums.
  for(let attempt=0;attempt<128;attempt++) {
    const a=Math.floor(random()*deck.length);
    let b=Math.floor(random()*(deck.length-1));if(b>=a)b++;
    if(!premiumPair(deck[a],deck[b]))return [a,b];
  }
  let ordinal=Math.floor(random()*(total-premium.length));
  for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++) {
    if(!premiumPair(deck[a],deck[b])&&ordinal--===0)return [a,b];
  }
  throw new Error('No ordinary starting hand available');
}

export function dealStartingHands(seats:readonly DealSeat[],buttonSeat:number,random=Math.random) {
  if(seats.length<2||seats.length>10||!Number.isSafeInteger(buttonSeat)
    ||seats.some(s=>!Number.isSafeInteger(s.seatId)||s.seatId<0||typeof s.isBot!=='boolean')
    ||new Set(seats.map(s=>s.seatId)).size!==seats.length)throw new Error('Invalid deal seats');
  const rng=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid deal RNG');return n;};
  const deck=makeDeck(rng),hands=new Map<number,Card[]>();
  const ring=Math.max(buttonSeat+1,...seats.map(s=>s.seatId+1));
  // Rotate first allocation with the button instead of privileging seat zero.
  const ordered=[...seats].sort((a,b)=>(a.seatId-buttonSeat-1+ring)%ring-(b.seatId-buttonSeat-1+ring)%ring);
  for(const seat of ordered) {
    const [a,b]=pickPair(deck,seat.isBot,rng);
    hands.set(seat.seatId,[deck[a],deck[b]]);
    deck.splice(Math.max(a,b),1);deck.splice(Math.min(a,b),1);
  }
  return {deck,hands};
}
