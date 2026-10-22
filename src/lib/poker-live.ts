import {boardDefenseDecision} from './poker-board-defense';
import {postflopSupport} from './poker-postflop-support';
import {supportTightParticipation} from './poker-participation';
import {riverCatchDecision} from './poker-river-defense';
import {minimumRaiseTo} from "./poker-sizing";
import type { ActionType, Card } from './poker-engine';
import type { BettingSeat } from './poker-rules';
import { hasBettingOpponent } from './poker-rules';
import { RPG_BOT_POOL, individualLivePersona, type BotPersona } from './personas';
import { classifyHandTier } from './equity-engine';
import type { SelfPlayTrainer } from './self-play-trainer';
import { positionContext } from './poker-position';
import { stackContext } from './poker-stack';
import { planPreflop, preflopPosition } from './poker-preflop';
import {preflopCallModel} from './poker-opponent-model';
import {proCatchDecision} from './poker-pro';
import {pricedCallGuard} from './poker-priced-call';

export const LIVE_RULES = Object.freeze({
  version: "1.21.1",
  seats: 8, smallBlind: 100, bigBlind: 200, buyIn: 5000,
  botCashOut: 100000, userSeconds: 10, maxActions: 256,
  botThinkMin: 700, botThinkJitter: 900, actionPause: 800, resultPause: 5000,
});
export type LiveAction = { action: ActionType; amount: number; isBluff?: boolean };
type LiveSeat = BettingSeat & { hasActed: boolean };

export function handPositions(seats: BettingSeat[], previousButton: number) {
  const next = (after: number) => {
    for (let i = 1; i <= seats.length; i++) {
      const index = (after + i) % seats.length;
      if (seats[index].inHand) return index;
    }
    throw new Error('No eligible seat');
  };
  if (seats.filter(s => s.inHand).length < 2) throw new Error('At least two players required');
  const button = next(previousButton);
  const headsUp = seats.filter(s => s.inHand).length === 2;
  const smallBlind = headsUp ? button : next(button);
  const bigBlind = next(smallBlind);
  return { button, smallBlind, bigBlind, preflopStart: headsUp ? button : next(bigBlind), postflopStart: next(button) };
}

export function postBlind<T extends LiveSeat>(seat: T, blind: number): T {
  const cost = Math.min(blind, seat.stack);
  return { ...seat, stack: seat.stack - cost, currentBet: cost,
    totalBet: seat.totalBet + cost, allIn: seat.stack === cost };
}

export function normalizeLiveAction(seats: BettingSeat[], actorId: number, input: unknown, lastRaiseSize: number, raiseAllowed=true, bringIn=0): LiveAction | null {
  const actor = seats.find(s => s.seatId === actorId);
  if (!actor || !actor.inHand || actor.folded || actor.allIn || !input || typeof input !== 'object') return null;
  const { action, amount } = input as { action?: string; amount?: number };
  const maxBet = Math.max(bringIn, ...seats.filter(s => s.inHand && !s.folded).map(s => s.currentBet));
  const call = Math.max(0, maxBet - actor.currentBet);
  const callAction = (): LiveAction => ({ action: call >= actor.stack ? 'allin' : call > 0 ? 'call' : 'check', amount: Math.min(call, actor.stack) });
  const maxRaise = actor.currentBet + actor.stack;
  switch (action) {
    case 'fold': return { action, amount: 0 };
    case 'check': return call === 0 ? { action, amount: 0 } : null;
    case 'call': return callAction();
    case 'allin': return hasBettingOpponent(seats, actorId,maxBet) && raiseAllowed ? { action, amount: actor.stack } : callAction();
    case 'raise':
      if (!raiseAllowed || !hasBettingOpponent(seats, actorId,maxBet) || !Number.isSafeInteger(amount) || amount! <= maxBet || amount! > maxRaise) return null;
      if (amount !== maxRaise && amount! < minimumRaiseTo(maxBet,LIVE_RULES.bigBlind,lastRaiseSize)) return null;
      return { action: amount === maxRaise ? 'allin' : 'raise', amount: amount === maxRaise ? actor.stack : amount! };
    default: return null;
  }
}

export function applyLiveAction<T extends LiveSeat>(seat: T, decision: LiveAction): T {
  let { stack, currentBet, totalBet, folded, inHand, allIn } = seat;
  if (!Number.isSafeInteger(decision.amount) || decision.amount < 0) throw new Error('Invalid chip amount');
  if (decision.action === 'fold') { folded = true; inHand = false; }
  else if (decision.action !== 'check') {
    const cost = decision.action === 'allin' ? stack : decision.action === 'raise' ? decision.amount - currentBet : Math.min(decision.amount, stack);
    if (cost < 0 || cost > stack) throw new Error('Invalid action cost');
    stack -= cost; currentBet += cost; totalBet += cost; allIn = stack === 0;
  }
  return { ...seat, stack, currentBet, totalBet, peakStreetBet: Math.max(seat.peakStreetBet||0,currentBet), folded, inHand, allIn, hasActed: true };
}

