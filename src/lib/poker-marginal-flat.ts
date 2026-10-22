import type {Card} from './poker-engine';
import type {BotPersona} from './personas';
import {modeledCallEV,type DecisionContext,type OpponentRange} from './poker-ai';
import {contributionLayers} from './poker-rules';

type Traits=Pick<BotPersona,'vpip'|'aggression'>;
const clamp=(v:number,low=0,high=1)=>Math.max(low,Math.min(high,v));
/** Conditional probability on otherwise-folded eligible spots, not overall VPIP. */
export function marginalFlatFrequency(base:Traits,persona:Traits,isOOP:boolean,looseness=0) {
  const vpip=base.vpip*.7+persona.vpip*.3,aggression=base.aggression*.7+persona.aggression*.3;
  return clamp(.05+.06*clamp((vpip-.2)/.45)+.02*clamp((aggression-.2)/.65)
    +(isOOP?0:.01)+.01*clamp(looseness),.05,.15);
}

/** One final, call-only fold rescue. No opponent private cards or premium flags. */
export function marginalThreeBetFlat(s:{hole:Card[];board:Card[];base:Traits;persona:Traits;
  context:DecisionContext;raiseLevel:number},random=Math.random) {
  const c={...s.context,seats:s.context.seats.map(({seatId,stack,currentBet,totalBet,inHand,folded,allIn})=>
    ({seatId,stack,currentBet,totalBet,inHand,folded,allIn}))};
  if(s.board.length||s.raiseLevel!==2||!c.openedPreflop||s.hole.length!==2)return null;
  const actor=c.seats.find(x=>x.seatId===c.actorId);
  const opponents=c.seats.filter(x=>x.seatId!==c.actorId&&x.inHand&&!x.folded);
  // No cold calls, opponent shoves, dry side pots or speculative multiway calls.
  if(!actor||!actor.inHand||actor.folded||actor.allIn||opponents.length!==1)return null;
  const opponent=opponents[0];
  if(opponent.allIn||opponent.stack<=0||opponent.seatId!==c.lastRaiserSeat)return null;
  const call=opponent.currentBet-actor.currentBet,highest=opponent.currentBet;
  const own=actor.stack+actor.totalBet,effective=Math.min(own,opponent.stack+opponent.totalBet);
  if(own<=2500||effective<3000||actor.currentBet<400||call<=0||call>=actor.stack
    ||highest>1600||highest>actor.currentBet*3||call>600||call>effective*.15
    ||call>actor.stack*.20)return null;
  const ranks=s.hole.map(x=>'23456789TJQKA'.indexOf(x.rank)).sort((a,b)=>b-a);
  const [high,low]=ranks,suited=s.hole[0].suit===s.hole[1].suit,isOOP=c.position?.isOOP!==false;
  const hand=high===low&&low>=3&&low<=8 // 55–TT, not arbitrary small pairs
    ||suited&&(high===12&&low>=3&&low<=10||high>=9&&high<=11&&low>=8)
    ||!isOOP&&s.persona.vpip>=.4&&high!==low&&high>=11&&low>=9&&low<=10;
  if(!hand)return null;
  // Existing contributions only. Uncalled excess / inaccessible side pots
  // cannot subsidize this call. Future streets are modeled with a risk haircut.
  const projected=c.seats.map(x=>({...x,totalBet:x.totalBet+(x.seatId===actor.seatId?call:0)}));
  const eligiblePot=contributionLayers(projected).filter(p=>p.refundSeatId===undefined&&p.eligibleSeatIds.includes(actor.seatId))
    .reduce((n,p)=>n+p.amount,0);
  const odds=call/Math.max(1,eligiblePot);
  if(odds>(isOOP?.24:.28)||isOOP&&call>500)return null;
  const read=c.threeBetRead;
  const looseness=read&&read.opportunities>=6?clamp(read.looseness):0;
  const ranges:Record<number,OpponentRange>={[opponent.seatId]:'three-bet'};
  const tightEV=modeledCallEV(s.hole,[],c,call,0,'three-bet',384,ranges);
  const wideEV=looseness?modeledCallEV(s.hole,[],c,call,0,'three-bet',384,
    {[opponent.seatId]:'wide-three-bet'}):tightEV;
  const grossEV=tightEV*(1-looseness)+wideEV*looseness;
  const equity=(grossEV+call)/Math.max(1,eligiblePot);
  const realization=isOOP?.86:.94;
  const ev=(grossEV+call)*realization-call;
  // A small entertainment budget for borderline EV only, never a large losing
  // call: at most 10% of the call and 2% of the eligible pre-call pot.
  const lossBudget=Math.min(call*.10,Math.max(0,eligiblePot-call)*.02);
  const eligible=equity>=odds+.02&&ev>=-lossBudget;
  const frequency=marginalFlatFrequency(s.base,s.persona,isOOP,looseness);
  return {cost:call,equity,odds,eligiblePot,realization,ev,lossBudget,frequency,eligible,
    accepted:eligible&&random()<frequency};
}
