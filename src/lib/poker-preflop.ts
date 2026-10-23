import type { ActionType, Card } from './poker-engine';
import { afterRakeOdds, estimateCallEquity, type DecisionContext } from './poker-ai';
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

/** Explicit priced-call floor; full call price, not a tiny stack-capped cost. */
export function smallOpenDefenseHand(hole:Card[]) {
 if(hole.length!==2)return false;
 const h=connectorInfo(hole);
 return h.pair||(h.suited&&h.high===14)
  ||(h.suited&&((h.high===13&&h.low>=9)||(h.high===12&&h.low>=9)||(h.high===11&&h.low>=9)))
  ||(h.suited&&h.gap===0&&h.low>=4)
  ||(!h.suited&&((h.high===14&&h.low>=10)||(h.high===13&&h.low>=11)||(h.high===12&&h.low===11)));
}

export function limpFrequency(aggression:number) { return Math.max(0.07,0.14*(1-0.35*aggression)); }

export function flatCallFrequency(persona:{vpip:number;aggression:number}, isOOP:boolean, premium=false) {
  const rate=0.30+(persona.vpip-0.35)*0.60-(persona.aggression-0.55)*0.45+(isOOP?-0.08:0.10);
  return Math.max(0.03,Math.min(0.75,rate))*(premium?0.20:1);
}

// Physical preflop seats stay stable after folds; postflop isOOP alone does
// not identify UTG. The button and blinds are never labelled UTG..UTG+2.
export function preflopPosition(seatIds:number[],actor:number,button:number,bigBlind:number,raiser?:number) {
  const ring=Math.max(...seatIds)+1;
  const after=(seat:number,anchor:number)=>(seat-anchor-1+ring)%ring;
  const order=[...seatIds].sort((a,b)=>after(a,bigBlind)-after(b,bigBlind));
  const smallBlind=[...seatIds].sort((a,b)=>after(a,button)-after(b,button))[0];
  const early=order.filter(id=>id!==button&&id!==smallBlind&&id!==bigBlind).slice(0,3).includes(actor);
  const physical=[...seatIds].sort((a,b)=>a-b),btn=physical.indexOf(button);
  const cutoff=physical[(btn-1+physical.length)%physical.length];
  const late=actor===button||actor===smallBlind||(physical.length>=4&&actor===cutoff);
  return {early,late,inPositionVsRaiser:raiser!==undefined&&raiser!==actor&&after(actor,button)>after(raiser,button)};
}

interface PreflopSpot {
  hole:Card[];board:Card[];call:number;pot:number;stack:number;currentBet:number;
  minRaise:number;maxRaise:number;raiseLevel:number;smallBlind:number;
  persona:{vpip:number;aggression:number;bluffFreq:number};context:DecisionContext;
}
type Decision={action:ActionType;amount:number;isBluff?:boolean};

