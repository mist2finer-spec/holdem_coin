/** Tournament-only lifecycle. Cash ledger, refills and rake do not apply. */
export class TournamentLifecycle {
 readonly buyIn=20000;
 readonly levelMs=300000;
 readonly countdownMs=10000;
 readonly cooldownMs=600000;
 startsAt:number|null=null;
 finishedAt:number|null=null;
 startedAt:number|null=null;
 level=0;
 eliminated=new Set<number>();
 bannedNames=new Set<string>();
 winner:{seatId:number;name:string;portrait:number}|null=null;
 get finished(){return this.winner!==null;}
 get smallBlind(){return 100*2**this.level;}
 get bigBlind(){return 200*2**this.level;}
 key(name:string){return name.normalize('NFKC').trim().toLocaleLowerCase();}
 requestStart(now:number){if(this.startsAt===null&&this.startedAt===null)this.startsAt=now+this.countdownMs;}
 cancelStart(){if(this.startedAt===null)this.startsAt=null;}
 get nextTournamentAt(){return this.finishedAt===null?null:this.finishedAt+this.cooldownMs;}
 readyForNext(now:number){return this.nextTournamentAt!==null&&now>=this.nextTournamentAt;}
 start(now:number){if(this.startedAt===null){this.startedAt=now;this.startsAt=null;}}
 /** Freeze this pair of blinds for the whole hand. */
 beginHand(now:number){this.start(now);this.level=Math.min(30,Math.max(this.level,Math.floor((now-this.startedAt!)/this.levelMs)));}
 settle(seats:{seatId:number;name:string;stack:number;persona?:{portrait?:number}}[]){
  for(const s of seats)if(s.stack===0&&!this.eliminated.has(s.seatId)){this.eliminated.add(s.seatId);this.bannedNames.add(this.key(s.name));}
  const alive=seats.filter(s=>!this.eliminated.has(s.seatId)&&s.stack>0);
  if(alive.length===1&&!this.winner){this.winner={seatId:alive[0].seatId,name:alive[0].name,portrait:alive[0].persona?.portrait??4};this.finishedAt=Date.now();}
 }
 snapshot(){return {status:this.finished?'finished':this.startedAt===null?(this.startsAt===null?'waiting':'countdown'):'running',startsAt:this.startsAt,startedAt:this.startedAt,finishedAt:this.finishedAt,nextTournamentAt:this.nextTournamentAt,level:this.level+1,smallBlind:this.smallBlind,bigBlind:this.bigBlind,
  nextLevelAt:this.startedAt===null?null:this.startedAt+(this.level+1)*this.levelMs,remaining:8-this.eliminated.size,winner:this.winner?{...this.winner}:null};}
}
