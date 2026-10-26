export interface TournamentStatus {
 status:'waiting'|'countdown'|'running'|'finished';level:number;smallBlind:number;bigBlind:number;
 startsAt:number|null;startedAt:number|null;finishedAt:number|null;nextTournamentAt:number|null;
 nextLevelAt:number|null;remaining:number;winner:{seatId:number;name:string;portrait:number}|null;
}
/** Display only: authoritative actions and histories always retain integer chips. */
export function tournamentMoney(chips:number,bigBlind:number){return `${Math.round((chips/bigBlind+Number.EPSILON)*10)/10} BB`;}
export function tournamentTime(seconds:number){const n=Math.max(0,Math.floor(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
