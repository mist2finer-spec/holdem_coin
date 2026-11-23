// A valid manual action owns the next turn; AUTO cannot replace this short recovery.
export const ATTACK_CANCEL_SECONDS=.04;
// Instant evade (2026-11-23): roll / jump / slide replace a normal attack ON the press tick (no 0.04 s stay1). The evade motion
// carries cancelledAttackId (the attack it replaced) so the display cuts that attack's sword effects as it did for a cancel.
// Only a skill press still goes through the 0.04 s cut. The evade cooldown is the engine's and is checked by begin() as before.
export const evadeInput=(input:any)=>!!(input.jump||input.slide||input.dodge);
export function cancelAttack(hero:any,input:any,elapsed:number,begin:()=>boolean):boolean|undefined {
 if(!hero.motion)return undefined;
 if(hero.motion.kind!=='attack'||!(input.jump||input.slide||input.dodge||input.skill!==undefined))return false;
 const previous=hero.motion,action=hero.action;
 hero.motion=null;hero.action='stay1';
 if(!begin()){hero.motion=previous;hero.action=action;return false;}
 if(evadeInput(input)){hero.motion.cancelledAttackId=previous.attackId;return true;}
 const next=hero.motion,nextAction=hero.action;next.start=elapsed+ATTACK_CANCEL_SECONDS;
 hero.motion={kind:'cancel',start:elapsed,duration:ATTACK_CANCEL_SECONDS,hitAt:0,from:{x:hero.x,y:hero.y},to:{x:hero.x,y:hero.y},next,nextAction,cancelledAttackId:previous.attackId};
 hero.action='stay1';hero.serial++;return true;
}
export function stepAttackCancel(hero:any,elapsed:number){
 const m=hero.motion;if(m?.kind!=='cancel')return false;
 if(elapsed+1e-9>=m.start+m.duration){hero.motion=m.next;hero.action=m.nextAction;hero.serial++;}
 return true;
}
