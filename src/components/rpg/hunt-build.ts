import {linkedSupports,colorMatches} from './ertel-sockets';
import {expandAttributeTree} from './passive-tree';
import {EQUIPMENT_SLOTS,equippedItems,validateEquipmentState,type EquipmentState,type EquipmentSlot,type EquipmentWeapon} from './idle-equipment';
import {startingIdentity,skillSourceActor} from './character-identities';
import {resolveJewelTree, type JewelInstance, type JewelPlacement} from './jewel-system';
export {JEWEL_CATALOG} from './jewel-catalog';
export type {JewelInstance,JewelPlacement} from './jewel-system';
import {areaRadius} from './combat-big';
import {ACTIVE_SKILLS,ACTIVE_CATALOG,GEMS,type ActiveSkill,type SkillTag,type TriggerKind} from './build-catalog';
export {ACTIVE_SKILLS,ACTIVE_CATALOG,GEMS} from './build-catalog';
export type {ActiveSkill,SkillTag,SkillElement,TriggerKind,SupportGem} from './build-catalog';
export type GemId=typeof GEMS[number]['id'];
/** Optional fields extend v2 without invalidating or rewriting the old saved shape. */
export type BuildState={version:2;weapon:'axe';nodes:string[];links:(GemId|null)[][];start?:string;activeIds?:string[];jewels?:JewelPlacement[];equipment?:EquipmentState};
export type BuildAction=`gem-${number}-${number}-${string}`|`active-${number}-${string}`|`core-allocate-${string}`|`core-refund-${string}`|`core-start-${string}`|'core-reset';
export const SUPPORT_SOCKETS=5,ACTIVE_SLOTS=6;
export const buildBudget=(level=1)=>Math.min(90,12+Math.max(0,Math.floor(Number.isFinite(level)?level:1)-1));
export type PassiveStats={damage:number;reduction:number;cooldown:number;area:number;moreDamage:number;moreArea:number;life:number;energyShield:number;regeneration:number;mana:number;manaRegen:number;movement:number;block:number;suppression:number;crit:number;critMultiplier:number;leech:number;dotDamage:number;duration:number;projectiles:number;chain:number;pierce:number;attackDamage:number;meleeDamage:number;projectileDamage:number;spellDamage:number;physicalDamage:number;chaosDamage:number;elementalDamage:number;fireDamage:number;coldDamage:number;lightningDamage:number;guard:number;aura:number;moreElemental:number;chaosImmune:boolean;maxLifeOne:boolean;noCritical:boolean;strength:number;dexterity:number;intelligence:number;devotion:number;lifeFlat:number;shieldFlat:number;manaFlat:number;armour:number;evasion:number;resistance:number;chaosResistance:number;attackSpeed:number;castSpeed:number;tripleChance:number;cull:number;manaBeforeLife:number;lowLifeSpellMore:number;farShot:number;dodge:number;spellDodge:number;energyToMana:boolean;noRegen:boolean;fireOnly:boolean;bloodMagic:boolean;ironReflexes:boolean};
export type CoreNode={id:string;name:string;branch:number;tier:number;x:number;y:number;damage:number;reduction:number;cooldown:number;area:number;kind:'small'|'notable'|'keystone'|'socket';moreDamage:number;moreArea:number;description:string;region:string;startFor?:string;attribute?:'STR'|'DEX'|'INT'|'STR_DEX'|'DEX_INT'|'INT_STR'|'ALL';category?:'small'|'notable'|'keystone'|'socket'|'start'|'hub'|'travel';socketType?:'timeless'|'large'|'unique'|'medium'|'small';legacy?:boolean;clusterId?:string;grantsSkill?:string;allocationCost?:number;transformedBy?:string;originalDescription?:string}&Partial<Omit<PassiveStats,'damage'|'reduction'|'cooldown'|'area'|'moreDamage'|'moreArea'>>;
export const TREE_BOUNDS={width:3500,height:3500};
export const CHARACTER_STARTS=[
 {id:'hong',characterId:'hong',name:'홍 · 도끼 전사',region:'axe',nodeId:'root',angle:0,color:'#d47c42'},
 {id:'boy-hoodie',characterId:'boy-hoodie',name:'갈색 후드 · 기동',region:'agility',nodeId:'start_agility',angle:90,color:'#89b96a'},
 {id:'white-bob',characterId:'white-bob',name:'백발 · 연격',region:'duelist',nodeId:'start_duelist',angle:45,color:'#d66d79'},
 {id:'gold-dress',characterId:'gold-dress',name:'금빛 드레스 · 투사체',region:'projectile',nodeId:'start_projectile',angle:135,color:'#dbbd64'},
 {id:'black-suit',characterId:'black-suit',name:'검은 정장 · 정밀',region:'precision',nodeId:'start_precision',angle:315,color:'#b28bd2'},
 {id:'longhair-man',characterId:'longhair-man',name:'장발 · 수호',region:'guard',nodeId:'start_guard',angle:270,color:'#bb9273'},
 {id:'teal-twins',characterId:'teal-twins',name:'청록 트윈테일 · 원소',region:'element',nodeId:'start_element',angle:225,color:'#61c6b9'},
 {id:'pink-glasses',characterId:'pink-glasses',name:'분홍 안경 · 비전',region:'arcane',nodeId:'start_arcane',angle:180,color:'#e095be'},
 {id:'blonde-office',characterId:'blonde-office',name:'금발 오피스 · 균형',region:'balance',nodeId:'start_balance',angle:0,color:'#b9c5d2'},
] as const;
export type CharacterStart=typeof CHARACTER_STARTS[number];
export function buildStart(build:Pick<BuildState,'start'>|undefined):CharacterStart{return CHARACTER_STARTS.find(s=>s.id===(build?.start??'hong'))??CHARACTER_STARTS[0];}
export function newBuild(character='hong'):BuildState{
 const start=CHARACTER_STARTS.find(s=>s.id===character);if(!start)throw Error('알 수 없는 캐릭터 시작점입니다.');
 return {version:2,weapon:'axe',nodes:[start.nodeId],links:Array.from({length:ACTIVE_SLOTS},()=>Array<GemId|null>(SUPPORT_SOCKETS).fill(null)),...(character==='hong'?{}:{start:character})};
}
const zero=():PassiveStats=>({damage:0,reduction:0,cooldown:0,area:0,moreDamage:1,moreArea:1,life:0,energyShield:0,regeneration:0,mana:0,manaRegen:0,movement:0,block:0,suppression:0,crit:0,critMultiplier:0,leech:0,dotDamage:0,duration:0,projectiles:0,chain:0,pierce:0,attackDamage:0,meleeDamage:0,projectileDamage:0,spellDamage:0,physicalDamage:0,chaosDamage:0,elementalDamage:0,fireDamage:0,coldDamage:0,lightningDamage:0,guard:0,aura:0,moreElemental:1,chaosImmune:false,maxLifeOne:false,noCritical:false,strength:0,dexterity:0,intelligence:0,devotion:0,lifeFlat:0,shieldFlat:0,manaFlat:0,armour:0,evasion:0,resistance:0,chaosResistance:0,attackSpeed:0,castSpeed:0,tripleChance:0,cull:0,manaBeforeLife:0,lowLifeSpellMore:0,farShot:0,dodge:0,spellDodge:0,energyToMana:false,noRegen:false,fireOnly:false,bloodMagic:false,ironReflexes:false});
const statLabels:Partial<Record<keyof PassiveStats,string>>={damage:'모든 피해',reduction:'받는 피해 감소',cooldown:'재사용 감소',area:'범위 면적',life:'최대 생명력',energyShield:'기본 최대 생명력 대비 에너지 보호막',regeneration:'초당 생명력 재생',mana:'최대 마나',manaRegen:'마나 재생',movement:'이동 속도',block:'막기 확률',suppression:'주문 피해 억제',crit:'치명타 확률',leech:'적중 피해 흡수',dotDamage:'지속 피해',duration:'지속시간',attackDamage:'공격 피해',meleeDamage:'근접 피해',projectileDamage:'투사체 피해',spellDamage:'주문 피해',physicalDamage:'물리 피해',chaosDamage:'혼돈 피해',elementalDamage:'원소 피해',fireDamage:'화염 피해',coldDamage:'냉기 피해',lightningDamage:'번개 피해',guard:'보호막 효과',aura:'오라 효과',armour:'방어도',evasion:'회피율 보정',resistance:'원소 저항',chaosResistance:'혼돈 저항',attackSpeed:'공격 속도',castSpeed:'시전 속도',tripleChance:'3배 피해 확률',cull:'마무리 생명력 기준',manaBeforeLife:'피해의 마나 우선 부담',lowLifeSpellMore:'낮은 생명력 주문 증폭',farShot:'최대 거리 피해 증폭',dodge:'공격 회피',spellDodge:'주문 회피'};
export function describeStats(stats:Partial<PassiveStats>):string[]{
 const out:string[]=[];for(const [key,label] of [['strength','힘'],['dexterity','민첩'],['intelligence','지능'],['devotion','헌신'],['lifeFlat','생명력'],['shieldFlat','에너지 보호막'],['manaFlat','마나']] as const)if(stats[key])out.push(`${label} ${stats[key]!>0?'+':''}${stats[key]}`);for(const [key,label] of Object.entries(statLabels)){const value=stats[key as keyof PassiveStats];if(typeof value==='number'&&value!==0)out.push(`${label} ${value>0?'+':''}${+(value*100).toFixed(1)}%`);}
 for(const [key,label] of [['moreDamage','피해 배율'],['moreArea','범위 면적 배율'],['moreElemental','원소 피해 배율']] as const){const value=stats[key];if(value!==undefined&&value!==1)out.push(`${label} ×${value.toFixed(2)}`);}
 for(const [key,label] of [['projectiles','투사체'],['chain','연쇄'],['pierce','관통']] as const)if(stats[key])out.push(`${label} +${stats[key]}`);
 if(stats.critMultiplier)out.push(`치명타 배율 +${stats.critMultiplier.toFixed(2)}`);
 if(stats.energyToMana)out.push('에너지 보호막을 마나로 전환');if(stats.noRegen)out.push('생명력 재생 불가');if(stats.fireOnly)out.push('스킬 피해를 화염으로 전환');if(stats.bloodMagic)out.push('스킬 비용을 생명력으로 지불');if(stats.ironReflexes)out.push('회피를 방어도로 전환');if(stats.chaosImmune)out.push('혼돈 피해에 면역');if(stats.maxLifeOne)out.push('최대 생명력이 1이 됩니다');if(stats.noCritical)out.push('치명타를 가할 수 없습니다');return out;
}
const node=(v:Pick<CoreNode,'id'|'name'|'branch'|'tier'|'x'|'y'|'region'>&Partial<CoreNode>):CoreNode=>{const n={damage:0,reduction:0,cooldown:0,area:0,moreDamage:1,moreArea:1,kind:'small' as const,...v};return {...n,description:v.description??describeStats(n).join(' · ')};};
const polar=(angle:number,radius:number,side=0)=>{const a=angle*Math.PI/180;return {x:1750+Math.cos(a)*radius-Math.sin(a)*side,y:1750+Math.sin(a)*radius+Math.cos(a)*side};};
const branches=['도끼 파괴','도끼 수호','도끼 광역'];
const root=node({id:'root',name:'도끼 숙련의 시작',branch:-1,tier:0,...polar(90,560),region:'axe',kind:'notable',startFor:'hong',description:'홍의 시작점 · 연결된 코어에 포인트를 투자합니다.'});
const main=branches.flatMap((name,b)=>Array.from({length:9},(_,i)=>node({id:`${b}_${i+1}`,name:b===2?(i===8?'광폭한 원호':i%3===2?'확장된 전장':`도끼 범위 ${i+1}`):`${name} ${i+1}`,branch:b,tier:i+1,...polar(90,650+i*80,(b-1)*250),region:'axe',damage:b===0?(i===8?.12:.06):0,reduction:b===1?(i===8?.04:.02):0,cooldown:b===2?.02:0,area:b===2?(i===8?.6:i%3===2?.3:.12):0,kind:i===8?'keystone':i%3===2?'notable':'small',moreDamage:b===2&&i===8?.85:1})));
const satellites=branches.flatMap((name,b)=>Array.from({length:8},(_,i)=>node({id:`${b}_${i+10}`,name:b===2?(i===7?'전장의 지평':`광역 숙련 ${i+1}`):`${name} 숙련 ${i+1}`,branch:b,tier:i+10,...polar(90,730+Math.floor(i/2)*160+(i%2)*80,(b-1)*250+(Math.floor(i/2)%2?-85:85)),region:'axe',damage:b===0?.05:0,reduction:b===1?.015:0,area:b===2?.1:0,kind:i===7?'keystone':i%2?'notable':'small',moreDamage:b===2&&i===7?.8:1,moreArea:b===2&&i===7?1.75:1})));

