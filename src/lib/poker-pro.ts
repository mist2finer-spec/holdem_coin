import type {BotPersona} from './personas';
import type {Card} from './poker-engine';
import {contributionLayers,type BettingSeat} from './poker-rules';
import {pricedCallEquity} from './poker-priced-call';

/** Call-only rescue against a public value range, with no access to opponent cards. */
export function proCatchDecision(ctx:{persona:BotPersona;hole:Card[];board:Card[];seats:BettingSeat[];actorId:number}) {
 if(ctx.persona.role!=='pro')return null;
 const actor=ctx.seats.find(s=>s.seatId===ctx.actorId);
 const alive=ctx.seats.filter(s=>s.inHand&&!s.folded);
 if(!actor||actor.allIn||actor.stack<=0||alive.length<2)return null;
 const cost=Math.min(actor.stack,Math.max(...alive.map(s=>s.currentBet))-actor.currentBet);
 if(cost<=0)return null;
 const threshold=Math.max(.45,Math.min(.52,ctx.persona.catchEquity??.49));
 const projected=ctx.seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actor.seatId?cost:0)}));
 let pot=0,expected=0;
 for(const layer of contributionLayers(projected)) {
  if(layer.refundSeatId!==undefined||!layer.eligibleSeatIds.includes(actor.seatId))continue;
  const opponents=layer.eligibleSeatIds.length-1;
  const equity=pricedCallEquity(ctx.hole,ctx.board,opponents);
  pot+=layer.amount;expected+=layer.amount*equity;
 }
 const equity=pot?expected/pot:0;
 const locked=cost===actor.stack||alive.every(s=>s.seatId===actor.seatId||s.allIn||s.stack===0);
 const realization=ctx.board.length===5||locked?1:.85;
 const callEV=expected*realization-cost;
 return {cost,equity,threshold,callEV,realization,accepted:equity>=threshold&&callEV>Math.max(1,pot*.01)};
}
