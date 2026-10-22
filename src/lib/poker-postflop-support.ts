import {drawBoard} from './poker-board-defense';
import {evaluateBestHand,type Card} from './poker-engine';
import type {BotPersona} from './personas';
import type {LiveAction} from './poker-live';
import {classifyHandTier,HandTier} from './equity-engine';
import {estimateEquity,afterRakeOdds} from './poker-ai';
export function hasMadeHit(hole:Card[],board:Card[]) {
 if(hole.length!==2||board.length<3)return false;
 return hole[0].rank===hole[1].rank||hole.some(c=>board.some(b=>b.rank===c.rank))
  ||classifyHandTier(hole,board).tier>=HandTier.TWO_PAIR_PLUS;
}
export function postflopSupport(c:{hole:Card[];board:Card[];base:BotPersona;persona:BotPersona;call:number;pot:number;stack:number;
 currentBet:number;minRaise:number;maxRaise:number;canRaise:boolean;isOOP:boolean;initiative:boolean;checked:boolean;opponents:number},action:LiveAction,random= Math.random):{action:LiveAction;path?:string} {
 if(c.board.length<3||c.stack<=0)return {action};
 const made=hasMadeHit(c.hole,c.board),tier=classifyHandTier(c.hole,c.board).tier;
 const tight=c.base.vpip<=.30&&c.base.aggression<=.55;
 const bet=(fraction:number,path:string)=>{
  const target=Math.max(c.minRaise,c.currentBet+Math.floor(c.pot*fraction));
  // Never turn a small probe into a forced shove, or bet into a dry side pot.
  return c.canRaise&&target<c.maxRaise ? {action:{action:'raise' as const,amount:target,isBluff:!made},path}:{action};
 };
 // Value mix applies on every street, OOP or after checks in position.
 // Estimate only from our cards and the public board, never human hit hints.
 if(c.call===0&&!c.checked&&c.canRaise&&['check','fold'].includes(action.action)
   &&tier>=HandTier.TOP_PAIR&&c.pot>0) {
  const playsBoard=c.board.length===5&&evaluateBestHand(c.hole,c.board)===evaluateBestHand(c.board.slice(0,2),c.board.slice(2));
  const eq=playsBoard?0:estimateEquity(c.hole,c.board,Math.max(1,c.opponents),192);
  if(eq>=.62) {
   const frequency=Math.max(.3,Math.min(.85,.40+c.persona.aggression*.45-(c.isOOP?.08:0)));
   if(random()<frequency) {
    const fraction=[.25,.5,.75][Math.min(2,Math.floor(random()*3))];
    const target=c.currentBet+Math.floor(c.pot*fraction);
    // Preserve literal pot fractions: don't silently inflate an illegal small bet.
    if(target>=c.minRaise&&target<=c.maxRaise&&target>c.currentBet)
     return {action:{action:target===c.maxRaise?'allin':'raise',amount:target,isBluff:false},path:'persona-value-bet'};
   }
  }
 }
 // One flop decision only: last preflop aggressor, no incoming bet or prior check.
 if(c.board.length===3&&c.initiative&&!c.checked&&c.call===0&&!made&&c.canRaise) {
  if(c.persona.aggression>=.65) {
   if(random()<.65)return bet(.25,'missed-flop-cbet');
   return {action:{action:'check',amount:0},path:'missed-flop-check-mix'};
  }
  if(tight&&!c.isOOP&&['check','fold'].includes(action.action)
    &&estimateEquity(c.hole,c.board,Math.max(1,c.opponents),192)>=.40&&random()<c.persona.bluffFreq)
   return bet(1/3+random()*(3/4-1/3),'tight-position-probe');
 }
 // Defend using own equity and public information, never an opponent hit flag.
 if(!drawBoard(c.board)&&tight&&c.board.length<5&&action.action==='fold'&&c.call>0
   &&c.call<c.stack&&c.call<=c.pot*.5&&c.call<=c.stack*.2&&(made||tier===HandTier.DRAW)) {
  const eq=estimateEquity(c.hole,c.board,Math.max(1,c.opponents),192);
  if(eq>=afterRakeOdds(c.pot,c.call)&&random()<.4)
   return {action:{action:'call',amount:c.call},path:'tight-range-catch'};
 }
 return {action};
}