type Lane={name:string;stats:Partial<PassiveStats>;notable?:Partial<PassiveStats>;key:string;keyName:string;keystone:Partial<PassiveStats>};
const regionLanes:Record<string,readonly Lane[]>={
 agility:[{name:'기동',stats:{movement:.02,cooldown:.008},key:'fleetfoot',keyName:'가벼운 발걸음',keystone:{movement:.12,reduction:-.04}},{name:'빠른 공격',stats:{attackDamage:.04,crit:.004},key:'winddancer',keyName:'바람의 검무',keystone:{attackDamage:.2,block:.08,life:-.08}},{name:'집중 회복',stats:{mana:.035,manaRegen:.04},key:'quickmind',keyName:'기민한 정신',keystone:{cooldown:.12,mana:.2,moreDamage:.9}}],
 duelist:[{name:'근접 숙련',stats:{meleeDamage:.05},key:'bloodpact',keyName:'피의 계약',keystone:{leech:.04,life:-.12}},{name:'생존 본능',stats:{life:.025,regeneration:.001},key:'vitalforce',keyName:'생명의 힘',keystone:{life:.25,regeneration:.01,cooldown:-.04}},{name:'검의 방벽',stats:{block:.012,reduction:.005},key:'ironwill',keyName:'굳건한 의지',keystone:{reduction:.07,moreDamage:.9}}],
 projectile:[{name:'사격 숙련',stats:{projectileDamage:.05},key:'endlessmunitions',keyName:'끝없는 탄약',keystone:{projectiles:2,moreDamage:.85}},{name:'빠른 장전',stats:{cooldown:.012,movement:.01},key:'pointblank',keyName:'집중 사격',keystone:{moreDamage:1.25,moreArea:.75}},{name:'꿰뚫는 화살',stats:{projectileDamage:.035},notable:{pierce:1},key:'ricochet',keyName:'튕기는 화살',keystone:{chain:2,moreDamage:.85}}],
 precision:[{name:'치명적 정밀함',stats:{crit:.008},key:'perfectagony',keyName:'완벽한 고통',keystone:{critMultiplier:.5,moreDamage:.85}},{name:'독의 길',stats:{chaosDamage:.04,dotDamage:.035},key:'toxicmastery',keyName:'맹독의 대가',keystone:{dotDamage:.65,moreDamage:.8}},{name:'그림자 방어',stats:{suppression:.02,energyShield:.025},key:'elusive',keyName:'종잡을 수 없는 그림자',keystone:{suppression:.18,life:-.1}}],
 guard:[{name:'강인함',stats:{life:.03},key:'bloodless',keyName:'피 없는 생명',keystone:{life:.3,cooldown:-.05}},{name:'견고한 갑옷',stats:{reduction:.01,block:.008},key:'bulwark',keyName:'철벽',keystone:{reduction:.12,moreDamage:.8}},{name:'육중한 타격',stats:{physicalDamage:.05},key:'resolute',keyName:'확고한 기술',keystone:{physicalDamage:.3,noCritical:true}}],
 element:[{name:'원소 숙련',stats:{elementalDamage:.05},key:'elementaloverload',keyName:'원소 과부하',keystone:{moreElemental:1.4,noCritical:true}},{name:'삼원소 조화',stats:{fireDamage:.035,coldDamage:.035,lightningDamage:.035},key:'elementalharmony',keyName:'원소의 조화',keystone:{elementalDamage:.25,energyShield:.2,life:-.1}},{name:'신성한 보호',stats:{aura:.04,manaRegen:.035},key:'divineprotection',keyName:'신성한 가호',keystone:{guard:.2,moreDamage:.85}}],
 arcane:[{name:'비전 지식',stats:{spellDamage:.05,mana:.025},key:'arcanesurge',keyName:'비전 쇄도',keystone:{spellDamage:.3,mana:.2}},{name:'에너지 보호막',stats:{energyShield:.05},key:'chaosinoculation',keyName:'카오스 면역 · CI',keystone:{energyShield:.8,chaosImmune:true,maxLifeOne:true}},{name:'공허의 지식',stats:{chaosDamage:.04,dotDamage:.035},key:'ghostreaver',keyName:'공허 포식자',keystone:{leech:.03,energyShield:.3,life:-.15}}],
 balance:[{name:'균형 잡힌 성장',stats:{damage:.025,life:.01,mana:.01},key:'equilibrium',keyName:'균형의 정점',keystone:{damage:.2,life:.1,mana:.1}},{name:'영향력',stats:{area:.05,duration:.04},key:'vastinfluence',keyName:'광대한 영향력',keystone:{moreArea:1.6,moreDamage:.85}},{name:'순환',stats:{regeneration:.002,manaRegen:.04},key:'harmony',keyName:'생명의 순환',keystone:{regeneration:.02,aura:.08,moreDamage:.9}}],
};
const expandedNodes:CoreNode[]=[],expandedEdges:[string,string][]=[];
for(const [regionIndex,start] of CHARACTER_STARTS.slice(1).entries()){
 const branch=regionIndex+3;expandedNodes.push(node({id:start.nodeId,name:start.name,region:start.region,branch,tier:0,...polar(start.angle,560),kind:'notable',startFor:start.id,description:`${start.name}의 시작점 · 다른 영역으로 연결됩니다.`}));
 for(const [laneIndex,lane] of regionLanes[start.region].entries()){
  const ids=Array.from({length:6},(_,i)=>i===5?lane.key:`${start.region}_${laneIndex}_${i+1}`);
  for(let i=0;i<6;i++){const notable=i===2,keystone=i===5,stats=keystone?lane.keystone:{...lane.stats,...(notable?lane.notable:{})};expandedNodes.push(node({id:ids[i],name:keystone?lane.keyName:`${lane.name} ${i+1}`,region:start.region,branch,tier:i+1,...polar(start.angle,700+i*110,(laneIndex-1)*145),...stats,kind:keystone?'keystone':notable?'notable':'small'}));expandedEdges.push([i?ids[i-1]:start.nodeId,ids[i]]);}
 }
 expandedEdges.push([`${start.region}_0_3`,`${start.region}_1_3`],[`${start.region}_1_3`,`${start.region}_2_3`]);
}
const travelNodes:CoreNode[]=[],travelEdges:[string,string][]=[];
for(const [i,start] of CHARACTER_STARTS.entries()){
 const next=CHARACTER_STARTS[(i+1)%CHARACTER_STARTS.length],a=`travel_${i}_1`,b=`travel_${i}_2`;
 for(const [j,id] of [a,b].entries())travelNodes.push(node({id,name:'영역 연결로',region:'travel',branch:11,tier:j+1,...polar(start.angle+(j+1)*40/3,560),life:.01,mana:.01}));
 travelEdges.push([start.nodeId,a],[a,b],[b,next.nodeId]);
}
/** 52 original nodes + eight 19-node areas + eighteen travel nodes = 222. */
const LEGACY_NODES:readonly CoreNode[]=[root,...main,...satellites,...expandedNodes,...travelNodes];
const LEGACY_EDGES:readonly (readonly [string,string])[]=[...branches.flatMap((_,b)=>[
 ...Array.from({length:9},(_,i)=>[i?`${b}_${i}`:'root',`${b}_${i+1}`] as const),
 ...Array.from({length:4},(_,i)=>[[`${b}_${2+i*2}`,`${b}_${10+i*2}`],[`${b}_${10+i*2}`,`${b}_${11+i*2}`],[`${b}_${11+i*2}`,`${b}_${Math.min(9,4+i*2)}`]] as [string,string][]).flat(),
]),...expandedEdges,...travelEdges];
const attributeTree=expandAttributeTree(LEGACY_NODES,LEGACY_EDGES,CHARACTER_STARTS,node);
export const CORE_NODES:readonly CoreNode[]=attributeTree.nodes;
export const CORE_EDGES:readonly (readonly [string,string])[]=attributeTree.edges;
const nodesById=new Map(CORE_NODES.map(n=>[n.id,n])),gemsById=new Map(GEMS.map(g=>[g.id,g])),activesById=new Map(ACTIVE_CATALOG.map(s=>[s.id,s]));
const adjacency=new Map(CORE_NODES.map(n=>[n.id,[] as string[]]));for(const [a,b] of CORE_EDGES){adjacency.get(a)!.push(b);adjacency.get(b)!.push(a);}
const treeCache=new Map<string,ReturnType<typeof resolveJewelTree>>();
export function getBuildTree(build:BuildState|undefined){
 const state=build??newBuild(),key=JSON.stringify([state.start,state.nodes,state.jewels]);let tree=treeCache.get(key);
 if(!tree){tree=resolveJewelTree(CORE_NODES,CORE_EDGES,state,{make:node,describe:describeStats,keys:Object.keys(zero())});if(treeCache.size>=24)treeCache.delete(treeCache.keys().next().value!);treeCache.set(key,tree);}return tree;
}
export const resolveBuildTree=getBuildTree;
export function equipJewel(raw:BuildState,socketId:string,instance:JewelInstance,level=1):BuildState{
 const b=migrateBuild(raw,level);if(b.jewels?.some(p=>p.socketId===socketId))throw Error('장착한 주얼을 먼저 해제하세요.');
 const order=Math.max(0,...(b.jewels??[]).map(p=>p.order))+1;b.jewels=[...(b.jewels??[]),{...instance,socketId,order}];validateBuild(b,level);return b;
}
export function unequipJewel(raw:BuildState,socketId:string,level=1):BuildState{
 const b=migrateBuild(raw,level);if(!b.jewels?.some(p=>p.socketId===socketId))throw Error('이 소켓에 장착한 주얼이 없습니다.');b.jewels=b.jewels.filter(p=>p.socketId!==socketId);if(!b.jewels.length)delete b.jewels;validateBuild(b,level);return b;
}
export function activeSkill(build:Pick<BuildState,'activeIds'|'equipment'>|undefined,index:number):ActiveSkill{
 if(!Number.isInteger(index)||index<0||index>=ACTIVE_SLOTS)throw Error('Invalid active skill');const physical=build?.equipment?equippedItems(build.equipment)[EQUIPMENT_SLOTS[index]]:undefined;
 if(physical&&!physical.gems[0])return {id:'',name:'빈 스킬 슬롯',icon:'',tags:[],description:'장비에 액티브 에르텔을 장착하세요.',baseIndex:index,element:'physical',damage:0,area:0,mana:0};
 const skill=activesById.get(physical?physical.gems[0]!:(build?.activeIds?.[index]??ACTIVE_SKILLS[index].id));if(!skill)throw Error('Invalid active skill');return skill;
}
/** Six stable positions: empty physical sockets have no fallback skill identity or icon. */
export function getActiveSkills(build:Pick<BuildState,'activeIds'|'equipment'>|undefined){return Array.from({length:ACTIVE_SLOTS},(_,slotIndex)=>{const s=activeSkill(build,slotIndex);return {...s,tags:[...s.tags],slotIndex,enabled:!!s.id};});}
/** Upgrade only known v1 saves; valid v2 input is cloned without rewriting its shape. */
export function migrateBuild(raw:unknown,level=1):BuildState{
 if(raw===undefined)return newBuild();const b=structuredClone(raw) as {version:number;weapon:string;nodes:string[];links:unknown[][]};
 if(b?.version===1){if(!Array.isArray(b.links)||b.links.length!==ACTIVE_SLOTS||b.links.some(l=>!Array.isArray(l)||l.length!==3))throw Error('잘못된 이전 젬 연결입니다.');b.version=2;b.weapon='axe';b.links=b.links.map(l=>[...l,null,null]);}
 validateBuild(b,level);return b;
}
export function connected(nodes:readonly string[],start='root',tree?:Pick<ReturnType<typeof getBuildTree>,'nodes'|'edges'>){
 const rootId=CHARACTER_STARTS.find(s=>s.id===start)?.nodeId??start,allowed=new Set(nodes),byId=tree?new Map(tree.nodes.map(n=>[n.id,n])):nodesById;
 if(!allowed.has(rootId)||nodes.some(id=>!byId.has(id)))return false;
 const graph=tree?new Map(tree.nodes.map(n=>[n.id,[] as string[]])):adjacency;if(tree)for(const [a,b] of tree.edges){graph.get(a)!.push(b);graph.get(b)!.push(a);}
 const seen=new Set([rootId]),queue=[rootId];for(let i=0;i<queue.length;i++)for(const id of graph.get(queue[i])??[])if(allowed.has(id)&&!seen.has(id)){seen.add(id);queue.push(id);}return nodes.every(id=>seen.has(id));
}
export function supportsActive(skill:ActiveSkill|string,gemId:string){
 const active=typeof skill==='string'?activesById.get(skill):skill,gem=gemsById.get(gemId);if(!active||!gem)return false;const tags=active.tags;
 return gem.tags.some(t=>tags.includes(t))&&(!gem.requireAll||gem.requireAll.every(t=>tags.includes(t)))&&(!gem.exclude||!gem.exclude.some(t=>tags.includes(t)))&&(!gem.trigger||!active.trigger);
}
function convertActive(active:ActiveSkill,fireOnly:boolean):ActiveSkill{return active.id&&fireOnly&&!active.tags.includes('HEAL')?{...active,element:'fire',tags:[...active.tags.filter(t=>!['PHYSICAL','CHAOS','DARK','COLD','LIGHTNING','HOLY'].includes(t)),'FIRE','ELEMENTAL'] as SkillTag[]}:active;}
export function supports(skill:number,gemId:string,build?:Pick<BuildState,'activeIds'|'equipment'>){if(!Number.isInteger(skill)||skill<0||skill>=ACTIVE_SLOTS)return false;const state=build as BuildState|undefined;return supportsActive(convertActive(activeSkill(build,skill),Array.isArray(state?.nodes)&&passiveBuild(state).fireOnly),gemId);}
export function validateBuild(raw:unknown,level=1):asserts raw is BuildState{
 const b=raw as BuildState;
 if(!b||b.version!==2||b.weapon!=='axe'||b.start!==undefined&&!CHARACTER_STARTS.some(s=>s.id===b.start)||!Array.isArray(b.nodes)||b.nodes.length>buildBudget(level)+1||new Set(b.nodes).size!==b.nodes.length||Array.from(b.nodes).some(n=>typeof n!=='string')||!Array.isArray(b.links)||b.links.length!==ACTIVE_SLOTS)throw Error('잘못된 코어 연결입니다.');
 if(b.equipment){validateEquipmentState(b.equipment);const equipped=equippedItems(b.equipment);for(const slot of EQUIPMENT_SLOTS){const item=equipped[slot],active=item.gems[0]??null;if(item.gems.some((id,i)=>id&&!colorMatches(item,i,id)))throw Error('에르텔과 홈의 색상이 맞지 않습니다.');if(active!==null&&!activesById.has(active))throw Error('첫 소켓에는 액티브 젬만 장착할 수 있습니다.');const supports=item.gems.slice(1).filter((g):g is string=>g!==null);if(supports.some(id=>!gemsById.has(id))||new Set(supports).size!==supports.length)throw Error('잘못된 장비 보조 젬입니다.');if(supports.length&&!active)throw Error('보조 젬에는 같은 장비의 액티브 젬이 필요합니다.');if(active&&supports.some(id=>!supportsActive(convertActive(activesById.get(active)!,passiveBuild(b).fireOnly),id)))throw Error('장비의 액티브와 호환되지 않는 보조 젬입니다.');if(supports.filter(id=>gemsById.get(id)?.trigger).length>1)throw Error('한 스킬에는 발동 보조를 하나만 연결할 수 있습니다.');}}
 const tree=getBuildTree(b);if(tree.spent>buildBudget(level)||!connected(b.nodes,buildStart(b).nodeId,tree))throw Error('포인트가 부족하거나 코어 연결이 끊어집니다.');
 if(b.activeIds!==undefined&&(!Array.isArray(b.activeIds)||b.activeIds.length!==ACTIVE_SLOTS||Array.from(b.activeIds).some(id=>typeof id!=='string'||!activesById.has(id))))throw Error('잘못된 액티브 젬입니다.');
 Array.from(b.links).forEach((link,i)=>{if(!Array.isArray(link)||link.length!==SUPPORT_SOCKETS||Array.from(link).some(g=>g!==null&&(typeof g!=='string'||(b.equipment?!gemsById.has(g):!supports(i,g,b))))||new Set(link.filter(g=>g!==null)).size!==link.filter(g=>g!==null).length)throw Error('잘못된 보조 젬 연결입니다.');if(link.filter(id=>id!==null&&gemsById.get(id)?.trigger).length>1)throw Error('한 스킬에는 발동 보조를 하나만 연결할 수 있습니다.');});
}
export function isBuildAction(action:unknown):action is BuildAction{
 if(typeof action!=='string')return false;if(action==='core-reset')return true;
 const gem=/^gem-([0-5])-([0-4])-([a-z][a-z0-9]*)$/.exec(action);if(gem)return gem[3]==='empty'||gemsById.has(gem[3]);
 const active=/^active-([0-5])-([a-z][a-z0-9]*)$/.exec(action);if(active)return active[2]==='empty'||activesById.has(active[2]);
 const core=/^core-(allocate|refund)-([a-zA-Z0-9_]+)$/.exec(action);if(core)return nodesById.has(core[2])||/^cluster_[a-zA-Z0-9_]{1,64}_[0-9]$/.test(core[2]);
 if(action.startsWith('core-start-'))return CHARACTER_STARTS.some(s=>s.id===action.slice('core-start-'.length));return false;
}
export function changeBuild(raw:BuildState|undefined,action:BuildAction,level=1):BuildState{
 const b=migrateBuild(raw,level);if(!isBuildAction(action))throw Error('잘못된 빌드 명령입니다.');
 if(action.startsWith('gem-')){const [,i,j,id]=action.split('-');if(b.equipment){const item=equippedItems(b.equipment)[EQUIPMENT_SLOTS[Number(i)]],socket=Number(j)+1;if(socket>=item.gems.length)throw Error('장비의 실제 소켓 수를 초과했습니다.');item.gems[socket]=id==='empty'?null:id;}else b.links[Number(i)][Number(j)]=id==='empty'?null:id;}
 else if(action.startsWith('active-')){const [,slot,id]=action.split('-'),i=Number(slot);if(b.equipment){const item=equippedItems(b.equipment)[EQUIPMENT_SLOTS[i]];if(!item.gems.length)throw Error('이 장비에는 홈이 없습니다.');item.gems[0]=id==='empty'?null:id;item.gems=item.gems.map((g,j)=>j===0?g:id!=='empty'&&g!==null&&supports(i,g,b)?g:null);}else{if(id==='empty')throw Error('장비 소켓에서만 액티브를 제거할 수 있습니다.');b.activeIds=getActiveSkills(b).map(s=>s.id);b.activeIds[i]=id;b.links[i]=b.links[i].map(g=>g!==null&&supports(i,g,b)?g:null);}}
 else if(action.startsWith('core-start-')){const start=action.slice('core-start-'.length);if(start==='hong')delete b.start;else b.start=start;b.nodes=[buildStart(b).nodeId];delete b.jewels;}
 else if(action==='core-reset'){b.nodes=[buildStart(b).nodeId];delete b.jewels;}
 else{const [,verb,id]=action.split('-');if(id===buildStart(b).nodeId)throw Error('시작 코어는 변경할 수 없습니다.');if(verb==='allocate'){if(b.nodes.includes(id))throw Error('이미 배운 코어입니다.');b.nodes.push(id);}else{if(!b.nodes.includes(id))throw Error('아직 배우지 않은 코어입니다.');b.nodes=b.nodes.filter(n=>n!==id);}}
 validateBuild(b,level);return b;
}
const multiplicativeKeys=['moreDamage','moreArea','moreElemental'] as const;
const booleanKeys=['chaosImmune','maxLifeOne','noCritical','energyToMana','noRegen','fireOnly','bloodMagic','ironReflexes'] as const;
const additiveKeys=Object.keys(zero()).filter(k=>![...multiplicativeKeys,...booleanKeys].includes(k as any)) as (keyof PassiveStats)[];
const passiveCache=new WeakMap<ReturnType<typeof getBuildTree>,PassiveStats>();
export function passiveBuild(build:BuildState|undefined,weapon='axe'):PassiveStats{
 const state=build?.equipment||weapon==='axe'?build:undefined,tree=getBuildTree(state),cached=!state?.equipment&&passiveCache.get(tree);if(cached)return {...cached};const ids=new Set(state?.nodes??['root']),out=zero(),sources:Partial<PassiveStats>[]=[...tree.nodes.filter(n=>ids.has(n.id)),...tree.jewelStats,...(state?.equipment?[startingIdentity(state.start).stats]:[])];
 if(state?.equipment){const items=Object.values(equippedItems(state.equipment));if(items.some(i=>i.uniqueEffect==='cluster-notables'))sources.push({damage:.15*tree.nodes.filter(n=>ids.has(n.id)&&n.clusterId&&n.kind==='notable').length});}
 for(const n of sources){for(const key of additiveKeys){const value=n[key];if(typeof value==='number')(out[key] as number)+=value;}for(const key of multiplicativeKeys)out[key]*=n[key]??1;for(const key of booleanKeys)out[key]||=n[key]??false;}
 // Attribute scaling is explicit and only affects newly acquired attribute modifiers.
 out.lifeFlat+=out.strength*.5;out.meleeDamage+=out.strength*.002;out.evasion+=out.dexterity*.002;out.attackSpeed+=out.dexterity*.001;out.manaFlat+=out.intelligence*.5;out.energyShield+=out.intelligence*.002;out.elementalDamage+=out.devotion*.001;if(state?.equipment&&Object.values(equippedItems(state.equipment)).some(i=>i.uniqueEffect==='devotion-speed'))out.attackSpeed+=out.devotion*.001;
 if(out.ironReflexes){out.armour+=Math.max(0,out.evasion);out.evasion=0;}if(out.noRegen)out.regeneration=0;
 out.reduction=Math.max(-.3,Math.min(.75,out.reduction));out.cooldown=Math.max(-.5,Math.min(.65,out.cooldown));out.life=Math.max(-.8,out.life);out.block=Math.max(0,Math.min(.75,out.block));out.suppression=Math.max(0,Math.min(.8,out.suppression));out.resistance=Math.max(-.6,Math.min(.75,out.resistance));out.chaosResistance=Math.max(-.6,Math.min(.75,out.chaosResistance));out.tripleChance=Math.min(.5,out.tripleChance);out.dodge=Math.min(.6,out.dodge);out.spellDodge=Math.min(.6,out.spellDodge);out.manaBeforeLife=Math.min(.5,out.manaBeforeLife);out.cull=Math.min(.2,out.cull);if(!state?.equipment)passiveCache.set(tree,{...out});return out;
}
/** No random draws: engine owns clocks, resource spending and event resolution. */
export function compileSkill(build:BuildState|undefined,index:number,weapon='axe'){
 const item=build?.equipment?equippedItems(build.equipment)[EQUIPMENT_SLOTS[index]]:undefined,enabled=!item||!!item.gems[0],source=activeSkill(build,index),p=passiveBuild(build,weapon),active=convertActive(source,p.fireOnly),tags=active.tags,heal=tags.includes('HEAL'),has=(tag:SkillTag)=>tags.includes(tag),elemental=['fire','cold','lightning','holy'].includes(active.element);
 let increased=p.damage+(has('ATTACK')?p.attackDamage:0)+(has('MELEE')?p.meleeDamage:0)+(has('PROJECTILE')?p.projectileDamage:0)+(has('SPELL')?p.spellDamage:0);
 increased+=active.element==='physical'?p.physicalDamage:active.element==='chaos'?p.chaosDamage:0;if(elemental)increased+=p.elementalDamage+(active.element==='fire'?p.fireDamage:active.element==='cold'?p.coldDamage:active.element==='lightning'?p.lightningDamage:0);
 let effect=(active.damage??1)*(heal?1:(1+increased)*p.moreDamage*(elemental?p.moreElemental:1)),area=(active.area??1)*(heal?1:(1+p.area)*p.moreArea),cooldown=(active.cooldown??1)*(1-p.cooldown)/Math.max(.2,1+(has('ATTACK')?p.attackSpeed:has('SPELL')?p.castSpeed:0)),repeats=active.repeat??0;
 let projectiles=has('PROJECTILE')?(active.projectiles??1)+p.projectiles:0,chain=has('PROJECTILE')?(active.chain??0)+p.chain:0,pierce=has('PROJECTILE')?(active.pierce??0)+p.pierce:0;
 let dot=active.dot??0,dotMore=1,crit=(active.crit??0)+p.crit,critMultiplier=1.5+p.critMultiplier,leech=heal?0:p.leech,mana=active.mana??1,duration=(active.duration??1)*(1+p.duration),guard=active.guard??0,aura=active.aura??0;
 let trigger:TriggerKind|null=active.trigger??null,triggerInterval=active.triggerInterval??0;
 const socketSupports=(item?linkedSupports(item):build?.links[index]??[]).filter((id):id is string=>id!==null),builtInSupports=(item?.builtInSupports??[]).filter(id=>supportsActive(active,id)&&!socketSupports.includes(id)),supportIds=[...new Set([...socketSupports,...builtInSupports])];
 for(const id of supportIds){const g=id?gemsById.get(id):undefined;if(!g)continue;effect*=g.more??1;area*=g.area??1;cooldown*=g.cooldown??1;repeats+=g.repeat??0;projectiles+=g.projectiles??0;chain+=g.chain??0;pierce+=g.pierce??0;dot+=g.dot??0;dotMore*=g.dotMore??1;duration*=g.duration??1;crit+=g.crit??0;critMultiplier+=g.critMultiplier??0;leech+=g.leech??0;mana*=g.mana??1;guard+=g.guard??0;if(g.trigger){trigger=g.trigger;triggerInterval=g.triggerInterval??1;}}
 cooldown=Math.max(.35,cooldown);dot*=dotMore*(1+p.dotDamage);guard*=1+p.guard;aura*=1+p.aura;
 return {enabled,slotIndex:index,sourceId:item?.instanceId??`legacy:${index}`,equipmentSlot:EQUIPMENT_SLOTS[index] as EquipmentSlot,supportIds,builtInSupports,effect,area,range:areaRadius(0,area),cooldown,repeats,repeatDelay:.22,heal,activeId:active.id,name:active.name,tags:[...tags],baseIndex:active.baseIndex,element:active.element,projectiles,chain,pierce,dot,dotDuration:(active.dotDuration??3)*duration,crit:p.noCritical?0:Math.max(0,Math.min(.8,crit)),critMultiplier,leech:Math.min(.2,leech),mana:enabled?Math.max(.1,mana):0,duration,guard,aura,trigger,triggerInterval:trigger?Math.max(.25,triggerInterval*cooldown):0,canTriggerEvents:enabled&&trigger===null,lowLifeSpellMore:has('SPELL')?p.lowLifeSpellMore:0,farShot:has('PROJECTILE')?p.farShot:0,tripleChance:p.tripleChance,bloodMagic:p.bloodMagic,cull:p.cull};
}
export type CompiledSkill=ReturnType<typeof compileSkill>;
/** Triggered hits, their repeats and DoTs cannot start another event-triggered cast. */
export function canTriggerFrom(skill:Pick<CompiledSkill,'trigger'>,event:'timed'|'crit'|'hurt'|'hit'|'dot',sourceTriggered=false){return !sourceTriggered&&skill.trigger!==null&&skill.trigger===event;}
export function basicBuild(build:BuildState|undefined,weapon='axe'){const p=passiveBuild(build,weapon);return {effect:(1+p.damage+p.attackDamage+p.meleeDamage+p.physicalDamage)*p.moreDamage,range:areaRadius(p.area,p.moreArea),crit:p.noCritical?0:Math.min(.8,p.crit),critMultiplier:1.5+p.critMultiplier,leech:Math.min(.2,p.leech),attackSpeed:p.attackSpeed,tripleChance:p.tripleChance,cull:p.cull};}
export function buildView(build:BuildState|undefined,level=1){const state=migrateBuild(build,level),passive=passiveBuild(state);return {state,budget:buildBudget(level),remaining:buildBudget(level)-getBuildTree(state).spent,passive,statDescriptions:describeStats(passive),actives:getActiveSkills(state),skills:Array.from({length:ACTIVE_SLOTS},(_,i)=>compileSkill(state,i)),start:buildStart(state),level,tree:getBuildTree(state),grantedSkills:compileGrantedSkills(state),jewels:state.jewels??[],compiled:compileBuild(state)};}
export type BuildView=ReturnType<typeof buildView>;

