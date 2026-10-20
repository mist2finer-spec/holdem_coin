import type { ActionType, Card } from './poker-engine';
import { afterRakeOdds, estimateEquity, type DecisionContext } from './poker-ai';
import { hasBettingOpponent } from './poker-rules';

export function connectorInfo(hole: Card[]) {
  const [high,low]=hole.map(c=>'23456789TJQKA'.indexOf(c.rank)+2).sort((a,b)=>b-a);
  const suited=hole[0].suit===hole[1].suit;
  const pair=high===low, gap=high-low-1;
  const connector=!pair&&(gap===0||gap===1)&&high<=10;
  return {high,low,suited,pair,gap,connector,rareLow:connector&&low<=3,seven:high===7||low===7};
}

export function connectorAllowed(hole: Card[], persona: {vpip:number;aggression:number}) {
  const h=connectorInfo(hole);
  if(!h.connector||h.rareLow)return false;
  if(h.suited)return h.low>=5 && (h.gap===0 ? persona.vpip>=0.30 : persona.vpip>=0.35&&persona.aggression>=0.50);
  return h.seven && (h.gap===0 ? persona.vpip>=0.42&&persona.aggression>=0.58 : persona.vpip>=0.48&&persona.aggression>=0.65);
}

export function limpFrequency(aggression:number) { return Math.max(0.04,0.12*(1-0.5*aggression)); }

export function flatCallFrequency(persona:{vpip:number;aggression:number}, isOOP:boolean, premium=false) {
  const rate=0.30+(persona.vpip-0.35)*0.60-(persona.aggression-0.55)*0.45+(isOOP?-0.08:0.10);
  return Math.max(0.03,Math.min(0.75,rate))*(premium?0.20:1);
}

interface PreflopSpot {
  hole:Card[];board:Card[];call:number;pot:number;stack:number;currentBet:number;
  minRaise:number;maxRaise:number;raiseLevel:number;smallBlind:number;
  persona:{vpip:number;aggression:number;bluffFreq:number};context:DecisionContext;
}
type Decision={action:ActionType;amount:number;isBluff?:boolean};

// One entry gate per decision. In particular, rejected low connectors must not
// fall through to bluff/automatic blind-defense branches and inflate the 7% mix.
export function planPreflop(spot:PreflopSpot):{decision:Decision|null;forbidLimp:boolean} {
  if(spot.board.length)return {decision:null,forbidLimp:false};
  const {hole,call,stack,currentBet,raiseLevel,persona,context}=spot;
  const h=connectorInfo(hole), highest=currentBet+call;
  const own=context.stack?.ownStack??stack;
  const opponents=context.seats.filter(s=>s.seatId!==context.actorId&&s.inHand&&!s.folded);
  const affordable=own>2500&&call>0&&call<stack&&call<=own*0.15;
  const unopened=raiseLevel===0&&highest<=200;
  const result=(decision:Decision|null)=>({decision,forbidLimp:unopened&&call>0});
  const foldOrCheck=():Decision=>({action:call>0?'fold':'check',amount:0});
  const callDecision=():Decision=>({action:call>=stack?'allin':'call',amount:Math.min(call,stack)});
  const equity=()=>estimateEquity(hole,[],Math.max(1,opponents.length),192,raiseLevel>=2?'three-bet':'open');
  const odds=afterRakeOdds(spot.pot,call);

  if(h.rareLow) {
    const eligible=persona.aggression>=0.70&&persona.vpip>=0.35&&own>=5000
      &&(context.stack?.effectiveStack??own)>=4000&&affordable&&raiseLevel===1
      &&highest<=800&&currentBet<=200&&opponents.length<=3&&!opponents.some(s=>s.allIn);
    return result(eligible&&equity()+0.08>=odds&&Math.random()<0.07 ? callDecision() : foldOrCheck());
  }
  // The original short-stack opener gets a dedicated priced call/reshove EV
  // decision. Do not kill its opened connector through the cold-entry gate.
  const defendingOpen=context.openedPreflop===true&&raiseLevel===2;
  if(defendingOpen&&own<=5000)return result(null);

  if(context.limpedPreflop&&call>0&&raiseLevel>0&&!(persona.bluffFreq>=0.20&&persona.aggression>=0.55)) {
    return result(affordable&&equity()>=odds-0.03 ? callDecision() : foldOrCheck());
  }

  const connector=h.connector;
  const allowed=connectorAllowed(hole,persona);
  if(unopened&&call>0) {
    const late=(context.position?.relativePosition??0)>=0.65||context.actorId===spot.smallBlind;
    const limpable=(h.pair&&h.low<=7)||(allowed&&h.suited);
    if(own>2500&&late&&limpable&&call<stack&&Math.random()<limpFrequency(persona.aggression))return result(callDecision());
    if(connector) {
      if(allowed&&own>=4000&&hasBettingOpponent(context.seats,context.actorId)&&Math.random()<0.25+persona.vpip*0.35) {
        const target=Math.min(spot.maxRaise,Math.max(spot.minRaise,600));
        if(target>highest&&target<spot.maxRaise)return result({action:'raise',amount:target,isBluff:true});
      }
      return result(foldOrCheck());
    }
    return result(null);
  }

  if(connector) {
    if(!call)return result({action:'check',amount:0});
    const open=raiseLevel===1||(raiseLevel===2&&currentBet>=400);
    if(!allowed||!affordable||(highest>800&&!defendingOpen)||!open||opponents.some(s=>s.allIn))return result(foldOrCheck());
    const threshold=odds+(context.position?.isOOP?0.015:0)-persona.vpip*0.08;
    if(equity()<threshold)return result(foldOrCheck());
    const rate=flatCallFrequency(persona,context.position?.isOOP??true);
    return result(Math.random()<Math.max(0.20,rate)?callDecision():foldOrCheck());
  }

  const open=raiseLevel===1||(raiseLevel===2&&currentBet>=400);
  if(affordable&&open&&((highest>=600&&highest<=800)||defendingOpen)) {
    const premium=(h.pair&&h.low>=11)||(h.high===14&&h.low===13);
    const required=odds+Math.max(0,(0.35-persona.vpip)*0.10);
    if(equity()>=required&&Math.random()<flatCallFrequency(persona,context.position?.isOOP??true,premium))return result(callDecision());
  }
  return result(null);
}
