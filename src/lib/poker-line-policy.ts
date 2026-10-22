import {classifyHandTier,HandTier} from './equity-engine';
import {evaluateBestHand,type Card} from './poker-engine';
import {calledActionEV,estimateCallEquity,modeledCallEV,publicLineEquity,uncontestedActionEV,type DecisionContext} from './poker-ai';
import {checkedThrough} from './poker-public-line';
import type {BotPersona} from './personas';
import type {LiveAction} from './poker-live';

export type LineSpot={hole:Card[];board:Card[];persona:BotPersona;context:DecisionContext;
  call:number;pot:number;stack:number;currentBet:number;minRaise:number;maxRaise:number;raiseLevel:number;canRaise:boolean};
export type LineCandidate={action:LiveAction;path:string;weight:number;equity:number;ev:number;induce?:boolean};

function blocker(hole:Card[],board:Card[]) {
  // Actual nut-flush blocker, not an opponent's unseen cards or hit status.
  return hole.some(c=>c.rank==='A'&&board.filter(b=>b.suit===c.suit).length>=3);
}
function missedDraw(hole:Card[],board:Card[]) {
  if(board.length!==5||classifyHandTier(hole,board).tier>=HandTier.WEAK_PAIR)return false;
  return classifyHandTier(hole,board.slice(0,4)).tier===HandTier.DRAW;
}
/** Add a few priced, persona-weighted alternatives to the existing decision.
 * No ICM, payouts or tournament assumptions. No forced replacement of +EV calls.
 */
