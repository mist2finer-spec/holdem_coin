import {type SocketCraft} from '../components/rpg/ertel-sockets';
import {initializeHybridProgress} from './rpg-hybrid-profile';
import {ACTIVE_SKILLS,ACTIVE_CATALOG,GEMS,activeSkill,validateBuild,supportsActive} from '../components/rpg/hunt-build';
import {createStarterEquipment,EQUIPMENT_SLOTS,equippedItems,equipEquipment,upgradeEquipment} from '../components/rpg/idle-equipment';
import {createGemCollection,createGachaState,validateGemCollection,validateOwnedEquipmentGems,rollEquipmentBatch,rollGemBatch,socketEquipmentGem,craftEquipmentSockets} from '../components/rpg/idle-gacha';
import {accrueIdleProgress,createIdleProgress} from '../components/rpg/idle-progression';
import {buyArt,buyTrait} from '../components/rpg/hunt-development';import type {HuntProgress} from '../components/rpg/hunt-progression';import {randomBytes,randomInt} from 'node:crypto';
export type IdleAction=`idle-craft-${SocketCraft}-${string}`|'idle-claim'|`idle-draw-equipment-${string}-${number}`|`idle-draw-gems-${number}`|`idle-equip-${string}`|`idle-upgrade-${string}`|`idle-socket-${string}-${number}-${string}`|`art-${number}-${number}`|`trait-${number}`;
export function isIdleAction(a:unknown):a is IdleAction{return typeof a==='string'&&a.length<=240&&/^(idle-claim|idle-craft-(colors|links|sockets)-\w{1,64}|idle-draw-equipment-(all|weapon|armor|gloves|boots|ring)-(1|10)|idle-draw-gems-(1|10)|idle-(equip|upgrade)-\w{1,64}|idle-socket-\w{1,64}-[0-5]-(empty|[a-z][a-z0-9]*)|art-\d{1,6}-(1|10|100)|trait-\d{1,4})$/.test(a);}
/** Additive migration retains all old fields and archives old full links; only real capacity is equipped. */
export function initializeIdleProfile(p:HuntProgress,now:number){
 if(!p.equipment){const old=structuredClone(p.build!);p.legacyBuild??=old;p.equipment=createStarterEquipment(p.weaponType==='unarmed'?'axe':p.weaponType);p.gemCollection=createGemCollection();const activeUse:Record<string,number>={},supportUse:Record<string,number>={};
  EQUIPMENT_SLOTS.forEach((slot,i)=>{const item=p.equipment!.items[i],a=activeSkill(old,i).id;item.level=Math.max(1,Math.min(50,slot==='weapon'?p.weaponLevels[item.weaponType!]:slot==='armor'?p.armorLevel:1));item.gems[0]=a;activeUse[a]=(activeUse[a]??0)+1;for(const id of old.links[i]??[])if(id)supportUse[id]=(supportUse[id]??0)+1;for(let j=1;j<item.gems.length;j++)item.gems[j]=old.links[i]?.[j-1]??null;});
  for(const[id,n]of Object.entries(activeUse))p.gemCollection.active[id]=Math.max(p.gemCollection.active[id]??0,n);p.gemCollection.support={...supportUse};
 }
 p.gemCollection??=createGemCollection();p.gacha??=createGachaState();if(!p.idle){p.idle=createIdleProgress(now);p.soulGem=Math.min(1e12,p.soulGem+1000);}
 initializeHybridProgress(p,now);syncIdleBuild(p);return accrueIdleProgress(p,now);
}
export function syncIdleBuild(p:HuntProgress){if(!p.equipment)return;validateOwnedEquipmentGems(p.equipment,p.gemCollection!);const equipped=equippedItems(p.equipment);p.weaponType=equipped.weapon.weaponType!;p.weaponLevel=equipped.weapon.level;p.armorLevel=Math.max(p.armorLevel,equipped.armor.level);p.weaponLevels[p.weaponType]=Math.max(p.weaponLevels[p.weaponType],p.weaponLevel);p.build!.equipment={version:1,items:EQUIPMENT_SLOTS.map(slot=>structuredClone(equipped[slot])),equipped:{...p.equipment.equipped}};validateBuild(p.build,p.level);}
export function applyIdleAction(p:HuntProgress,action:IdleAction,rng=()=>randomInt(0,1000000000)/1000000000,idFactory=()=>randomBytes(16).toString('hex')){
 if(!p.equipment||!p.gemCollection||!p.gacha||!p.idle)throw Error('장비 성장 데이터를 먼저 불러와 주세요.');let result:unknown=null;
 if(action.startsWith('idle-draw-equipment-')){const m=/^idle-draw-equipment-(\w+)-(1|10)$/.exec(action)!;const v=rollEquipmentBatch(p.equipment,p.gacha,p.soulGem,Number(m[2]),rng,idFactory,m[1] as any);p.equipment=v.equipment;p.gacha=v.gacha;p.soulGem=v.soulGem;result=v.results;}
 else if(action.startsWith('idle-draw-gems-')){const v=rollGemBatch(p.gemCollection,p.gacha,p.soulGem,Number(action.slice(15)),rng);p.gemCollection=v.gemCollection;p.gacha=v.gacha;p.soulGem=v.soulGem;result=v.results;}
 else if(action.startsWith('idle-equip-'))p.equipment=equipEquipment(p.equipment,action.slice(11));
 else if(action.startsWith('idle-craft-')){const m=/^idle-craft-(colors|links|sockets)-(\w+)$/.exec(action)!;const v=craftEquipmentSockets(p.equipment,p.gemCollection,p.soulGem,m[2],m[1] as SocketCraft,rng);p.equipment=v.equipment;p.soulGem=v.soulGem;}
 else if(action.startsWith('idle-upgrade-')){const v=upgradeEquipment(p.equipment,p.soulGem,action.slice(13));p.equipment=v.equipment;p.soulGem=v.soulGem;}
 else if(action.startsWith('idle-socket-')){const m=/^idle-socket-(\w+)-([0-5])-(\w+)$/.exec(action)!;p.equipment=socketEquipmentGem(p.equipment,p.gemCollection,m[1],Number(m[2]),m[3]==='empty'?null:m[3]);if(Number(m[2])===0){const item=p.equipment.items.find(i=>i.instanceId===m[1])!,active=item.gems[0];item.gems=item.gems.map((v,i)=>i===0?v:!active||v&&!supportsActive(active,v)?null:v);}}
 else if(action.startsWith('art-')){const[,id,n]=action.split('-');buyArt(p,Number(id),Number(n));}
 else if(action.startsWith('trait-'))buyTrait(p,Number(action.slice(6)));
 else if(action!=='idle-claim')throw Error('잘못된 성장 요청입니다.');syncIdleBuild(p);return result;
}
export function applyPhysicalBuildAction(p:HuntProgress,action:string){const m=/^(active|gem)-(\d+)(?:-(\d+))?-(\w+)$/.exec(action);if(!m)return false;const index=Number(m[2]),slot=EQUIPMENT_SLOTS[index];if(!slot||!p.equipment)throw Error('잘못된 스킬 슬롯입니다.');const id=p.equipment.equipped[slot],socket=m[1]==='active'?0:Number(m[3])+1;const gem=m[4]==='empty'?null:m[4];p.equipment=socketEquipmentGem(p.equipment,p.gemCollection!,id,socket,gem);if(m[1]==='active'){const item=p.equipment.items.find(i=>i.instanceId===id)!;item.gems=item.gems.map((v,i)=>i===0?v:!gem||v&&!supportsActive(gem,v)?null:v);}syncIdleBuild(p);return true;}
