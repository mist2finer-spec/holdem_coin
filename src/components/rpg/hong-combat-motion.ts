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
export function hongMotionTime(age:number,duration:number,hitAt:number,clipDuration:number,visualHit:number,snappy=false){
 if(![age,duration,hitAt,clipDuration,visualHit].every(Number.isFinite)||duration<=0||clipDuration<=0)return 0;
 const t=Math.max(0,Math.min(duration,age)),hit=Math.max(0,Math.min(duration,hitAt)),contact=Math.max(0,Math.min(clipDuration,visualHit));
 if(snappy&&hit>0&&hit<duration){
  // Preserve the authored 40ms snap and 100ms hold in real time as weapons change tempo.
  const snap=Math.min(.04,hit),sourceSnap=Math.min(.04,contact),begin=hit-snap;
  if(t<begin)return begin>0?t/begin*(contact-sourceSnap):0;
  if(t<hit)return contact-sourceSnap+(t-begin)/snap*sourceSnap;
  const hold=Math.min(.10,(duration-hit)*.6),sourceHold=Math.min(.10,(clipDuration-contact)*.6);
  if(t<=hit+hold)return contact+(t-hit)/hold*sourceHold;
  return contact+sourceHold+(t-hit-hold)/(duration-hit-hold)*(clipDuration-contact-sourceHold);
 }
 if(t<hit)return hit>0?t/hit*contact:0;
 if(duration===hit)return clipDuration;
 return contact+(t-hit)/(duration-hit)*(clipDuration-contact);
}
export const HONG_BODY_SLOTS=['hair-back','far-thigh','far-shin','far-foot','near-thigh','near-shin','near-foot','far-upper-arm','far-forearm','far-hand','torso','pelvis','head','near-upper-arm','near-forearm','near-hand'] as const;
export const HONG_FOOT_SLOTS=['near-foot','far-foot'] as const;
export function hongVisualContact(name:string){return (contacts as Record<string,number>)[name]??0;}
