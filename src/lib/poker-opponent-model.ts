import type {DecisionContext} from './poker-ai';

// Public action frequencies only. Never ingest hole cards or CPU persona data.
export interface ThreeBetRead {opportunities:number;threeBets:number;rate:number;looseness:number}
export class OpponentModel {
  private rows=new Map<string,{hand:number;threeBet:boolean}[]>();
  observe(key:string,hand:number,raiseLevel:number,call:number,raised:boolean) {
    if(raiseLevel!==1||call<=0)return;
    const rows=this.rows.get(key)||[];
    const old=rows.find(r=>r.hand===hand);
    if(old)old.threeBet ||= raised;else rows.push({hand,threeBet:raised});
    this.rows.delete(key);this.rows.set(key,rows.slice(-40));
    if(this.rows.size>128)this.rows.delete(this.rows.keys().next().value!);
  }
  read(key:string):ThreeBetRead {
    const rows=this.rows.get(key)||[],opportunities=rows.length,threeBets=rows.filter(r=>r.threeBet).length;
    const rate=(threeBets+1.5)/(opportunities+12);
    const looseness=opportunities<6?0:Math.max(0,Math.min(1,(rate-0.12)/0.25))*Math.min(1,opportunities/12);
    return {opportunities,threeBets,rate,looseness};
  }
}


/** Public betting information only. An unacted seat is not yet a cold caller. */
export function preflopCallModel(context:DecisionContext) {
  const actor=context.seats.find(s=>s.seatId===context.actorId);
  const opponents=context.seats.filter(s=>s.seatId!==context.actorId&&s.inHand&&!s.folded);
  const highest=Math.max(0,...opponents.map(s=>s.currentBet),actor?.currentBet??0);
  const unchanged={scenarios:[{weight:1,context}],committed:opponents.length,pending:0,overcallProbability:0};
  if(!actor||context.boardLength!==0||highest<=200)return unchanged;
  const committed=opponents.filter(s=>s.allIn||s.currentBet>=highest||s.seatId===context.lastRaiserSeat);
  if(!committed.length)return unchanged;
  const pending=opponents.filter(s=>!committed.includes(s));
  if(!pending.length)return {...unchanged,committed:committed.length};
  // A two-scenario approximation: the existing field, or one additional caller.
  // The invested/deeper seat is the conservative representative of that caller.
  const extra=[...pending].sort((a,b)=>b.currentBet-a.currentBet||b.stack-a.stack)[0];
  const probability=Math.min(.35,.12+pending.length*.04);
  const scenario=(includeExtra:boolean)=>{
    const ids=new Set(committed.map(s=>s.seatId));if(includeExtra)ids.add(extra.seatId);
    return {...context,seats:context.seats.map(s=>s.seatId===actor.seatId||!s.inHand||s.folded||ids.has(s.seatId)
      ? {...s}: {...s,inHand:false,folded:true})};
  };
  // Contributions are NEVER erased: speculative folds still leave dead chips.
  return {scenarios:[{weight:1-probability,context:scenario(false)},{weight:probability,context:scenario(true)}],
    committed:committed.length,pending:pending.length,overcallProbability:probability};
}
