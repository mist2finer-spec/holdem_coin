/** Recovered InflictDamage settlement. Final attack/crit/effect calculation is upstream.
 * Passive trigger IDs are returned in original order; this function never invents their effects.
 */
export type DamageState={hp:number;maxHP:number;shield:number;actorFlags?:number;invincible?:boolean;invincibleShield?:boolean};
export function settleDamage(target:DamageState,damage:number,shieldBonus=0,flags=BigInt(0)){
 const {actorFlags=0,invincible=false,invincibleShield=false}=target;
 let {hp,shield}=target,hpDamage=0,shieldSpent=0;const triggers:number[]=[];
 if(![hp,target.maxHP,shield,damage,shieldBonus].every(Number.isFinite)||Math.min(hp,target.maxHP,shield,damage)<0)throw Error('Invalid damage settlement input');
 if(hp<=0||(actorFlags&0x400)!==0)return {hp,shield,grossDamage:0,hpDamage,shieldSpent,flags,triggers,dispatched:false};
 const ignoreInvincibility=(flags&BigInt(0x4000))!==BigInt(0);
 if(invincible&&!ignoreInvincibility){damage=0;flags|=BigInt(0x2000);}
 else{
  if(actorFlags&0x200)damage=Math.min(damage,1);
  if(damage>0){
   if(shield>0){
    if(invincibleShield&&!ignoreInvincibility){damage=0;flags|=BigInt(0x2000);}
    else{
     const bonus=Math.fround(shieldBonus),hit=bonus>0?damage+damage*bonus/100:damage;
     shieldSpent=Math.min(hit,shield);shield-=shieldSpent;
     const absorbed=bonus>0?shieldSpent/Math.fround(100/bonus+1):shieldSpent;
     const remainder=Math.max(0,damage-absorbed);hpDamage=Math.min(hp,remainder);hp=Math.max(0,hp-remainder);
    }
    if(shield<=0)triggers.push(15);
   }else{hpDamage=Math.min(hp,damage);hp=Math.max(0,hp-damage);}
  }
 }
 triggers.push(12);if(hp<=0)triggers.push(11);
 return {hp,shield,grossDamage:damage,hpDamage,shieldSpent,flags,triggers,dispatched:true};
}

export type ArmorProfile={critical:number;physical:number;magical:number;basic:number;skill:number};
/** Armor is a groggy gauge, not HP defense. Values are independently additive. */
export function armorDamage(profile:ArmorProfile,flags:bigint){
 let result=0;
 for(const [mask,value] of [[BigInt(1),profile.critical],[BigInt('0x1f0000000'),profile.physical],[BigInt('0xf800000'),profile.magical],[BigInt(64),profile.basic],[BigInt(128),profile.skill]] as const){
  if(!Number.isFinite(value))throw Error('Invalid armor decrement');
  if((flags&mask)!==BigInt(0)&&value>0)result+=value;
 }
 return result;
}