// One entry gate per decision. In particular, rejected low connectors must not
// fall through to bluff/automatic blind-defense branches and inflate the 7% mix.
export function planPreflop(spot:PreflopSpot):{decision:Decision|null;forbidLimp:boolean;allowBlindDefense?:boolean} {
  if(spot.board.length)return {decision:null,forbidLimp:false};
  const {hole,call,stack,currentBet,raiseLevel,persona,context}=spot;
  const h=connectorInfo(hole), highest=currentBet+call;
  const own=context.stack?.ownStack??stack;
  const opponents=context.seats.filter(s=>s.seatId!==context.actorId&&s.inHand&&!s.folded);
  const affordable=own>2500&&call>0&&call<stack&&call<=own*0.15;
  const unopened=raiseLevel===0&&highest<=200;
  const result=(decision:Decision|null,allowBlindDefense=true)=>({decision,forbidLimp:unopened&&call>0,allowBlindDefense});
  const foldOrCheck=():Decision=>({action:call>0?'fold':'check',amount:0});
  const callDecision=():Decision=>({action:call>=stack?'allin':'call',amount:Math.min(call,stack)});
  const equity=()=>estimateCallEquity(hole,[],context,192,raiseLevel>=2?'three-bet':'open');
  const odds=afterRakeOdds(spot.pot,call);

  // Sizing policy precedes the trainer/reshove branches in BOTH game modes.
  // At <=5BB keep the emergency EV policy; never turn an all-in call into a raise.
  const premium=h.pair&&h.low>=11;
  const canRaise=hasBettingOpponent(context.seats,context.actorId);
  const sizedRaise=(target:number,commitment:number):Decision|null=>{
    target=Math.max(spot.minRaise,Math.round(target/10)*10);
    return canRaise&&target<spot.maxRaise&&target-currentBet<=stack*commitment
      ? {action:'raise',amount:target,isBluff:false} : null;
  };
  if(premium&&own>1000&&call<stack) {
    if(unopened) {
      const opening=sizedRaise(500+Math.floor(Math.random()*7)*10,.85);
      if(opening)return result(opening);
    } else if(raiseLevel>=1&&!opponents.some(s=>s.allIn)) {
      // 3-bet / 4-bet at ordinary depth, flat when another raise would commit
      // most of the remaining stack. Do not create an automatic 5-bet war.
      const reraising=raiseLevel<=2
        ? sizedRaise(highest*(raiseLevel===1?(context.preflopPosition?.inPositionVsRaiser?3:3.5):2.2),.65) : null;
      return result(reraising??callDecision());
    }
  }
  const trulyUnopened=unopened&&opponents.filter(s=>s.currentBet>=200).length<=1;
  if(trulyUnopened&&own>1000&&call<stack) {
    const late=context.preflopPosition?.late??(context.actorId===spot.smallBlind||(context.position?.relativePosition??0)>=.8);
    const core=(h.pair&&h.low>=6)||(h.high===14&&h.low>=11)||(h.suited&&h.high>=11&&h.low>=10);
    const lateRange=h.pair||h.high===14||(h.suited&&((h.high>=12&&h.low>=9)||(h.gap===0&&h.low>=4)))
      ||(persona.vpip>=.38&&h.suited&&h.high>=11&&h.low>=5)
      ||(persona.vpip>=.42&&h.high>=11&&h.low>=10);
    const frequency=core?1:Math.min(.95,.55+persona.vpip*.65);
    if(core||(late&&lateRange&&Math.random()<frequency)) {
      const opening=sizedRaise(500+Math.floor(Math.random()*7)*10,.65);
      if(opening)return result(opening);
    }
  }
  const broadway=!h.pair&&(h.low>=11||(h.high===11&&h.low===10)); // two face ranks or JT, suited OR offsuit
  const suited87=h.suited&&h.high===8&&h.low===7&&persona.aggression>=.70;
  const position=context.preflopPosition;
  if(raiseLevel===1&&call>0&&call<stack&&(broadway||suited87)&&position
    &&!opponents.some(s=>s.allIn)&&(position.early||position.inPositionVsRaiser)) {
    // No forced calls at an arbitrary price. Short/deep stack risk and rake
    // still matter, but qualified early-position continues can ONLY flat.
    const priceOK=call<=own*.25&&equity()>=odds+(position.early?.015:0);
    if(!priceOK)return result(foldOrCheck(),false);
    if(!position.early&&canRaise) {
      const frequency=suited87?.08:.18+persona.aggression*.30;
      if(Math.random()<frequency) {
        const raised=sizedRaise(highest*3,.45);
        if(raised)return result({...raised,isBluff:suited87});
      }
    }
    return result(callDecision(),false);
  }

  if(h.rareLow) {
    const eligible=persona.aggression>=0.70&&persona.vpip>=0.35&&own>=5000
      &&(context.stack?.effectiveStack??own)>=4000&&affordable&&raiseLevel===1
      &&highest<=800&&currentBet<=200&&opponents.length<=3&&!opponents.some(s=>s.allIn);
    return result(eligible&&equity()+0.08>=odds&&Math.random()<0.07 ? callDecision() : foldOrCheck(),false);
  }
  // The original short-stack opener gets a dedicated priced call/reshove EV
  // decision. Do not kill its opened connector through the cold-entry gate.
  const defendingOpen=context.openedPreflop===true&&raiseLevel===2;
  if(defendingOpen)return result(null);

  if(context.limpedPreflop&&call>0&&raiseLevel>0&&!(persona.bluffFreq>=0.20&&persona.aggression>=0.55)) {
    return result(affordable&&equity()>=odds-0.03 ? callDecision() : foldOrCheck(),false);
  }

  const connector=h.connector;
  const allowed=connectorAllowed(hole,persona);
  if(unopened&&call>0) {
    const late=(context.position?.relativePosition??0)>=0.40||context.actorId===spot.smallBlind;
    const limpable=(h.pair&&h.low<=9)||(allowed&&h.suited)||(h.suited&&h.high===14&&h.low<=11);
    if(own>2500&&late&&limpable&&call<stack&&Math.random()<limpFrequency(persona.aggression))return result(callDecision());
    if(connector) {
      if(allowed&&own>=4000&&hasBettingOpponent(context.seats,context.actorId)&&Math.random()<0.25+persona.vpip*0.35) {
        const target=Math.min(spot.maxRaise,Math.max(spot.minRaise,600));
        if(target>highest&&target<spot.maxRaise)return result({action:'raise',amount:target,isBluff:true});
      }
      return result(foldOrCheck(),false);
    }
    return result(null);
  }

  if(connector) {
    if(!call)return result({action:'check',amount:0});
    const open=raiseLevel===1||(raiseLevel===2&&currentBet>=400);
    if(!allowed||!affordable||(highest>800&&!defendingOpen)||!open||opponents.some(s=>s.allIn))return result(foldOrCheck(),false);
    const threshold=odds+(context.position?.isOOP?0.015:0)-persona.vpip*0.08;
    if(equity()<threshold)return result(foldOrCheck(),false);
    const rate=flatCallFrequency(persona,context.position?.isOOP??true);
    return result(Math.random()<Math.max(0.20,rate)?callDecision():foldOrCheck());
  }

  const open=raiseLevel===1||(raiseLevel===2&&currentBet>=400);
  // Normal-stack flats also exist against a 2BB open. The short-stack branch
  // remains responsible for priced small-stack calls and reshoves.
  if(own>5000&&affordable&&open&&((highest>=400&&highest<=800)||defendingOpen)) {
    const flatHand=h.pair||(h.high===14&&h.low>=10)||(h.suited&&h.high===14&&h.low>=5)
      ||(h.high>=12&&h.low>=10)||(h.suited&&h.high>=10&&h.low>=9);
    const premium=(h.pair&&h.low>=11)||(h.high===14&&h.low===13);
    const required=odds+Math.max(0,(0.35-persona.vpip)*0.10);
    if(flatHand&&equity()>=required&&Math.random()<flatCallFrequency(persona,context.position?.isOOP??true,premium))return result(callDecision());
  }
  return result(null);
}
