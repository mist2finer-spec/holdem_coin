/** Presentation events only: never apply hits, rewards or cooldown changes here. */
export const SKILL_VFX = ['ground-rift','dark-hole','blizzard','holy-wrath','whirlwind','recovery'] as const;
export type SkillVfxId = typeof SKILL_VFX[number];
export type HuntVfxEvent = {id:number;skill:number;x:number;facing:number;born:number;expires:number};
export function vfxFrame(event:HuntVfxEvent,elapsed:number,frames=32,duration=2):number|null {
 if(!Number.isFinite(elapsed)||!Number.isFinite(event.born)||!Number.isFinite(event.expires)||!Number.isInteger(event.skill)||event.skill<0||event.skill>=SKILL_VFX.length||elapsed<event.born||elapsed>=event.expires||elapsed-event.born>=duration)return null;
 return Math.min(frames-1,Math.floor((elapsed-event.born)/duration*frames));
}
export function vfxPlacement(event:HuntVfxEvent,floor:number,zoom:number,screenX:(x:number)=>number){
 const width=([200,170,160,170,190,125][event.skill]??140)*zoom;
 const height=([120,170,150,240,170,170][event.skill]??140)*zoom;
 return {x:screenX(event.x)-width/2,y:floor-height+18*zoom,width,height};
}
