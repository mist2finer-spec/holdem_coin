import {evaluateBestHand,type Card} from './poker-engine';
import {classifyHandTier,HandTier} from './equity-engine';
import {estimateEquity} from './poker-ai';
import {contributionLayers,type BettingSeat} from './poker-rules';
import {riverRangeEquity} from './poker-river-defense';
import type {BotPersona} from './personas';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** Board texture is public; a threat is not proof the bettor completed a draw. */
export function drawBoard(board:Card[]) {
 if(![3,4,5].includes(board.length))return false;
 const counts=new Map<string,number>();for(const c of board)counts.set(c.suit,(counts.get(c.suit)||0)+1);
 const flush=[...counts.values()].some(n=>n>=(board.length===3?2:3));
 const ranks=new Set(board.map(c=>'23456789TJQKA'.indexOf(c.rank)));
 if(ranks.has(12))ranks.add(-1);
 let straight=false;
 for(let low=-1;low<=8;low++)if([...ranks].filter(r=>r>=low&&r<=low+4).length>=3)straight=true;
 return flush||straight;
}
export function drawCallFrequency(base:Pick<BotPersona,'aggression'>,effective=base) {
 return Math.min(.6,.4+.2*clamp((base.aggression*.8+effective.aggression*.2-.20)/.62));
}

type Context={hole:Card[];board:Card[];seats:BettingSeat[];actorId:number;base:BotPersona;persona:BotPersona;
 isOOP?:boolean;raiseLevel?:number};
/** Additional fold rescue only. No guessed future bets or inaccessible side pots. */
export function boardDefenseDecision(c:Context,random=Math.random) {
 if(c.hole.length!==2||![3,4,5].includes(c.board.length))return null;
 const alive=c.seats.filter(s=>s.inHand&&!s.folded),actor=alive.find(s=>s.seatId===c.actorId);
 if(!actor||actor.allIn||actor.stack<=0||alive.length<2)return null;
 const cost=Math.min(actor.stack,Math.max(...alive.map(s=>s.currentBet))-actor.currentBet);
 if(cost<=0)return null;
 const scary=drawBoard(c.board),river=c.board.length===5;
 const tier=classifyHandTier(c.hole,c.board).tier;
 // A board-only pair/straight/flush does not turn unrelated cards into a catcher.
 const playsBoard=river&&evaluateBestHand(c.hole,c.board)===evaluateBestHand(c.board.slice(0,2),c.board.slice(2));
 const hasHand=!playsBoard&&(tier>=HandTier.WEAK_PAIR||(!river&&tier===HandTier.DRAW));
 const projected=c.seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actor.seatId?cost:0)}));
 const layers=contributionLayers(projected).filter(p=>p.refundSeatId===undefined&&p.eligibleSeatIds.includes(actor.seatId));
 const pot=layers.reduce((n,p)=>n+p.amount,0),price=cost/Math.max(1,pot);
 const cheap=river&&price<=.08&&hasHand;
 if(!cheap&&(!scary||!hasHand))return null;
 // On a river, catches need showdown value, not a missed draw classified as air.
 let expected=0;
 for(const layer of layers){
  const opponents=layer.eligibleSeatIds.length-1;
  const q=river
   ? Math.pow(riverRangeEquity(c.hole,c.board),Math.max(1,opponents))
   :estimateEquity(c.hole,c.board,opponents,128,(c.raiseLevel||0)>=2?'three-bet':'open');
  expected+=layer.amount*q;
 }
 const locked=cost===actor.stack||alive.every(s=>s.seatId===actor.seatId||s.allIn||s.stack===0);
 const realization=river||locked?1:c.isOOP?.82:.90;
 const equity=pot?expected/pot:0,callEV=expected*realization-cost,margin=Math.max(1,pot*.01);
 const frequency=cheap?1:drawCallFrequency(c.base,c.persona);
 const eligible=callEV>margin;
 return {kind:cheap?'cheap-river':'draw-board',frequency,cost,pot,price,equity,realization,callEV,margin,eligible,
  accepted:eligible&&(cheap||random()<frequency)};
}
