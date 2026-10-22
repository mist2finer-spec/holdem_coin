import {evaluateBestHand,type Card} from './poker-engine';
import {estimateEquity} from './poker-ai';
import {rakedContributionLayers,RAKE_RATE,type BettingSeat} from './poker-rules';

const cache=new Map<string,number>();
const cardKey=(c:Card)=>c.rank+c.suit;

/** Public value prior, not the actual bettor's cards. Ties count as pot shares.
 * Select from the top 35% of current board strength, then simulate runouts.
 * Remaining opponents are dealt without replacement. If the upper range is
 * exhausted, use the strongest remaining legal combination, never hidden cards.
 */
export function pricedCallEquity(hole:Card[],board:Card[],opponents:number):number {
  if(opponents<=0)return 1;
  if(board.length===0)return estimateEquity(hole,board,opponents,384,'jam-call');
  const key=[hole.map(cardKey).sort().join(''),board.map(cardKey).join(''),opponents].join('|');
  const saved=cache.get(key);if(saved!==undefined)return saved;
  const known=new Set([...hole,...board].map(cardKey)),deck:Card[]=[];
  for(const suit of ['♠','♥','♦','♣'] as const)for(const rank of '23456789TJQKA')
    if(!known.has(rank+suit))deck.push({rank:rank as Card['rank'],suit});
  const ranked:{a:number;b:number;score:number}[]=[];
  for(let a=0;a<deck.length;a++)for(let b=a+1;b<deck.length;b++)
    ranked.push({a,b,score:evaluateBestHand([deck[a],deck[b]],board)});
  ranked.sort((a,b)=>b.score-a.score);
  const cutoff=ranked[Math.max(0,Math.ceil(ranked.length*.35)-1)].score;
  const value=ranked.filter(p=>p.score>=cutoff);
  let seed=2166136261;
  for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let share=0;
  const fixedScore=board.length===5?evaluateBestHand(hole,board):0;
  for(let sample=0;sample<384;sample++){
    const used=new Set<number>(),hands:Card[][]=[];
    for(let i=0;i<opponents;i++){
      let picked:typeof value[number]|undefined;
      for(let attempt=0;attempt<32;attempt++){
        const candidate=value[Math.floor(random()*value.length)];
        if(!used.has(candidate.a)&&!used.has(candidate.b)){picked=candidate;break;}
      }
      picked??=ranked.find(p=>!used.has(p.a)&&!used.has(p.b));
      if(!picked)throw new Error('Insufficient legal cards for priced call');
      used.add(picked.a);used.add(picked.b);hands.push([deck[picked.a],deck[picked.b]]);
    }
    const remaining=deck.filter((_,i)=>!used.has(i)),runout=[...board];
    while(runout.length<5)runout.push(remaining.splice(Math.floor(random()*remaining.length),1)[0]);
    const mine=fixedScore||evaluateBestHand(hole,runout);
    let tied=1,beaten=false;
    for(const hand of hands){const score=evaluateBestHand(hand,runout);if(score>mine)beaten=true;else if(score===mine)tied++;}
    if(!beaten)share+=1/tied;
  }
  const equity=share/384;
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  cache.set(key,equity);return equity;
}

/** Only rescues a fold: cheap, closed all-in runouts or priced BB pair defense.
 * No speculative future side-pot money or OOP/stack risk premiums on a locked
 * runout. Future-street realization still discounts ordinary BB pair calls.
 */
export function pricedCallGuard(c:{hole:Card[];board:Card[];seats:BettingSeat[];actorId:number;
  bigBlindSeat:number;raiseLevel:number;bigBlind:number}) {
  if(c.hole.length!==2||![0,3,4,5].includes(c.board.length))return null;
  const actor=c.seats.find(s=>s.seatId===c.actorId);
  if(!actor||!actor.inHand||actor.folded||actor.allIn||actor.stack<=0)return null;
  const opponents=c.seats.filter(s=>s.seatId!==actor.seatId&&s.inHand&&!s.folded);
  if(!opponents.length)return null;
  const highest=Math.max(c.board.length===0?c.bigBlind:0,...opponents.map(s=>s.currentBet),actor.currentBet);
  const call=Math.max(0,highest-actor.currentBet),cost=Math.min(call,actor.stack);
  if(cost<=0)return null;
  // Forced blind chips alone must not bypass rare-hand cold-entry caps.
  const committed=c.board.length===0?actor.currentBet>c.bigBlind
    :actor.currentBet>0||(cost===actor.stack&&actor.totalBet>c.bigBlind);
  // A stack-capped call is final for this actor even when others can continue
  // betting a separate side pot. Their hypothetical future bets are excluded.
  const locked=committed&&(cost===actor.stack||opponents.every(s=>s.allIn||s.stack===0));
  const pair=c.hole.length===2&&c.hole[0].rank===c.hole[1].rank&&'23456789TJQKA'.indexOf(c.hole[0].rank)>=4;
  const starting=actor.stack+actor.totalBet;
  const blindPair=c.board.length===0&&actor.seatId===c.bigBlindSeat&&c.raiseLevel===1&&pair
    &&highest<=2*c.bigBlind&&call<=c.bigBlind&&starting>=10*c.bigBlind&&cost<=starting*.10
    &&opponents.every(s=>s.allIn||s.currentBet>=highest);
  if(!locked&&!blindPair)return null;
  const projected=c.seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actor.seatId?cost:0)}));
  const layers=rakedContributionLayers(projected,RAKE_RATE,true)
    .filter(p=>p.refundSeatId===undefined&&p.eligibleSeatIds.includes(actor.seatId));
  const netPot=layers.reduce((n,p)=>n+p.amount-p.rake,0);
  if(netPot<=0)return null;
  const requiredEquity=cost/netPot;
  const kind=locked?'committed-allin':'bb-pair';
  // A side pot the actor cannot win never makes a call appear artificially cheap.
  if(locked&&requiredEquity>.15)return {kind,cost,netPot,requiredEquity,accepted:false,reason:'price'};
  let expected=0;
  for(const p of layers){
    const count=p.eligibleSeatIds.length-1;
    const q=locked?pricedCallEquity(c.hole,c.board,count):estimateEquity(c.hole,[],count,384,'open');
    expected+=(p.amount-p.rake)*q;
  }
  const realization=locked||cost===actor.stack?1:.82;
  const callEV=expected*realization-cost;
  const margin=Math.max(1,netPot*.01);
  return {kind,cost,netPot,requiredEquity,equity:expected/netPot,realization,callEV,margin,
    accepted:callEV>margin,reason:callEV>margin?'positive-ev':'equity'};
}
