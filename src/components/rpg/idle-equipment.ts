/** Six-slot web equipment adaptation. Rarity/socket policy is custom, not recovered Vardian data. */
import {SOCKET_COLORS,type SocketColor} from './ertel-sockets';
import growth from './data/recovered-growth.json';

export const EQUIPMENT_RARITIES=['normal','high','rare','heroic','ancient','mythic'] as const;
export type EquipmentRarity=typeof EQUIPMENT_RARITIES[number];
export const EQUIPMENT_SLOTS=['weapon','armor','gloves','boots','ring1','ring2'] as const;
export type EquipmentSlot=typeof EQUIPMENT_SLOTS[number];
export const EQUIPMENT_WEAPONS=['sword','axe','dual','spear'] as const;
export type EquipmentWeapon=typeof EQUIPMENT_WEAPONS[number];
export type LegacyEquipmentRarity='C'|'UC'|'R'|'SR'|'SSR'|'UR'|'LR';
export const LEGACY_RARITY_MAP:Record<LegacyEquipmentRarity,EquipmentRarity>={C:'normal',UC:'high',R:'rare',SR:'heroic',SSR:'ancient',UR:'mythic',LR:'mythic'};
export const EQUIPMENT_LABELS:Record<EquipmentRarity,string>={normal:'일반',high:'고급',rare:'희귀',heroic:'영웅',ancient:'고대',mythic:'신화'};
export const EQUIPMENT_SLOT_LABELS:Record<EquipmentSlot,string>={weapon:'무기',armor:'갑옷',gloves:'장갑',boots:'장화',ring1:'반지 1',ring2:'반지 2'};
export const EQUIPMENT_MAX_ITEMS=2000;
/** Count includes the active socket; a paired dual weapon remains ONE item/group. */
export const EQUIPMENT_LINK_CAPS={sword:[1,2,3,4,4,4],axe:[2,3,4,5,6,6],dual:[1,1,2,2,3,3],spear:[2,3,4,5,6,6],armor:[2,3,4,5,6,6],gloves:[1,2,3,4,4,4],boots:[1,2,3,4,4,4],ring1:[1,1,1,1,1,1],ring2:[1,1,1,1,1,1]} as const;
export type EquipmentInstance={instanceId:string;slot:EquipmentSlot;rarity:EquipmentRarity;weaponType?:EquipmentWeapon;level:number;gems:(string|null)[];socketColors?:SocketColor[];socketLinks?:boolean[];builtInSupports?:string[];uniqueEffect?:'cluster-notables'|'devotion-speed';legacyRarity?:LegacyEquipmentRarity};
export type EquipmentState={version:1;starterGemPolicyVersion?:1;items:EquipmentInstance[];equipped:Record<EquipmentSlot,string>};
export function equipmentLinkCap(item:Pick<EquipmentInstance,'slot'|'rarity'|'weaponType'>){
 const grade=EQUIPMENT_RARITIES.indexOf(item.rarity),key=item.slot==='weapon'?item.weaponType:item.slot;
 if(grade<0||!key||!(key in EQUIPMENT_LINK_CAPS))throw Error('잘못된 장비 등급 또는 종류입니다.');
 return EQUIPMENT_LINK_CAPS[key][grade];
}
export function createStarterEquipment(weaponType:EquipmentWeapon='axe'):EquipmentState{
 if(!EQUIPMENT_WEAPONS.includes(weaponType))throw Error('잘못된 무기 종류입니다.');
 const items:EquipmentInstance[]=EQUIPMENT_SLOTS.map(slot=>{const item:EquipmentInstance={instanceId:`starter_${slot}`,slot,rarity:'normal',...(slot==='weapon'?{weaponType}:{}),level:1,gems:[]};item.gems=Array(equipmentLinkCap(item)).fill(null);return item;});
 return {version:1,starterGemPolicyVersion:1,items,equipped:Object.fromEntries(items.map(item=>[item.slot,item.instanceId])) as Record<EquipmentSlot,string>};
}
/** One-time reset of the exact old untouched starter layout; preserve every customized loadout and all owned gem copies. */
export function migrateStarterGemPolicy(state:EquipmentState):EquipmentState{
 validateEquipmentState(state);if(state.starterGemPolicyVersion===1)return state;
 const oldActives=['rift','dark','frost','holy','whirl','heal'];
 const pristine=state.items.length===EQUIPMENT_SLOTS.length&&EQUIPMENT_SLOTS.every((slot,index)=>{const item=state.items.find(item=>item.instanceId===`starter_${slot}`);return !!item&&item.slot===slot&&state.equipped[slot]===item.instanceId&&item.rarity==='normal'&&item.level===1&&item.gems.length===equipmentLinkCap(item)&&item.gems[0]===oldActives[index]&&item.gems.slice(1).every(id=>id===null)&&item.socketColors===undefined&&item.socketLinks===undefined&&item.builtInSupports===undefined&&item.uniqueEffect===undefined&&item.legacyRarity===undefined;});
 return {...state,starterGemPolicyVersion:1,items:pristine?state.items.map(item=>({...item,gems:item.gems.map(()=>null)})):state.items};
}
export function validateEquipmentState(raw:unknown):asserts raw is EquipmentState{
 const state=raw as EquipmentState;
 if(!state||state.version!==1||state.starterGemPolicyVersion!==undefined&&state.starterGemPolicyVersion!==1||!Array.isArray(state.items)||state.items.length<6||state.items.length>EQUIPMENT_MAX_ITEMS||!state.equipped||typeof state.equipped!=='object')throw Error('잘못된 장비 보관함입니다.');
 const ids=new Set<string>();
 for(const item of state.items){
  if(!item||typeof item.instanceId!=='string'||!/^\w{1,64}$/.test(item.instanceId)||ids.has(item.instanceId)||!EQUIPMENT_SLOTS.includes(item.slot)||!EQUIPMENT_RARITIES.includes(item.rarity)||!Number.isSafeInteger(item.level)||item.level<1||item.level>50)throw Error('잘못된 장비 인스턴스입니다.');
  if(item.slot==='weapon'?!EQUIPMENT_WEAPONS.includes(item.weaponType!):item.weaponType!==undefined)throw Error('잘못된 장비 무기 종류입니다.');
  if(!Array.isArray(item.gems)||item.gems.length>equipmentLinkCap(item)||Array.from(item.gems).some(id=>id!==null&&(typeof id!=='string'||!/^\w{1,64}$/.test(id))))throw Error('장비 소켓 한도와 젬 배치가 일치하지 않습니다.');
  if(item.socketColors!==undefined&&(!Array.isArray(item.socketColors)||item.socketColors.length!==item.gems.length||Array.from(item.socketColors).some(c=>!SOCKET_COLORS.includes(c))))throw Error('잘못된 홈 색상입니다.');
  if(item.socketLinks!==undefined&&(!Array.isArray(item.socketLinks)||item.socketLinks.length!==Math.max(0,item.gems.length-1)||Array.from(item.socketLinks).some(v=>typeof v!=='boolean')))throw Error('잘못된 홈 연결입니다.');
  if(item.builtInSupports!==undefined&&(!Array.isArray(item.builtInSupports)||item.builtInSupports.length>2||new Set(item.builtInSupports).size!==item.builtInSupports.length||Array.from(item.builtInSupports).some(id=>!['brutality','bleed'].includes(id))||(item.builtInSupports.length>0&&(item.slot!=='weapon'||!['ancient','mythic'].includes(item.rarity)))))throw Error('잘못된 장비 내장 보조입니다.');
  if(item.uniqueEffect!==undefined&&(!['cluster-notables','devotion-speed'].includes(item.uniqueEffect)||item.slot!=='armor'||!['ancient','mythic'].includes(item.rarity)))throw Error('잘못된 고유 장비 효과입니다.');
  if(item.legacyRarity!==undefined&&LEGACY_RARITY_MAP[item.legacyRarity]!==item.rarity)throw Error('잘못된 이전 장비 등급입니다.');
  ids.add(item.instanceId);
 }
 const used=new Set<string>();
 for(const slot of EQUIPMENT_SLOTS){const id=state.equipped[slot],item=state.items.find(item=>item.instanceId===id);if(!item||item.slot!==slot||used.has(id))throw Error('소유하지 않은 장비 또는 잘못된 장착 칸입니다.');used.add(id);}
}
export function equippedItems(state:EquipmentState):Record<EquipmentSlot,EquipmentInstance>{
 validateEquipmentState(state);return Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,state.items.find(item=>item.instanceId===state.equipped[slot])!])) as Record<EquipmentSlot,EquipmentInstance>;
}
export function equipmentGroup(state:EquipmentState,slot:EquipmentSlot){return equippedItems(state)[slot];}
export function equipEquipment(state:EquipmentState,instanceId:string):EquipmentState{
 validateEquipmentState(state);const item=state.items.find(item=>item.instanceId===instanceId);if(!item)throw Error('보유하지 않은 장비입니다.');
 return {...state,equipped:{...state.equipped,[item.slot]:instanceId}};
}
/** Native grade-1 curve arithmetic; accessory use of the weapon curve is explicitly custom. */
export function equipmentUpgradeCost(item:EquipmentInstance){
 if(!Number.isInteger(item.level)||item.level<1||item.level>=50)return 0;
 const c=item.slot==='armor'?growth.armorCurve:growth.weaponCurve,n=Math.fround(item.level-c.min);
 const q=Math.floor(Math.floor(Math.floor(Math.floor(c.rate*n)*n)+Math.floor(c.scaler*.5))/c.scaler);
 return Math.floor(Math.floor(c.inc*n)+Math.floor(c.base+q));
}
export function upgradeEquipment(state:EquipmentState,soulGem:number,instanceId:string){
 validateEquipmentState(state);const item=state.items.find(item=>item.instanceId===instanceId);if(!item)throw Error('보유하지 않은 장비입니다.');
 const cost=equipmentUpgradeCost(item);if(!cost)throw Error('최대 강화 단계입니다.');if(!Number.isSafeInteger(soulGem)||soulGem<cost)throw Error('영혼석이 부족합니다.');
 return {equipment:{...state,items:state.items.map(old=>old.instanceId===instanceId?{...old,level:old.level+1}:old)},soulGem:soulGem-cost,cost};
}
/** Preserve source grade on merged UR/LR items; no acquired item or stat level is deleted. */
export function migrateEquipmentRarity<T extends {rarity:string}>(item:T){
 if(EQUIPMENT_RARITIES.includes(item.rarity as EquipmentRarity))return {...item};
 const legacy=item.rarity as LegacyEquipmentRarity;if(!Object.hasOwn(LEGACY_RARITY_MAP,legacy))throw Error('알 수 없는 이전 장비 등급입니다.');
 return {...item,rarity:LEGACY_RARITY_MAP[legacy],legacyRarity:legacy};
}
