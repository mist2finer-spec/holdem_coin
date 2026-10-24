import {HUNT_RULES,type ComboStage} from './combat-rules';
/** Provisional training loadouts, NOT reconstructed original weapons/classes. Existing 16 frames reused. */
const traits:Record<string,{name:string;stages:number;power:number;range:number;crit:number}>={
 'boy-hoodie':{name:'기동 훈련',stages:4,power:1,range:50,crit:.12},
 'white-bob':{name:'연격 훈련',stages:5,power:.92,range:48,crit:.18},
 'gold-dress':{name:'원거리 훈련',stages:3,power:1.2,range:85,crit:.08},
 'black-suit':{name:'정밀 훈련',stages:4,power:1.05,range:55,crit:.16},
 'longhair-man':{name:'중격 훈련',stages:3,power:1.3,range:56,crit:.06},
 'teal-twins':{name:'연속기 훈련',stages:5,power:.95,range:55,crit:.14},
 hong:{name:'도끼 기반 훈련',stages:5,power:1,range:48,crit:.1},
 'pink-glasses':{name:'마법 훈련',stages:3,power:1.15,range:90,crit:.1},
 'blonde-office':{name:'균형 훈련',stages:4,power:1.05,range:60,crit:.1},
};
export function huntLoadout(id:string){if(!Object.prototype.hasOwnProperty.call(traits,id))throw Error('Unknown combat character');const t=traits[id];
 return {...t,combo:HUNT_RULES.combo.slice(0,t.stages).map((s,i)=>({...s,damage:Math.round(s.damage*t.power),
  // Hit times remain the recovered Axe schedule until dedicated motion evidence exists.
  animation:s.animation as ComboStage['animation'],hitAt:s.hitAt,duration:s.duration}))};}
