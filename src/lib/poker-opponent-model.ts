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