export function mapLiveDecision(nn: {action: number; amount: number; isBluff?: boolean}, call: number, stack: number, currentBet: number): LiveAction {
  if (nn.action === 0) return { action: 'fold', amount: 0 };
  if (nn.action === 1) return { action: call === 0 ? 'check' : call >= stack ? 'allin' : 'call', amount: Math.min(call, stack) };
  if (nn.action === 4 || ([2, 3].includes(nn.action) && nn.amount >= stack + currentBet)) return { action: 'allin', amount: stack, isBluff: nn.isBluff };
  if (nn.action === 2 || nn.action === 3) return { action: 'raise', amount: nn.amount, isBluff: nn.isBluff };
  return { action: call > 0 ? 'fold' : 'check', amount: 0 };
}

export function decideLiveBot(trainer: SelfPlayTrainer, ctx: {
  actor: BettingSeat & { holeCards: Card[]; persona?: BotPersona };
  seats: BettingSeat[]; board: Card[]; pot: number; minRaise: number; maxRaise: number;
  button: number; smallBlind: number; bigBlind: number; hand: number; raiseLevel: number;
  threeBetRead?: {opportunities:number;rate:number;looseness:number}; lastRaiserSeat?:number;
  checkedThisStreet?: boolean;
  /** @deprecated Private-card referee overrides are no longer evaluated. */
  allowHumanCall?: () => boolean;
  onAudit?: (audit: Record<string, unknown>) => void;
  limpedPreflop?:boolean; previousStreetAggressor?:number|null; openedPreflop?:boolean;
}): LiveAction {
  const { actor, seats, board } = ctx;
  const persona = individualLivePersona(actor.persona || RPG_BOT_POOL[0], ctx.hand, actor.seatId, actor.stack + actor.totalBet);
  const call = Math.max(board.length===0?LIVE_RULES.bigBlind:0, ...seats.filter(s => s.inHand && !s.folded).map(s => s.currentBet)) - actor.currentBet;
  const livePot = ctx.pot + seats.reduce((sum, s) => sum + s.currentBet, 0);
  const context={boardLength:board.length,preflopPosition:preflopPosition(seats.map(s=>s.seatId),actor.seatId,ctx.button,ctx.bigBlind,ctx.lastRaiserSeat??seats.find(s=>s.seatId!==actor.seatId&&s.currentBet===actor.currentBet+call)?.seatId),actorId:actor.seatId,threeBetRead:ctx.threeBetRead,lastRaiserSeat:ctx.lastRaiserSeat,isBlind:[ctx.smallBlind,ctx.bigBlind].includes(actor.seatId),stack:stackContext(seats,actor.seatId),
    position:positionContext(seats,actor.seatId,ctx.button,ctx.checkedThisStreet),
    limpedPreflop:ctx.limpedPreflop,openedPreflop:ctx.openedPreflop,initiative:ctx.previousStreetAggressor===actor.seatId,
    seats:seats.map(({seatId,stack,currentBet,totalBet,inHand,folded,allIn})=>({seatId,stack,currentBet,totalBet,inHand,folded,allIn}))};
  const plan=planPreflop({hole:actor.holeCards,board,call,pot:livePot,stack:actor.stack,currentBet:actor.currentBet,
    minRaise:ctx.minRaise,maxRaise:ctx.maxRaise,raiseLevel:ctx.raiseLevel,smallBlind:ctx.smallBlind,persona,context});
  let decision=plan.decision;
  let decisionPath=decision ? "preflop-plan" : "trainer";
  const finish=(action:LiveAction)=>{
    const entry=supportTightParticipation(trainer,{base:actor.persona||RPG_BOT_POOL[0],hand:ctx.hand,seat:actor.seatId,
      hole:actor.holeCards,board,call,stack:actor.stack,starting:actor.stack+actor.totalBet,currentBet:actor.currentBet,
      raiseLevel:ctx.raiseLevel,minRaise:ctx.minRaise,maxRaise:ctx.maxRaise,canRaise:seats.some(s=>s.seatId!==actor.seatId&&s.inHand&&!s.folded&&!s.allIn&&s.stack>0),pot:livePot,
      opponents:seats.filter(s=>s.inHand&&!s.folded&&s.seatId!==actor.seatId).length,context},action);
    action=entry.action;if(entry.participation?.supported)decisionPath='tight-participation-support';
    const support=postflopSupport({hole:actor.holeCards,board,base:actor.persona||RPG_BOT_POOL[0],persona,
      call,pot:livePot,stack:actor.stack,currentBet:actor.currentBet,minRaise:ctx.minRaise,maxRaise:ctx.maxRaise,
      canRaise:ctx.maxRaise>actor.currentBet+call&&hasBettingOpponent(seats,actor.seatId),isOOP:context.position.isOOP,
      initiative:ctx.previousStreetAggressor===actor.seatId,checked:!!ctx.checkedThisStreet,
      opponents:context.seats.filter(s=>s.seatId!==actor.seatId&&s.inHand&&!s.folded).length},action);
    action=support.action;if(support.path)decisionPath=support.path;
    const boardDefense=action.action==='fold'?boardDefenseDecision({hole:actor.holeCards,board,seats:context.seats,
      actorId:actor.seatId,base:actor.persona||RPG_BOT_POOL[0],persona,isOOP:context.position.isOOP,raiseLevel:ctx.raiseLevel}):null;
    if(boardDefense?.accepted){
      decisionPath=boardDefense.kind==='cheap-river'?'priced-river-call':'draw-board-catch';
      action={action:boardDefense.cost>=actor.stack?'allin':'call',amount:boardDefense.cost};
    }
    // One mixed draw-board rescue per fold; do not compound river/Pro rolls past 60%.
    const riverCatch=!boardDefense && action.action==='fold' && board.length===5
      ? riverCatchDecision({hole:actor.holeCards,board,seats:context.seats,actorId:actor.seatId,
          base:actor.persona||RPG_BOT_POOL[0],persona}) : null;
    if(riverCatch?.accepted) {
      decisionPath='river-bluff-catch';
      action={action:riverCatch.cost>=actor.stack?'allin':'call',amount:riverCatch.cost};
    }
    const proCatch=!boardDefense && action.action==='fold'&&(board.length>0||ctx.raiseLevel>0)
      ?proCatchDecision({persona,hole:actor.holeCards,board,seats:context.seats,actorId:actor.seatId}):null;
    if(proCatch?.accepted){decisionPath='pro-bluff-catch';
      action={action:proCatch.cost>=actor.stack?'allin':'call',amount:proCatch.cost};}
    const pricedCall=action.action==='fold'?pricedCallGuard({hole:actor.holeCards,board,seats:context.seats,
      actorId:actor.seatId,bigBlindSeat:ctx.bigBlind,raiseLevel:ctx.raiseLevel,bigBlind:LIVE_RULES.bigBlind}):null;
    if(pricedCall?.accepted){
      decisionPath=pricedCall.kind==='committed-allin'?'priced-allin-call':'priced-bb-pair-call';
      action={action:pricedCall.cost>=actor.stack?'allin':'call',amount:pricedCall.cost};
    }
    const callModel=board.length===0&&ctx.raiseLevel>0?preflopCallModel(context):null;
    ctx.onAudit?.({participation:entry.participation,boardDefense,riverCatch,proCatch,pricedCall,decisionPath,
      callModel:callModel?{committed:callModel.committed,pending:callModel.pending,overcallProbability:callModel.overcallProbability}:null,
      threeBetRead:ctx.threeBetRead,lastRaiserSeat:ctx.lastRaiserSeat,personaId:actor.persona?.id,vpip:persona.vpip,aggression:persona.aggression,
      bluffFreq:persona.bluffFreq,isOOP:context.position.isOOP,effectiveStack:context.stack.effectiveStack,
      stackEquityPremium:context.stack.equityPremium,openedPreflop:!!ctx.openedPreflop,
      limpedPreflop:!!ctx.limpedPreflop,checkedThisStreet:!!ctx.checkedThisStreet,
      isBluff:!!action.isBluff,call,livePot,minRaise:ctx.minRaise,maxRaise:ctx.maxRaise});
    return action;
  };
  if(!decision) {
    const nn = trainer.decideActionForLive(actor.holeCards, board, call, ctx.minRaise, ctx.maxRaise,
      livePot, actor.stack, actor.currentBet, seats.filter(s => s.inHand && !s.folded).length - 1,
      actor.seatId, seats.length, ctx.raiseLevel, ctx.button, persona,
      {...context,forbidLimp:plan.forbidLimp});
    decisionPath=nn.decisionPath || "trainer";
    decision = mapLiveDecision(nn, call, actor.stack, actor.currentBet);
  }
  const highest = actor.currentBet + call;
  const limped = ctx.raiseLevel === 0 && highest <= LIVE_RULES.bigBlind;
  const smallOpen = ctx.raiseLevel === 1 && highest >= 2 * LIVE_RULES.bigBlind && highest <= 3 * LIVE_RULES.bigBlind;
  const { rawEquity } = classifyHandTier(actor.holeCards, []);
  const odds = call / Math.max(1, livePot + call);
  if (decision.action === 'fold' && plan.allowBlindDefense!==false && board.length === 0 &&
    !plan.forbidLimp &&
    actor.stack + actor.totalBet > 5000 &&
    [ctx.smallBlind, ctx.bigBlind].includes(actor.seatId) && call > 0 && call < actor.stack &&
    call <= actor.stack * 0.1 && (limped || smallOpen) && rawEquity >= odds - 0.1 && Math.random() < 0.5) {
    decisionPath="blind-defense";
    return finish({ action: 'call', amount: call });
  }
  return finish(decision);
}