export function lineCandidates(s:LineSpot,base:LiveAction):LineCandidate[] {
  const {context:c,board,hole,persona:p}=s,line=c.publicLine;
  if(!line?.actions.length||s.stack<=0)return [];
  const opponents=c.seats.filter(x=>x.seatId!==c.actorId&&x.inHand&&!x.folded);
  const actor=c.seats.find(x=>x.seatId===c.actorId);
  if(!actor||!opponents.length||opponents.some(x=>x.allIn))return [];
  const result:LineCandidate[]=[];
  const margin=Math.max(1,s.pot*.02);
  const addBet=(fraction:number,path:string,weight:number,equity:number,foldProbability=0)=>{
    const to=Math.floor(s.currentBet+s.pot*fraction),cost=to-s.currentBet;
    // Literal sizing, legal full raise, no coerced shove / uncallable side bet.
    if(!s.canRaise||to<s.minRaise||to>=s.maxRaise||cost<=0||cost>s.stack*.35)return;
    const called=calledActionEV(hole,board,c,cost,0,undefined,96);
    const ev=foldProbability*uncontestedActionEV(c,cost,0)+(1-foldProbability)*called;
    if(ev>margin)result.push({action:{action:'raise',amount:to,isBluff:classifyHandTier(hole,board).tier<HandTier.WEAK_PAIR},path,weight,equity,ev});
  };
  if(board.length===0) {
    // A squeeze is not a cold shove. Keep <=25BB stacks with their old policy.
    if(s.raiseLevel!==1||c.openedPreflop||!s.canRaise||s.currentBet>200
      ||(c.stack?.effectiveStack??0)<6000||(c.stack?.ownStack??0)<6000
      ||!['call','raise'].includes(base.action))return [];
    const rows=line.actions.filter(a=>a.street===0),open=rows.find(a=>a.raises);
    const callers=rows.filter(a=>a.action==='call'&&open&&a.to===open.to&&a.seatId!==open.seatId);
    if(!open||open.to<400||open.to>800||!callers.length||rows.filter(a=>a.raises).length!==1)return [];
    const ranks=hole.map(x=>'23456789TJQKA'.indexOf(x.rank)).sort((a,b)=>b-a);
    const [high,low]=ranks,suited=hole[0].suit===hole[1].suit;
    // Retain the existing early-position broadway flat-only preference.
    if(c.preflopPosition?.early&&high!==low)return [];
    const value=high===low&&low>=6||high===12&&low>=10||suited&&high===11&&low===10;
    const light=p.aggression>=.7&&suited&&(high===12||high-low===1&&low>=5);
    if(!value&&!light)return [];
    const to=Math.floor(open.to*(c.preflopPosition?.inPositionVsRaiser?3.5:4)+callers.length*200);
    const cost=to-s.currentBet;
    if(to<s.minRaise||to>=s.maxRaise||cost>Math.min(s.stack,c.stack!.effectiveStack)*.20)return [];
    const called=modeledCallEV(hole,board,c,cost,0,'jam-call',192);
    const foldProbability=Math.pow(.35,opponents.length);
    const ev=foldProbability*uncontestedActionEV(c,cost,0)+(1-foldProbability)*called;
    if(ev>margin)result.push({action:{action:'raise',amount:to,isBluff:!value},path:'line-squeeze',
      weight:value?.08+p.aggression*.12:.03+p.bluffFreq*.08,
      equity:estimateCallEquity(hole,board,c,192,'open'),ev});
    return result;
  }
  // Public-line tactical mixes are heads-up. Multiway / side-pot decisions keep
  // the existing layer-aware EV policy; do not multiply independent bluff rolls.
  if(opponents.length!==1||board.length<3||board.length>5)return [];
  const tier=classifyHandTier(hole,board).tier;
  const boardOnly=board.length===5&&evaluateBestHand(hole,board)===evaluateBestHand(board.slice(0,2),board.slice(2));
  if(boardOnly)return [];
  const equity=publicLineEquity(hole,board,c,192);
  if(s.call>0) {
    const cost=Math.min(s.call,s.stack),callEV=calledActionEV(hole,board,c,cost,0,undefined,192);
    // A prior induce plan is contingent on price/equity, never a promised blind call.
    if(line.inducing&&base.action==='fold'&&tier>=HandTier.TWO_PAIR_PLUS&&equity>=.62
      &&cost<=s.pot*.75&&callEV>margin)
      result.push({action:{action:cost===s.stack?'allin':'call',amount:cost},path:'line-induce-call',
        weight:1,equity,ev:callEV});
    if(c.position?.checkedThisStreet&&s.canRaise&&s.raiseLevel<=1&&s.call<=s.pot*.35
      &&(tier>=HandTier.TWO_PAIR_PLUS&&equity>=.65||board.length<5&&tier===HandTier.DRAW&&equity>=.28)) {
      const target=Math.max(s.minRaise,Math.ceil((s.currentBet+s.call)*2.5));
      const fraction=(target-s.currentBet)/Math.max(1,s.pot);
      addBet(fraction,'line-check-raise',.04+p.aggression*.14,equity,equity<.5?.20+p.bluffFreq*.2:0);
    }
    return result;
  }
  if(c.position?.checkedThisStreet)return [];
  // Preserve existing aggressive actions; new free-bet candidates diversify checks.
  const free=base.action==='check'||base.action==='fold';
  if(tier>=HandTier.TWO_PAIR_PLUS&&equity>=.68&&s.canRaise
    &&!line.actions.some(a=>a.street===board.length&&a.raises))
    result.push({action:{action:'check',amount:0},path:'line-induce-check',weight:.05+p.bluffFreq*.20,
      equity,ev:0,induce:true});
  if(!free)return result;
  // Small thin value: uncertain range advantage, not automatic nuts betting.
  if(board.length===5&&checkedThrough(line,4)&&tier>=HandTier.WEAK_PAIR&&equity>=.56&&s.pot>=2000)
    addBet(200/s.pot,'line-river-thin-value',.08+p.vpip*.18,equity);
  const semibluff=tier===HandTier.DRAW||blocker(hole,board)||missedDraw(hole,board);
  if(board.length===5&&checkedThrough(line,4)&&semibluff&&equity>=.18&&equity<.56)
    addBet(.5,'line-river-probe',.03+p.bluffFreq*.25,equity,.20+p.aggression*.15);
  if(board.length===4&&checkedThrough(line,3)&&semibluff&&equity>=.25&&equity<.6)
    addBet(1/3,'line-delayed-barrel',.03+p.aggression*.10,equity,.16+p.bluffFreq*.25);
  return result;
}

export function selectLineDecision(s:LineSpot,base:LiveAction,random=Math.random) {
  const candidates=lineCandidates(s,base);
  const induce=candidates.find(x=>x.path==='line-induce-call');
  if(induce)return induce; // one committed plan; does not stack with fold-rescue rolls
  const total=candidates.reduce((n,x)=>n+x.weight,0),scale=total>.35?.35/total:1;
  let roll=random();
  for(const x of candidates){roll-=x.weight*scale;if(roll<0)return x;}
  return null;
}
