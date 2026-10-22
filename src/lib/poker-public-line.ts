/** Per-hand public actions only. Never accept cards, names, personas or hit flags. */
export type PublicAction = {seatId:number;street:number;action:'fold'|'check'|'call'|'raise'|'allin';
  call:number;paid:number;to:number;pot:number;raises:boolean};
export type PublicLine = {actions:readonly PublicAction[];inducing:boolean};
export type PublicRangeProfile = {strong:number;medium:number;draw:number;air:number};
export class PublicLineTracker {
  private hand=-1;
  private actions:PublicAction[]=[];
  private plans=new Map<string,boolean>();
  begin(hand:number) {
    if(hand===this.hand)return;
    this.hand=hand;this.actions=[];this.plans.clear();
  }
  observe(hand:number,row:PublicAction) {
    this.begin(hand);
    // Explicit whitelist: callers may carry private fields on their own objects.
    this.actions.push({seatId:row.seatId,street:row.street,action:row.action,call:row.call,
      paid:row.paid,to:row.to,pot:row.pot,raises:row.raises});
    if(this.actions.length>1024)this.actions.shift();
    const key=`${row.street}:${row.seatId}`;
    if(this.plans.has(key)) {
      if(row.action==='check')this.plans.set(key,true);
      else this.plans.delete(key);
    }
  }
  armInduce(hand:number,street:number,seatId:number) {
    this.begin(hand);this.plans.set(`${street}:${seatId}`,false);
  }
  read(hand:number,street:number,seatId:number):PublicLine {
    this.begin(hand);
    return {actions:this.actions.map(a=>({...a})),inducing:this.plans.get(`${street}:${seatId}`)===true};
  }
}
export function checkedThrough(line:PublicLine,street:number) {
  const rows=line.actions.filter(a=>a.street===street);
  return rows.length>=2&&rows.every(a=>a.action==='check');
}
/** Soft likelihoods, not proof of a capped range. Traps always retain mass. */
export function publicRangeProfile(line:PublicLine,seatId:number,street:number):PublicRangeProfile {
  const rows=line.actions.filter(a=>a.seatId===seatId&&a.street>0&&a.street<=street);
  let strong=1,medium=1,draw=1,air=1;
  for(const row of rows.slice(-8)) {
    if(row.action==='check'){strong*=.92;air*=1.04;}
    else if(row.raises){
      const size=row.paid/Math.max(1,row.pot);
      strong*=1.12;medium*=size>.65?.92:1.02;air*=.88;draw*=row.street<5?1.08:.95;
    } else if(row.action==='call'){strong*=.99;medium*=1.06;air*=.88;draw*=row.street<5?1.05:.95;}
  }
  const clamp=(n:number)=>Math.max(.45,Math.min(1.65,n));
  return {strong:clamp(strong),medium:clamp(medium),draw:clamp(draw),air:clamp(air)};
}
