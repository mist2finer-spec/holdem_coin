import type {BuildState,CoreNode,PassiveStats} from './hunt-build';
import {JEWELS_BY_ID,type JewelDefinition} from './jewel-catalog';
export const TIMELESS_RADIUS=310,MAX_LARGE_CLUSTERS=2,MAX_JEWEL_PLACEMENTS=40;
export type JewelInstance={instanceId:string;jewelId:string;seed:number;conqueror?:string};
export type JewelPlacement=JewelInstance&{socketId:string;order:number};
type Helpers={make:(v:any)=>CoreNode;describe:(s:Partial<PassiveStats>)=>string[];keys:readonly string[]};
export type ResolvedBuildTree={nodes:CoreNode[];edges:[string,string][];jewelStats:Partial<PassiveStats>[];grantedSkills:string[];conditionalJewels:string[];transformations:{nodeId:string;jewelId:string;instanceId:string;before:string;after:string}[];spent:number};
function seedHash(seed:number,text:string){let h=seed>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function validateJewelInstance(raw:unknown):asserts raw is JewelInstance{
 const j=raw as JewelInstance,d=JEWELS_BY_ID.get(j?.jewelId);
 if(!j||typeof j.instanceId!=='string'||!/^[a-zA-Z0-9_]{1,64}$/.test(j.instanceId)||!d||!Number.isInteger(j.seed)||j.seed<1||j.seed>10000)throw Error('잘못된 주얼 인스턴스입니다.');
 if(d.variants?!d.variants.includes(j.conqueror??''):j.conqueror!==undefined)throw Error('잘못된 주얼 정복자입니다.');
}
function compatible(socket:CoreNode,jewel:JewelDefinition){return socket.kind==='socket'&&(socket.socketType===jewel.kind||socket.socketType==='unique'&&['normal','unique'].includes(jewel.kind));}
function cleanNode(node:CoreNode,helpers:Helpers,stats:Partial<PassiveStats>){const copy={...node};for(const key of helpers.keys)delete (copy as any)[key];return {...copy,damage:0,reduction:0,cooldown:0,area:0,moreDamage:1,moreArea:1,...stats};}
function transformed(base:CoreNode,jewel:JewelPlacement,helpers:Helpers):CoreNode{
 const notable=base.kind==='notable',stats:Partial<PassiveStats>={};for(const key of helpers.keys){const v=(base as any)[key];if(v!==undefined)(stats as any)[key]=v;}
 let name=base.name,attribute=base.attribute;
 const variant=jewel.conqueror??'',choice=seedHash(jewel.seed,`${variant}:${base.id}`)%3;
 if(jewel.jewelId==='lethalpride'){
  attribute='STR';if(notable){Object.keys(stats).forEach(k=>delete (stats as any)[k]);Object.assign(stats,[{lifeFlat:20,strength:10},{meleeDamage:.2,armour:.1},{attackSpeed:.12,leech:.01}][choice]);name=["Kaom's Will",'Karui Warpath','Karui Fury'][choice];}else stats.strength=(stats.strength??0)+5;
 }else if(jewel.jewelId==='brutalrestraint'){
  attribute='DEX';if(notable){Object.keys(stats).forEach(k=>delete (stats as any)[k]);Object.assign(stats,[{evasion:.15,movement:.05},{dexterity:20,attackSpeed:.1},{projectileDamage:.2,crit:.05}][choice]);name=["Asenath's Heart",'Maraketh Dance','Desert Precision'][choice];}else stats.dexterity=(stats.dexterity??0)+5;
  if(seedHash(jewel.seed,`bonus:${base.id}`)%100<5)stats.movement=(stats.movement??0)+.05;
 }else if(jewel.jewelId==='militantfaith'){
  attribute='INT';if(notable){Object.keys(stats).forEach(k=>delete (stats as any)[k]);Object.assign(stats,[{elementalDamage:.15},{spellDamage:.15,castSpeed:.05},{aura:.15,manaRegen:.1}][choice]);name=["Avarus's Gambit",'Templar Doctrine','Devoted Faith'][choice];}else stats.intelligence=(stats.intelligence??0)+5;stats.devotion=(stats.devotion??0)+5;
 }else if(jewel.jewelId==='eleganthubris'){
  if(notable){Object.keys(stats).forEach(k=>delete (stats as any)[k]);Object.assign(stats,[{attackSpeed:.2},{damage:.3},{energyShield:.3,mana:.2}][choice]);name=["Caspiro's Frenzy",'Emperor’s Ambition','Eternal Splendour'][choice];}stats.tripleChance=(stats.tripleChance??0)+.05;
 }else if(jewel.jewelId==='gloriousvanity'){
  const move=(from:keyof PassiveStats,to:keyof PassiveStats,scale=1)=>{const value=stats[from];if(typeof value==='number'&&value!==0){(stats as any)[to]=((stats as any)[to]??0)+value*scale;delete stats[from];}};
  if(variant==='Doryani'){attribute='DEX';move('intelligence','dexterity');move('strength','dexterity');move('energyShield','evasion');move('shieldFlat','evasion',.001);move('spellDamage','attackSpeed');move('life','evasion');move('lifeFlat','evasion',.001);move('meleeDamage','attackDamage');}
  else {attribute='INT';move('dexterity','intelligence');move('strength','intelligence');move('evasion','energyShield');move('attackDamage','spellDamage');move('meleeDamage','spellDamage');move('physicalDamage','spellDamage');move('attackSpeed','castSpeed');move('life','energyShield');move('lifeFlat','shieldFlat');}
  stats.lifeFlat=(stats.lifeFlat??0)-1;name=`${variant} · ${base.name}`;
 }
 const result=cleanNode(base,helpers,stats);return {...result,name,attribute,transformedBy:jewel.instanceId,originalDescription:base.description,allocationCost:jewel.jewelId==='eleganthubris'&&!notable?2:base.allocationCost??1,description:helpers.describe(stats).join(' · ')};
}
export function resolveJewelTree(baseNodes:readonly CoreNode[],baseEdges:readonly (readonly [string,string])[],build:Pick<BuildState,'nodes'|'jewels'|'start'>,helpers:Helpers):ResolvedBuildTree{
 const placements=build.jewels??[];if(!Array.isArray(placements)||placements.length>MAX_JEWEL_PLACEMENTS)throw Error('주얼 장착 한도를 초과했습니다.');
 const sockets=new Set<string>(),instances=new Set<string>(),orders=new Set<number>();let largeCount=0;
 for(const p of Array.from(placements)){
  validateJewelInstance(p);if(typeof p.socketId!=='string'||!/^\w{1,160}$/.test(p.socketId)||!Number.isSafeInteger(p.order)||p.order<1||orders.has(p.order)||sockets.has(p.socketId)||instances.has(p.instanceId))throw Error('중복되거나 잘못된 주얼 장착입니다.');
  sockets.add(p.socketId);instances.add(p.instanceId);orders.add(p.order);if(JEWELS_BY_ID.get(p.jewelId)!.kind==='large')largeCount++;
 }
 if(largeCount>MAX_LARGE_CLUSTERS)throw Error('대형 군주얼은 최대 2개입니다.');
 const nodes=baseNodes.map(n=>({...n})),edges:[string,string][]=baseEdges.map(([a,b])=>[a,b]),byId=new Map(nodes.map(n=>[n.id,n])),allocated=new Set(build.nodes);
 const pending=[...placements].sort((a,b)=>a.order-b.order),jewelStats:Partial<PassiveStats>[]=[],conditionalJewels:string[]=[],pairs:Partial<Record<'flame'|'flesh',JewelPlacement>>={};
 while(pending.length){let progressed=false;for(let i=0;i<pending.length;i++){
  const p=pending[i],socket=byId.get(p.socketId);if(!socket)continue;const d=JEWELS_BY_ID.get(p.jewelId)!;
  if(!allocated.has(socket.id))throw Error('할당된 소켓에만 주얼을 장착할 수 있습니다.');if(!compatible(socket,d))throw Error('이 소켓에는 해당 종류의 주얼을 장착할 수 없습니다.');
  if(['large','medium','small'].includes(d.kind)){
   const count=d.kind==='large'?10:d.kind==='medium'?5:3,offset=seedHash(p.seed,p.jewelId)%3,selected=d.notables?[d.notables[offset],d.notables[(offset+1)%d.notables.length]]:[],a=Math.atan2(socket.y-1750,socket.x-1750),radius=d.kind==='large'?125:d.kind==='medium'?78:48,center={x:socket.x+Math.cos(a)*(radius+45),y:socket.y+Math.sin(a)*(radius+45)};
   for(let index=0;index<count;index++){
    const id=`cluster_${p.instanceId}_${index}`,isSocket=d.kind==='large'?[4,8].includes(index):d.kind==='medium'&&index===4,isNotable=d.kind==='large'?[2,6].includes(index):index===1,entry=d.kind==='large'?selected[index===2?0:1]:undefined,angle=a+Math.PI+index/count*Math.PI*2,stats=isNotable?(entry?.stats??d.stats??{}):isSocket?{}:d.smallStats??{},grantsSkill=isNotable?entry?.skill:undefined;
    if(byId.has(id))throw Error('중복 군주얼 노드입니다.');const node=helpers.make({id,name:isSocket?`${d.kind==='large'?'중형':'소형'} 군주얼 소켓`:isNotable?entry?.name??d.name:`${d.name} 성장 ${index+1}`,branch:60,tier:index+1,x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius,region:socket.region,attribute:socket.attribute,clusterId:p.instanceId,category:isSocket?'socket':isNotable?'notable':'small',kind:isSocket?'socket':isNotable?'notable':'small',...(isSocket?{socketType:d.kind==='large'?'medium':'small'}:{}),...stats,...(grantsSkill?{grantsSkill}:{})});
    if(grantsSkill)node.description+=` · 추가 스킬: ${grantsSkill} (독립 자동 시전, 젬 슬롯 미사용)`;nodes.push(node);byId.set(id,node);edges.push([index?`cluster_${p.instanceId}_${index-1}`:socket.id,id]);
   }
   if(count>3)edges.push([`cluster_${p.instanceId}_${count-1}`,`cluster_${p.instanceId}_0`]);
  }else if(d.kind!=='timeless'){
   if(d.pair){if(pairs[d.pair])throw Error('Forbidden 주얼은 종류별 1개, 한 쌍만 장착할 수 있습니다.');pairs[d.pair]=p;}
   else if(d.id==='splitpersonality'){
    const graph=new Map(nodes.map(n=>[n.id,[] as string[]]));for(const [a,b] of edges){graph.get(a)!.push(b);graph.get(b)!.push(a);}const root=nodes.find(n=>n.startFor===(build.start??'hong'))!.id,queue=[root],distance=new Map([[root,0]]);for(let k=0;k<queue.length;k++)for(const id of graph.get(queue[k])??[])if(allocated.has(id)&&!distance.has(id)){distance.set(id,distance.get(queue[k])!+1);queue.push(id);}jewelStats.push({life:.05*Math.max(1,Math.min(5,(distance.get(socket.id)??0)/4))});
   }else if(d.id==='watcherseye')conditionalJewels.push(d.id);
   else {jewelStats.push({...d.stats});if(d.kind==='normal')jewelStats.push([{life:.04},{resistance:.04},{mana:.06}][seedHash(p.seed,d.id)%3]);}
  }
  pending.splice(i--,1);progressed=true;
 }if(!progressed)throw Error('군주얼 부모 소켓이 없거나 잘못된 중첩입니다.');}
 if(pairs.flame&&pairs.flesh&&pairs.flame.seed===pairs.flesh.seed)jewelStats.push({life:.12,block:.08});
 const timeless=placements.filter(p=>JEWELS_BY_ID.get(p.jewelId)!.kind==='timeless').sort((a,b)=>a.order-b.order),transformations:ResolvedBuildTree['transformations']=[];
 for(let i=0;i<baseNodes.length;i++){
  const n=baseNodes[i];if(n.startFor||n.kind==='socket'||n.kind==='keystone')continue;
  let winner:JewelPlacement|undefined;for(const p of timeless){const socket=byId.get(p.socketId)!;if(Math.hypot(n.x-socket.x,n.y-socket.y)<=TIMELESS_RADIUS)winner=p;}
  if(winner){nodes[i]=transformed(n,winner,helpers);byId.set(n.id,nodes[i]);transformations.push({nodeId:n.id,jewelId:winner.jewelId,instanceId:winner.instanceId,before:n.description,after:nodes[i].description});}
 }
 const grantedSkills=[...new Set(nodes.filter(n=>allocated.has(n.id)&&n.grantsSkill).map(n=>n.grantsSkill!))].slice(0,4);
 return {nodes,edges,jewelStats,grantedSkills,conditionalJewels,transformations,spent:build.nodes.reduce((total,id)=>{const n=byId.get(id);return total+(n?.startFor===(build.start??'hong')?0:n?.allocationCost??1);},0)};
}
