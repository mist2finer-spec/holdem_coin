import Decimal from 'break_infinity.js';
export {Decimal};
export type BigSource=Decimal|number|string;
/** Extended-range floating point, not exact-integer currency arithmetic. */
export function big(value:BigSource){if(typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid combat amount');if(typeof value==='string'&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw Error('Invalid combat amount');const d=new Decimal(value);if(!Number.isFinite(d.m)||!Number.isSafeInteger(d.e)||Math.abs(d.e)>1e9)throw Error('Combat amount out of range');return d;}
export function damageBig(base:BigSource,increased=0,more:readonly number[]=[]){if(!Number.isFinite(increased)||increased< -1||more.some(n=>!Number.isFinite(n)||n<0))throw Error('Invalid combat modifier');let result=big(base);if(result.lt(0))throw Error('Negative base damage');result=result.mul(1+increased);for(const m of more)result=result.mul(m);return result;}
export function areaRadius(increased=0,more=1){if(!Number.isFinite(increased)||increased< -1||!Number.isFinite(more)||more<0)throw Error('Invalid area');return Math.sqrt((1+increased)*more);}
export function amountLabel(value:BigSource):number|string{const d=big(value);return d.abs().lt(1e9)?Math.round(d.toNumber()):`${Math.round(d.m*1000)}e${d.e-3>=0?'+':''}${d.e-3}`;}
export function settleBig(hp:BigSource,maximum:BigSource,damage:BigSource){const h=big(hp),max=big(maximum),d=big(damage);if(h.lt(0)||max.lte(0)||h.gt(max)||d.lt(0))throw Error('Invalid health');const applied=Decimal.min(h,d),remaining=Decimal.max(0,h.sub(applied));return {applied,remaining,killed:h.gt(0)&&remaining.eq(0)};}
/** Decimal authority is never sent as a JS number. Numeric fields are UI/test compatibility projections. */
export type BigVitals={hp:number;maxHP:number;bigHP?:string;bigMaxHP?:string};
const vitals=new WeakMap<object,{hp:Decimal;max:Decimal}>();
export function attachVitals<T extends BigVitals>(actor:T,hp:BigSource=actor.hp,max:BigSource=actor.maxHP):T{
 const state={hp:big(hp),max:big(max)};if(state.hp.lt(0)||state.max.lte(0)||state.hp.gt(state.max))throw Error('Invalid initial health');vitals.set(actor,state);
 const projected=()=>state.max.gt(1e12)||state.max.lt(1e-6);
 Object.defineProperties(actor,{
 hp:{enumerable:true,configurable:true,get:()=>projected()?(state.hp.gt(0)?Math.max(Number.MIN_VALUE,state.hp.div(state.max).toNumber()*10000):0):(state.hp.gt(0)?Math.max(Number.MIN_VALUE,state.hp.toNumber()):0),set:(v:BigSource)=>{const n=big(v);if(n.lt(0))throw Error('Negative HP');state.hp=n;}},
 maxHP:{enumerable:true,configurable:true,get:()=>projected()?10000:state.max.toNumber(),set:(v:BigSource)=>{const n=big(v);if(n.lte(0))throw Error('Invalid maximum HP');state.max=n;}},
 bigHP:{enumerable:true,configurable:true,get:()=>state.hp.toString(),set:(v:BigSource)=>{const n=big(v);if(n.lt(0))throw Error('Negative HP');state.hp=n;}},
 bigMaxHP:{enumerable:true,configurable:true,get:()=>state.max.toString(),set:(v:BigSource)=>{const n=big(v);if(n.lte(0))throw Error('Invalid maximum HP');state.max=n;}}
 });return actor;
}
function health(actor:BigVitals){if(!vitals.has(actor))attachVitals(actor,actor.bigHP??actor.hp,actor.bigMaxHP??actor.maxHP);return vitals.get(actor)!;}
export function hurtBig(actor:BigVitals,damage:BigSource){const s=health(actor),result=settleBig(s.hp,s.max,damage);s.hp=result.remaining;return result;}
export function healBig(actor:BigVitals,amount:BigSource){const s=health(actor),n=big(amount);if(n.lt(0))throw Error('Negative healing');s.hp=Decimal.min(s.max,s.hp.add(n));}
