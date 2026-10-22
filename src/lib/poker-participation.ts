import type {Card} from './poker-engine';
import type {BotPersona} from './personas';
import type {LiveAction} from './poker-live';
import {estimateEquity,estimateCallEquity,afterRakeOdds,type DecisionContext} from './poker-ai';
import {connectorInfo} from './poker-preflop';
// Per-table, per-identity rolling window. No persistent growth or cross-room reads.
const tables=new WeakMap<object,Map<string,{hand:number;entered:boolean}[]>>();
export function supportTightParticipation(table:object,ctx:{base:BotPersona;hand:number;seat:number;hole:Card[];
 board:Card[];call:number;stack:number;starting:number;currentBet:number;raiseLevel:number;minRaise:number;maxRaise:number;canRaise:boolean;pot:number;opponents:number;context?:DecisionContext},action:LiveAction) {
 if(ctx.board.length||ctx.base.vpip>.30||ctx.base.aggression>.55)return {action};
 let stats=tables.get(table);if(!stats){stats=new Map();tables.set(table,stats);}
 const key=`${ctx.seat}:${ctx.base.id}`;
 let history=stats.get(key);if(!history){history=[];if(stats.size>=64)stats.delete(stats.keys().next().value!);stats.set(key,history);}
 let record=history.at(-1);if(!record||record.hand!==ctx.hand){record={hand:ctx.hand,entered:false};history.push(record);if(history.length>100)history.shift();}
 const rate=history.filter(h=>h.entered).length/history.length;
 let supported=false;
 if(action.action==='fold'&&!record.entered&&rate<.15&&ctx.call>0&&ctx.call<ctx.stack&&ctx.raiseLevel<=1) {
  const h=connectorInfo(ctx.hole);
  const playable=(h.pair&&h.low>=5)||(h.high===14&&(h.low>=10||(h.suited&&h.low>=5)))
    ||(h.high===13&&(h.low>=11||(h.suited&&h.low>=10)))||(h.suited&&h.high>=10&&h.low>=9);
  const shortStrong=(h.pair&&h.low>=7)||(h.high===14&&h.low>=12);
  if(playable&&(ctx.starting>2500||shortStrong)) {
   if(ctx.canRaise&&ctx.raiseLevel===0&&ctx.starting>=1000&&ctx.minRaise<ctx.maxRaise&&ctx.minRaise<=ctx.starting*.4) {
    action={action:'raise',amount:ctx.minRaise};supported=true;
   } else if(ctx.raiseLevel===1&&ctx.call<=ctx.starting*.15) {
    const q=ctx.context?estimateCallEquity(ctx.hole,[],ctx.context,192,'open')
      :estimateEquity(ctx.hole,[],Math.max(1,ctx.opponents),192,'open');
    if(q>afterRakeOdds(ctx.pot,ctx.call)+.02){action={action:'call',amount:ctx.call};supported=true;}
   }
  }
 }
 if(['call','raise','allin'].includes(action.action)&&action.amount>0)record.entered=true;
 return {action,participation:{target:.15,observed:history.filter(h=>h.entered).length/history.length,hands:history.length,supported}};
}
