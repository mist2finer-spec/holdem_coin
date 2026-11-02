import {colorMatches,SOCKET_CRAFT_COST,rollSocketColors,rollSocketLinks,rollSocketCount,type SocketCraft} from './ertel-sockets';
/** Server supplies crypto RNG. Rates/costs are disclosed custom free-currency balance, not native claims. */
import {ACTIVE_CATALOG,ACTIVE_SKILLS,GEMS} from './build-catalog';
import {EQUIPMENT_MAX_ITEMS,EQUIPMENT_RARITIES,EQUIPMENT_SLOTS,EQUIPMENT_WEAPONS,equipmentLinkCap,validateEquipmentState,type EquipmentInstance,type EquipmentState} from './idle-equipment';
export type GemCollection={version:1;active:Record<string,number>;support:Record<string,number>};
export type GachaState={version:1;equipmentPulls:number;gemPulls:number};
export type GachaRandom=()=>number;
export type EquipmentGachaPool='all'|'weapon'|'armor'|'gloves'|'boots'|'ring';
export const GACHA_POLICY={source:'custom-web-idle-v1',equipmentCost:100,gemCost:75,maxBatch:10,pullsPerLevel:100,maxLevel:10,pity:null,activeWeight:45,supportWeight:55,ancientMythicOptionChance:.05} as const;
/** Per 10,000; every tier has positive mass at every summon level. */
export const EQUIPMENT_GACHA_WEIGHTS=[
 [6000,2600,1000,320,70,10],[5700,2750,1100,350,85,15],[5400,2900,1200,380,100,20],[5100,3050,1300,410,115,25],[4800,3200,1400,440,130,30],
 [4500,3350,1500,470,145,35],[4200,3500,1600,500,160,40],[3900,3650,1700,530,175,45],[3600,3800,1800,560,190,50],[3300,3950,1900,590,205,55],
] as const;
const activeIds=new Set(ACTIVE_CATALOG.map(g=>g.id)),supportIds=new Set(GEMS.map(g=>g.id));
export const ACQUIRABLE_ACTIVE_GEMS=ACTIVE_CATALOG.filter(g=>!ACTIVE_SKILLS.some(starter=>starter.id===g.id));
export function createGemCollection():GemCollection{return {version:1,active:Object.fromEntries(ACTIVE_SKILLS.map(g=>[g.id,1])),support:{}};}
export function createGachaState():GachaState{return {version:1,equipmentPulls:0,gemPulls:0};}
export function validateGemCollection(raw:unknown):asserts raw is GemCollection{
 const collection=raw as GemCollection;if(!collection||collection.version!==1)throw Error('잘못된 젬 보관함입니다.');
 for(const [values,catalog] of [[collection.active,activeIds],[collection.support,supportIds]] as const){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('잘못된 젬 보관함입니다.');
  for(const [id,count] of Object.entries(values))if(!catalog.has(id)||!Number.isSafeInteger(count)||count<1||count>1e9)throw Error('잘못된 젬 보유 수량입니다.');
 }
}
export function validateGachaState(raw:unknown):asserts raw is GachaState{const state=raw as GachaState;if(!state||state.version!==1||![state.equipmentPulls,state.gemPulls].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12))throw Error('잘못된 소환 진행도입니다.');}
export function gachaLevel(pulls:number){if(!Number.isSafeInteger(pulls)||pulls<0)throw Error('잘못된 소환 횟수입니다.');return Math.min(GACHA_POLICY.maxLevel,1+Math.floor(pulls/GACHA_POLICY.pullsPerLevel));}
function randomUnit(rng:GachaRandom){const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw Error('잘못된 난수입니다.');return value;}
export function weightedIndex(weights:readonly number[],rng:GachaRandom){
 if(!weights.length||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw Error('잘못된 확률표입니다.');const total=weights.reduce((sum,w)=>sum+w,0);if(!Number.isSafeInteger(total)||total<1)throw Error('잘못된 확률표입니다.');
 const ticket=randomUnit(rng)*total;let cumulative=0;for(let i=0;i<weights.length;i++){cumulative+=weights[i];if(ticket<cumulative)return i;}throw Error('확률표 범위를 벗어났습니다.');
}
function quote(soulGem:number,count:number,cost:number){if(count!==1&&count!==10)throw Error('1회 또는 10회만 소환할 수 있습니다.');if(!Number.isSafeInteger(soulGem)||soulGem<count*cost)throw Error('영혼석이 부족합니다.');return count*cost;}
export function rollEquipmentBatch(state:EquipmentState,gacha:GachaState,soulGem:number,count:number,rng:GachaRandom,idFactory:()=>string,category:EquipmentGachaPool='all'){
 validateEquipmentState(state);validateGachaState(gacha);const cost=quote(soulGem,count,GACHA_POLICY.equipmentCost);
 if(!['all','weapon','armor','gloves','boots','ring'].includes(category))throw Error('잘못된 장비 소환 종류입니다.');
 if(state.items.length+count>EQUIPMENT_MAX_ITEMS)throw Error('장비 보관함이 가득 찼습니다.');
 const results:EquipmentInstance[]=[],ids=new Set(state.items.map(item=>item.instanceId));
 for(let i=0;i<count;i++){
  const rarity=EQUIPMENT_RARITIES[weightedIndex(EQUIPMENT_GACHA_WEIGHTS[gachaLevel(gacha.equipmentPulls+i)-1],rng)],slot=category==='all'?EQUIPMENT_SLOTS[Math.floor(randomUnit(rng)*EQUIPMENT_SLOTS.length)]:category==='ring'?(randomUnit(rng)<.5?'ring1':'ring2'):category,weaponType=slot==='weapon'?EQUIPMENT_WEAPONS[Math.floor(randomUnit(rng)*4)]:undefined;
  const instanceId=idFactory();if(!/^\w{1,64}$/.test(instanceId)||ids.has(instanceId))throw Error('중복되거나 잘못된 장비 식별자입니다.');ids.add(instanceId);
  const item:EquipmentInstance={instanceId,slot,rarity,...(weaponType?{weaponType}:{}),level:1,gems:[]};
  if((rarity==='ancient'||rarity==='mythic')&&(slot==='weapon'||slot==='armor')&&randomUnit(rng)<GACHA_POLICY.ancientMythicOptionChance){
   const option=randomUnit(rng)<.5?0:1;if(slot==='weapon')item.builtInSupports=[['brutality','bleed'][option]];else item.uniqueEffect=(['cluster-notables','devotion-speed'] as const)[option];
  }
  item.gems=Array(rollSocketCount(equipmentLinkCap(item),rng)).fill(null);item.socketColors=rollSocketColors(item.gems.length,rng);item.socketLinks=rollSocketLinks(item.gems.length,rng);
  results.push(item);
 }
 const equipment:EquipmentState={...state,items:[...state.items,...results]},nextGacha={...gacha,equipmentPulls:gacha.equipmentPulls+count};validateEquipmentState(equipment);validateGachaState(nextGacha);
 return {equipment,gacha:nextGacha,soulGem:soulGem-cost,results,cost};
}
export function rollGemBatch(collection:GemCollection,gacha:GachaState,soulGem:number,count:number,rng:GachaRandom){
 validateGemCollection(collection);validateGachaState(gacha);const cost=quote(soulGem,count,GACHA_POLICY.gemCost),next:GemCollection={version:1,active:{...collection.active},support:{...collection.support}},results:{kind:'active'|'support';gemId:string}[]=[];
 for(let i=0;i<count;i++){const kind=weightedIndex([GACHA_POLICY.activeWeight,GACHA_POLICY.supportWeight],rng)===0?'active':'support',pool=kind==='active'?ACQUIRABLE_ACTIVE_GEMS:GEMS,gemId=pool[Math.floor(randomUnit(rng)*pool.length)].id;next[kind][gemId]=(next[kind][gemId]??0)+1;results.push({kind,gemId});}
 const nextGacha={...gacha,gemPulls:gacha.gemPulls+count};validateGemCollection(next);validateGachaState(nextGacha);return {gemCollection:next,gacha:nextGacha,soulGem:soulGem-cost,results,cost};
}
/** All physical sockets, including inventory items, reserve copies. Built-in supports need no gem copies. */
export function validateOwnedEquipmentGems(equipment:EquipmentState,collection:GemCollection){
 validateEquipmentState(equipment);validateGemCollection(collection);const used={active:{} as Record<string,number>,support:{} as Record<string,number>};
 for(const item of equipment.items)for(let i=0;i<item.gems.length;i++){const id=item.gems[i];if(id===null)continue;const kind=i===0?'active':'support';if(!colorMatches(item,i,id))throw Error('에르텔과 홈의 색상이 맞지 않습니다.');if(!(kind==='active'?activeIds:supportIds).has(id))throw Error('잘못된 종류의 젬 소켓입니다.');used[kind][id]=(used[kind][id]??0)+1;if(used[kind][id]>(collection[kind][id]??0))throw Error('보유한 젬 수량이 부족합니다.');}
}
export function socketEquipmentGem(equipment:EquipmentState,collection:GemCollection,instanceId:string,socket:number,gemId:string|null){
 validateOwnedEquipmentGems(equipment,collection);const item=equipment.items.find(item=>item.instanceId===instanceId);if(!item||!Number.isInteger(socket)||socket<0||socket>=item.gems.length)throw Error('잘못된 장비 소켓입니다.');
 const result:EquipmentState={...equipment,items:equipment.items.map(old=>old.instanceId===instanceId?{...old,gems:old.gems.map((id,index)=>index===socket?gemId:id)}:old)};validateOwnedEquipmentGems(result,collection);return result;
}

export function craftEquipmentSockets(equipment:EquipmentState,collection:GemCollection,soulGem:number,instanceId:string,kind:SocketCraft,rng:GachaRandom){
 validateOwnedEquipmentGems(equipment,collection);if(!Object.hasOwn(SOCKET_CRAFT_COST,kind))throw Error('잘못된 세공입니다.');const cost=SOCKET_CRAFT_COST[kind];if(!Number.isSafeInteger(soulGem)||soulGem<cost)throw Error('영혼석이 부족합니다.');
 const old=equipment.items.find(i=>i.instanceId===instanceId);if(!old)throw Error('보유하지 않은 장비입니다.');if(kind!=='sockets'&&!old.gems.length)throw Error('홈을 먼저 세공하세요.');
 const item=structuredClone(old);if(kind==='sockets'){item.gems=Array(rollSocketCount(equipmentLinkCap(item),rng)).fill(null);item.socketColors=rollSocketColors(item.gems.length,rng);item.socketLinks=rollSocketLinks(item.gems.length,rng);}else if(kind==='colors'){item.socketColors=rollSocketColors(item.gems.length,rng);item.gems=item.gems.map((id,i)=>id&&colorMatches(item,i,id)?id:null);if(!item.gems[0])item.gems=item.gems.map(()=>null);}else item.socketLinks=rollSocketLinks(item.gems.length,rng);
 const next={...equipment,items:equipment.items.map(i=>i.instanceId===instanceId?item:i)};validateOwnedEquipmentGems(next,collection);return {equipment:next,soulGem:soulGem-cost,cost};
}
