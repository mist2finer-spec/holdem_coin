import profile from './combat-profile.json';
/** Native visual adapter; no animation event applies damage. */
export const HONG_NATIVE_FOOT_SLOTS=['Rleg','Lleg2'] as const;
export const HONG_NATIVE_BODY_SLOTS=['Rleg','Lleg2','body','head','Larm','Rarm'] as const;
export function hongNativeName(action:string){return action==='damage1'?'defeat1':action==='skill6'?'skill5':action==='walk'?'run1':action;}
export function hongNativeContact(action:string,duration:number){
 const stage=profile.combo.find(s=>s.animation===action);
 return Math.max(0,Math.min(duration,stage?.hitAt??duration*.45));
}
