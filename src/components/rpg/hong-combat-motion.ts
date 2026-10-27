import type {WeaponType} from './hunt-weapons';
/** Hong's visual rig is an adapter: server damage, reach, cooldown and movement stay authoritative. */
export function hongMotionName(action:string,weapon:WeaponType){
 const base=action==='damage1'?'defeat1':action.startsWith('skill')?'attack5':action;
 return weapon==='unarmed'?base:`${weapon}-${base}`;
}
/** Keep the authored contact pose on the server impact even when equipment changes attack speed.
 * Windup and recovery are remapped separately; simply scaling duration would move the hit frame.
 */
export function hongMotionTime(age:number,duration:number,hitAt:number,clipDuration:number,visualHit:number){
 if(![age,duration,hitAt,clipDuration,visualHit].every(Number.isFinite)||duration<=0||clipDuration<=0)return 0;
 const t=Math.max(0,Math.min(duration,age)),hit=Math.max(0,Math.min(duration,hitAt)),contact=Math.max(0,Math.min(clipDuration,visualHit));
 if(t<hit)return hit>0?t/hit*contact:0;
 if(duration===hit)return clipDuration;
 return contact+(t-hit)/(duration-hit)*(clipDuration-contact);
}
export const HONG_BODY_SLOTS=['hair-back','back-thigh','back-shin','back-foot','front-thigh','front-shin','front-foot','back-upper-arm','back-forearm','back-hand','torso','pelvis','head','front-upper-arm','front-forearm','front-hand'] as const;
export const HONG_FOOT_SLOTS=['front-foot','back-foot'] as const;