/** Independent jewel skills have no support sockets and cannot emit trigger events. */
export function compileGrantedSkills(build:BuildState|undefined){return getBuildTree(build).grantedSkills.map(id=>{const source=build??newBuild(),temporary:BuildState={...source,activeIds:getActiveSkills(source).map((s,i)=>i===0?id:s.id),links:source.links.map((l,i)=>i===0?Array<GemId|null>(SUPPORT_SOCKETS).fill(null):l)};if(source.equipment){temporary.equipment=structuredClone(source.equipment);const item=equippedItems(temporary.equipment).weapon;item.gems=[id];item.socketColors=['white'];item.socketLinks=[];item.builtInSupports=[];}const skill=compileSkill(temporary,0);return {...skill,sourceId:`grant:${id}`,sourceActor:skillSourceActor(id),supportIds:[],builtInSupports:[],canTriggerEvents:false,trigger:null,granted:true as const};});}

export type EquipmentSnapshot=Readonly<{slot:EquipmentSlot;instanceId:string;rarity:string;weaponType?:EquipmentWeapon;sockets:readonly (string|null)[];builtInSupports:readonly string[];uniqueEffect?:string}>;
export type CompiledBuild=Readonly<{passive:Readonly<PassiveStats>;basic:Readonly<ReturnType<typeof basicBuild>>;skills:readonly Readonly<CompiledSkill>[];equipment:readonly EquipmentSnapshot[];grantedSkills:readonly Readonly<ReturnType<typeof compileGrantedSkills>[number]>[];conditionalJewels:readonly string[];identity:ReturnType<typeof startingIdentity>;borrowedIdentity:ReturnType<typeof getBuildTree>['borrowedIdentity']}>;
function freezeBuild<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freezeBuild(v);Object.freeze(value);}return value;}
const compiledCache=new Map<string,CompiledBuild>();
/** One immutable equipment/passive/skill contract is consumed by both combat engines. */
export function compileBuild(build:BuildState|undefined,weapon='axe'):CompiledBuild{const state=build??newBuild(),key=JSON.stringify([weapon,state]);let result=compiledCache.get(key);if(result)return result;const tree=getBuildTree(state),items=state.equipment?equippedItems(state.equipment):undefined;result=freezeBuild({passive:passiveBuild(state,weapon),basic:basicBuild(state,weapon),skills:Array.from({length:6},(_,i)=>compileSkill(state,i,weapon)),equipment:items?EQUIPMENT_SLOTS.map(slot=>{const i=items[slot];return {slot,instanceId:i.instanceId,rarity:i.rarity,weaponType:i.weaponType,sockets:[...i.gems],builtInSupports:[...(i.builtInSupports??[])],uniqueEffect:i.uniqueEffect};}):[],grantedSkills:compileGrantedSkills(state),conditionalJewels:[...tree.conditionalJewels],identity:structuredClone(startingIdentity(state.start)),borrowedIdentity:tree.borrowedIdentity?structuredClone(tree.borrowedIdentity):undefined});if(compiledCache.size>=32)compiledCache.delete(compiledCache.keys().next().value!);compiledCache.set(key,result);return result;}
