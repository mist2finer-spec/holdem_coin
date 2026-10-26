/** Recovered action scheduling with an explicit one-dimensional spatial adapter. */
export type EffectCommand={phase:string;type:number;value:number;duration:number;target:number};
export type ImpactorCommand={at:number;condition:{Condition:number;ConditionTarget:number;ConditionValue:number;ConditionValue2:number};count:number;interval:number;speed:number;duration:number;width:number;moving:boolean;arrive:boolean;release:boolean;repeat:number;unique:boolean;targetOrigin:number;startOrigin:number;tracking:boolean;effects:EffectCommand[]};
export type AttackCondition={ConditionType:number;HpPercentThreshold:number;SkillType:number;SkillUseCount:number;ElapsedTime:number};
export type MonsterAttack={id:number;clip:string;animations:{at:number;clip:string}[];duration:number;cooldown:number;cooldownMethod:number;mp:number|null;range:number;tag:number;conditions:AttackCondition[];commands:ImpactorCommand[];pending:{kind:string;dataId:number}[]};
export type Cast={skill:MonsterAttack;start:number;source:number;targetX:number;emitted:Set<string>};
export type Impactor={id:number;source:number;x:number;targetX:number;direction:number;command:ImpactorCommand;born:number;expires:number;hits:Record<string,number>};
export function canUseAttack(a:MonsterAttack,hpPercent:number,elapsed:number,uses:Record<number,number>){
 return a.conditions.every(c=>c.ConditionType===0||c.ConditionType===1&&hpPercent<=c.HpPercentThreshold||c.ConditionType===7&&(uses[c.SkillType||a.id]??0)<c.SkillUseCount||c.ConditionType===8&&elapsed>=c.ElapsedTime);
}
export function castCommands(cast:Cast,now:number){
 const out:ImpactorCommand[]=[];
 for(const [index,command] of cast.skill.commands.entries())for(let n=0;n<command.count;n++){
  const key=`${index}:${n}`;
  if(cast.emitted.has(key)||now-cast.start+1e-8<command.at+n*command.interval)continue;
  cast.emitted.add(key);
  // Conditional commands require a separately verified target-condition interpreter.
  if(command.condition.Condition!==0)continue;
  out.push(command);
 }
 return out;
}
export function sweptHit(from:number,to:number,target:number,width:number,radius=24){return target+radius>=Math.min(from,to)-width/2&&target-radius<=Math.max(from,to)+width/2;}
export function markHit(p:Impactor,target:string,phase:string,now:number){
 const key=p.command.unique?target:`${target}:${phase}`,last=p.hits[key];
 if(last!==undefined&&(phase!=='Moving'||p.command.repeat<=0||now-last<p.command.repeat))return false;
 p.hits[key]=now;return true;
}
