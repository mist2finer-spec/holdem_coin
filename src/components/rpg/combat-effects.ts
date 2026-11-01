import type {CompiledBuild,CompiledSkill} from './hunt-build';
export type AuraState={key:string;skillId:string;sourceId:string;effect:number;until:number};
export type AssistEvent={serial:number;skillId:string;sourceActor:string;sourceId:string;at:number};
/** Mutable clocks and event provenance; formulas and equipment remain immutable. */
export class CombatEffects{
 private auras=new Map<string,AuraState>();private serial=0;private assists:AssistEvent[]=[];
 private events={crit:0,hurt:0};private eventAt={crit:-Infinity,hurt:-Infinity};
 private seen=new Map<string,{crit:number;hurt:number}>();private triggerAt=new Map<string,number>();private grantedAt=new Map<string,number>();
 activate(skill:Readonly<CompiledSkill>,now:number){if(skill.enabled&&skill.aura>0&&skill.tags.includes('AURA')){const key=`${skill.sourceId}:${skill.activeId}`;this.auras.set(key,{key,skillId:skill.activeId,sourceId:skill.sourceId,effect:skill.aura,until:now+8*skill.duration});}}
 auraStates(now:number){for(const [key,aura] of this.auras)if(aura.until<=now)this.auras.delete(key);return [...this.auras.values()].map(a=>({...a,remaining:Math.max(0,a.until-now)}));}
 hasAura(id:string,now:number){return this.auraStates(now).some(a=>a.skillId===id);}
 /** Copies of one aura do not stack; distinct aura skills do. */
 damageMultiplier(now:number){const effects=new Map<string,number>();for(const aura of this.auraStates(now))effects.set(aura.skillId,Math.max(effects.get(aura.skillId)??0,aura.effect));return [...effects.values()].reduce((value,effect)=>value*(1+effect),1);}
 conditionalMultiplier(skill:Pick<CompiledSkill,'element'>,build:CompiledBuild,now:number){return build.conditionalJewels.includes('watcherseye')&&skill.element==='cold'&&this.hasAura('hatred',now)?1.2:1;}
 regeneration(build:CompiledBuild,now:number){return build.passive.noRegen?0:build.passive.regeneration+(build.conditionalJewels.includes('watcherseye')&&this.hasAura('vitality',now)?.01:0);}
 record(event:'crit'|'hurt',now:number,source?:Pick<CompiledSkill,'canTriggerEvents'>){if(source&&!source.canTriggerEvents)return;this.events[event]++;this.eventAt[event]=now;}
 triggerReady(skill:Readonly<CompiledSkill>,now:number){if(!skill.enabled||!skill.trigger||(this.triggerAt.get(skill.sourceId)??0)>now)return false;if(skill.trigger==='timed')return true;return now-this.eventAt[skill.trigger]<.8&&(this.seen.get(skill.sourceId)?.[skill.trigger]??0)<this.events[skill.trigger];}
 consumeTrigger(skill:Readonly<CompiledSkill>,now:number){this.seen.set(skill.sourceId,{...this.events});this.triggerAt.set(skill.sourceId,now+skill.triggerInterval);}
 grantedReady(skill:Pick<CompiledSkill,'sourceId'>,now:number){return (this.grantedAt.get(skill.sourceId)??0)<=now;}
 consumeGranted(skill:Readonly<CompiledSkill>&{sourceActor:string},now:number){this.grantedAt.set(skill.sourceId,now+Math.max(2,8*skill.cooldown));this.assists.push({serial:++this.serial,skillId:skill.activeId,sourceActor:skill.sourceActor,sourceId:skill.sourceId,at:now});this.assists=this.assists.slice(-16);}
 snapshot(now:number){return {auras:this.auraStates(now),assists:this.assists.filter(e=>now-e.at<2).map(e=>({...e}))};}
}
/** Finite mitigation factor also works on BigInfinity damage without converting it to Number. */
export function mitigation(passive:CompiledBuild['passive'],element:string,random:()=>number){
 if(passive.chaosImmune&&element==='chaos'||random()<passive.block)return 0;
 if(element==='physical'){const dodge=Math.min(.75,passive.dodge+Math.max(0,passive.evasion)/(1+Math.max(0,passive.evasion))*.4);if(dodge>0&&random()<dodge)return 0;return 1-Math.min(.75,Math.max(0,passive.armour)/(1+Math.max(0,passive.armour)));}
 if(passive.spellDodge>0&&random()<passive.spellDodge)return 0;
 return (1-(element==='chaos'?passive.chaosResistance:passive.resistance))*(element!=='chaos'&&random()<passive.suppression?.5:1);
}
