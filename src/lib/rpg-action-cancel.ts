// A valid manual action owns the next turn; AUTO cannot replace this short recovery.
export const ATTACK_CANCEL_SECONDS=.04;
export function cancelAttack(hero:any,input:any,elapsed:number,begin:()=>boolean):boolean|undefined {
 if(!hero.motion)return undefined;
 if(hero.motion.kind!=='attack'||!(input.jump||input.slide||input.dodge||input.skill!==undefined))return false;
 const previous=hero.motion,action=hero.action;
 hero.motion=null;hero.action='stay1';
 if(!begin()){hero.motion=previous;hero.action=action;return false;}
 const next=hero.motion,nextAction=hero.action;next.start=elapsed+ATTACK_CANCEL_SECONDS;
 hero.motion={kind:'cancel',start:elapsed,duration:ATTACK_CANCEL_SECONDS,hitAt:0,from:{x:hero.x,y:hero.y},to:{x:hero.x,y:hero.y},next,nextAction,cancelledAttackId:previous.attackId};
 hero.action='stay1';hero.serial++;return true;
}
export function stepAttackCancel(hero:any,elapsed:number){
 const m=hero.motion;if(m?.kind!=='cancel')return false;
 if(elapsed+1e-9>=m.start+m.duration){hero.motion=m.next;hero.action=m.nextAction;hero.serial++;}
 return true;
}
