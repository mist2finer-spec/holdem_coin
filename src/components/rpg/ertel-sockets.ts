/** Web socket policy: legacy equipment stays fully linked/white; new rolls are explicit. */
import {ACTIVE_CATALOG,GEMS} from './build-catalog';
import type {EquipmentInstance} from './idle-equipment';
export type SocketColor='red'|'green'|'blue'|'white';
export const SOCKET_COLORS:SocketColor[]=['red','green','blue','white'];
export const SOCKET_COLOR_LABELS={red:'적색',green:'녹색',blue:'청색',white:'백색'};
export const SOCKET_CRAFT_COST={colors:20,links:50,sockets:40} as const;
export type SocketCraft=keyof typeof SOCKET_CRAFT_COST;
export function ertelColor(id:string):SocketColor{const g=[...ACTIVE_CATALOG,...GEMS].find(g=>g.id===id);if(!g)throw Error('알 수 없는 에르텔입니다.');const tags=g.tags as readonly string[];return tags.includes('PHYSICAL')||tags.includes('MELEE')||tags.includes('GUARD')?'red':tags.includes('BOW')||tags.includes('PROJECTILE')&&!tags.includes('SPELL')?'green':'blue';}
export function socketColor(item:EquipmentInstance,index:number):SocketColor{return item.socketColors?.[index]??'white';}
export function colorMatches(item:EquipmentInstance,index:number,id:string){return socketColor(item,index)==='white'||socketColor(item,index)===ertelColor(id);}
export function socketLinked(item:EquipmentInstance,index:number){return index===0||Array.from({length:index},(_,i)=>item.socketLinks?.[i]??true).every(Boolean);}
export function linkedSupports(item:EquipmentInstance){return item.gems.slice(1).filter((id,i):id is string=>!!id&&socketLinked(item,i+1));}
export function linkSummary(item:EquipmentInstance){if(!item.gems.length)return '0홈 · 연결 없음';let current=1;const groups:number[]=[];for(let i=0;i<item.gems.length-1;i++)if(item.socketLinks?.[i]??true)current++;else{groups.push(current);current=1;}groups.push(current);return `${item.gems.length}홈 · ${groups.join(' + ')}링크`;}
function unit(rng:()=>number){const n=rng();if(!Number.isFinite(n)||n<0||n>=1)throw Error('잘못된 세공 난수입니다.');return n;}
export function rollSocketColors(count:number,rng:()=>number){return Array.from({length:count},()=>{const n=unit(rng);return n<.32?'red':n<.64?'green':n<.96?'blue':'white';}) as SocketColor[];}
export function rollSocketLinks(count:number,rng:()=>number){return Array.from({length:Math.max(0,count-1)},()=>unit(rng)<.35);}
/** Includes zero homes; each count from 0 through the grade/type cap can roll. */
export function rollSocketCount(cap:number,rng:()=>number){return Math.floor(unit(rng)*(cap+1));}
