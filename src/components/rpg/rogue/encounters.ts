/** Guide 123456 prototype balance. Native repeat-wave structure, not an exact Sanctuary DB restoration. */
export type HordeTuning={initial:number;min:number;max:number;seconds:number;batch:number};
export const HORDE:HordeTuning={initial:30,min:150,max:200,seconds:55,batch:8};
export const THEME_SPECIES:Record<string,readonly number[]>={red:[1001],green:[1003],blue:[1002],goblin:[1101,1102],skeleton:[1152,1153],spider:[1201],ember:[1301],boss:[1001,1102,1152]};
export const THEME_LABELS:Record<string,string>={red:'불 슬라임 무리',green:'숲 슬라임 무리',blue:'물 슬라임 무리',goblin:'고블린 전초지',skeleton:'해골 회랑',spider:'거미 소굴',ember:'불의 정령',boss:'군주의 방'};
export const hash=(value:number)=>{let x=value>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return (x^(x>>>16))>>>0;};
export type HordeWave={room:number;target:number;spawned:number;killed:number;enteredAt:number;nextAt:number;bossSpawned:boolean};
export function createWave(seed:number,room:number,now:number,tuning=HORDE):HordeWave{return {room,target:tuning.min+hash(seed^Math.imul(room+1,0x9e3779b9))%(tuning.max-tuning.min+1),spawned:0,killed:0,enteredAt:now,nextAt:now,bossSpawned:false};}
export function waveInterval(w:HordeWave,tuning=HORDE){const normalTarget=w.target-(w.room===9?1:0);return tuning.seconds/Math.max(1,Math.ceil((normalTarget-Math.min(tuning.initial,normalTarget))/tuning.batch));}
/** One-dimensional spatial bins. Allows a packed enemy crowd without quadratic per-frame collision scans. */
export class CrowdIndex<T extends {id:number;x:number;hp:number}>{
 private bins=new Map<number,Set<T>>();private slots=new Map<number,number>();
 constructor(readonly width=32){}
 rebuild(items:readonly T[]){this.bins.clear();this.slots.clear();for(const item of items)if(item.hp>0)this.add(item);}
 private add(item:T){const k=Math.floor(item.x/this.width);let bin=this.bins.get(k);if(!bin)this.bins.set(k,bin=new Set());bin.add(item);this.slots.set(item.id,k);}
 nearby(x:number){const k=Math.floor(x/this.width);return [...(this.bins.get(k-1)??[]),...(this.bins.get(k)??[]),...(this.bins.get(k+1)??[])];}
 moved(item:T){const old=this.slots.get(item.id),next=Math.floor(item.x/this.width);if(old===next)return;if(old!==undefined)this.bins.get(old)?.delete(item);this.add(item);}
}
