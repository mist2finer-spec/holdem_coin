import contacts from './data/hong-runtime-motion.json';
import type {WeaponType} from './hunt-weapons';
/** Hong's visual rig is an adapter: server damage, reach, cooldown and movement stay authoritative. */
export function hongMotionName(action:string,weapon:WeaponType){
 const base=action==='damage1'?'defeat1':action;
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
export const HONG_BODY_SLOTS=['hair-back','far-thigh','far-shin','far-foot','near-thigh','near-shin','near-foot','far-upper-arm','far-forearm','far-hand','torso','pelvis','head','near-upper-arm','near-forearm','near-hand'] as const;
export const HONG_FOOT_SLOTS=['near-foot','far-foot'] as const;
export function hongVisualContact(name:string){return (contacts as Record<string,number>)[name]??0;}
