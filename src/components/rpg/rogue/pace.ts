import profile from '../combat-profile.json';
import {TRAVERSAL} from './traversal';
/** Web tuning, with native Axe action/contact timings and Rush speed at 24px per native unit. */
export const ROGUE_PACE={moveSpeed:210,attackRate:1.12,rushSpeed:profile.native.rushSpeed*TRAVERSAL.unit,rushMin:125,rushMax:260,rushStop:72,pollMs:50,predictionSeconds:.15,maxActiveGap:1,reconnectStep:.25} as const;
export function rogueAttackTiming(stage:number){const data=profile.combo[(stage-1)%profile.combo.length];return {duration:data.duration/ROGUE_PACE.attackRate,hitAt:data.hitAt/ROGUE_PACE.attackRate};}

/** Absolute retry deadline: repeated key/pointer events must not postpone recovery. */
export function roguePollDelay(lastSent:number,now:number,retryAt=0,hidden=false){return Math.max(0,retryAt-now,(hidden?500:ROGUE_PACE.pollMs)-(now-lastSent));}
