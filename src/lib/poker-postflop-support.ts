import type {Card} from './poker-engine';
import type {BotPersona} from './personas';
import type {LiveAction} from './poker-live';
import {classifyHandTier,HandTier} from './equity-engine';
import {estimateEquity,afterRakeOdds} from './poker-ai';
// The private boundary returns only aggregate booleans, never cards, ranks or equity.
export type HumanHitHint={humans:number;allMiss:boolean;bettorMiss:boolean};
export function hasMadeHit(hole:Card[],board:Card[]) {
 if(hole.length!==2||board.length<3)return false;
 return hole[0].rank===hole[1].rank||hole.some(c=>board.some(b=>b.rank===c.rank))
  ||classifyHandTier(hole,board).tier>=HandTier.TWO_PAIR_PLUS;
}
export function humanHitHint(seats:{seatId:number;isBot:boolean;inHand:boolean;folded:boolean;holeCards:Card[]}[],board:Card[],bettor?:number):HumanHitHint {
 const humans=seats.filter(s=>!s.isBot&&s.inHand&&!s.folded);
 const valid=(s:typeof humans[number])=>s.holeCards.length===2;
 return {humans:humans.length,allMiss:humans.length>0&&humans.every(s=>valid(s)&&!hasMadeHit(s.holeCards,board)),
  bettorMiss:humans.some(s=>s.seatId===bettor&&valid(s)&&!hasMadeHit(s.holeCards,board))};
}
export function postflopSupport(c:{hole:Card[];board:Card[];base:BotPersona;persona:BotPersona;call:number;pot:number;stack:number;
 currentBet:number;minRaise:number;maxRaise:number;canRaise:boolean;isOOP:boolean;initiative:boolean;checked:boolean;opponents:number;hint?:HumanHitHint},action:LiveAction,random= Math.random):{action:LiveAction;path?:string} {
 if(c.board.length<3||c.stack<=0)return {action};
 const made=hasMadeHit(c.hole,c.board),tier=classifyHandTier(c.hole,c.board).tier;
 const tight=c.base.vpip<=.30&&c.base.aggression<=.55;
 const bet=(fraction:number,path:string)=>{
  const target=Math.max(c.minRaise,c.currentBet+Math.floor(c.pot*fraction));
  // Never turn a small probe into a forced shove, or bet into a dry side pot.
  return c.canRaise&&target<c.maxRaise ? {action:{action:'raise' as const,amount:target,isBluff:!made},path}:{action};
 };
 // One flop decision only: last preflop aggressor, no incoming bet or prior check.
 if(c.board.length===3&&c.initiative&&!c.checked&&c.call===0&&!made&&c.canRaise) {
  if(c.persona.aggression>=.65) {
   if(random()<.65)return bet(.25,'missed-flop-cbet');
   return {action:{action:'check',amount:0},path:'missed-flop-check-mix'};
  }
  if(tight&&!c.isOOP&&c.hint?.allMiss&&['check','fold'].includes(action.action)&&random()<.5)
   return bet(1/3+random()*(3/4-1/3),'tight-position-probe');
 }
 // A miss is not proof of a bluff. Keep draws/strong hands on their normal path;
 // only rescue affordable folds with own equity against UNKNOWN opponent ranges.
 if(tight&&action.action==='fold'&&c.hint?.allMiss&&c.hint.bettorMiss&&c.call>0
   &&c.call<c.stack&&c.call<=c.pot*.5&&c.call<=c.stack*.2&&(made||tier===HandTier.DRAW)) {
  const eq=estimateEquity(c.hole,c.board,Math.max(1,c.opponents),192);
  if(eq>=afterRakeOdds(c.pot,c.call)&&random()<.4)
   return {action:{action:'call',amount:c.call},path:'tight-miss-hint-catch'};
 }
 return {action};
}
