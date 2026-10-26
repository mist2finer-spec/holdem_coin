import data from './data/guide10-growth.json';
import {curveValue,type HuntProgress} from './hunt-progression';
export const DEVELOPMENT=data;
export const ABILITY_INFO:Record<number,{name:string;percent:boolean;icon:string;hint:string}>={
 59:{name:'공격력 %',percent:true,icon:'GroundRift',hint:'기본 공격력에 곱해지는 성장 보정'},60:{name:'체력 %',percent:true,icon:'VitalRecovery',hint:'성장 체력에 곱해지는 보정'},
 7:{name:'공격력',percent:false,icon:'GroundRift',hint:'공격 피해의 기본 능력치'},8:{name:'체력',percent:false,icon:'VitalRecovery',hint:'테스트 HP는 10,000으로 유지하며 피해 감소에 반영'},
 17:{name:'일반공격 피해',percent:true,icon:'Whirlwind',hint:'일반 공격의 최종 피해 증가'},18:{name:'스킬 피해',percent:true,icon:'DarkHole',hint:'스킬의 최종 피해 증가'},
 9:{name:'용기',percent:false,icon:'GroundRift',hint:'적과 비교해 물리 피해 보정 · 최대 ±20%'},10:{name:'정신력',percent:false,icon:'DarkHole',hint:'적과 비교해 마법 피해 보정 · 최대 ±20%'},
 11:{name:'집중력',percent:false,icon:'HolyWrath2',hint:'능력치 저장 · 원본 명중 판정 연결 준비 중'},12:{name:'강인함',percent:false,icon:'Blizzard3',hint:'능력치 저장 · 원본 CC 판정 연결 준비 중'},
 25:{name:'공격속도',percent:true,icon:'Whirlwind',hint:'공격 모션과 타격 시점을 함께 빠르게 함'},26:{name:'치명타율',percent:true,icon:'HolyWrath2',hint:'최대 90%'},27:{name:'치명타 피해',percent:true,icon:'GroundRift',hint:'치명타 배율 증가'},
};
export const ABILITY_ORDER=[59,60,7,8,17,18,9,10,11,12,25,26,27];
export const SKILL_INFO=[['대지 균열','GroundRift'],['암흑 구체','DarkHole'],['서리 폭풍','Blizzard3'],['빛의 심판','HolyWrath2'],['회오리','Whirlwind'],['회복','VitalRecovery']] as const;
export function artLevel(p:HuntProgress,id:number){return id===101?p.attackTraining:id===102?p.healthTraining:p.combatArts?.[id]??0;}
export function artLock(p:HuntProgress,row:typeof data.arts[number],level=artLevel(p,row.id)){
 if(row.previousTier&&data.arts.some(a=>a.tier===row.tier-1&&artLevel(p,a.id)<a.max))return '이전 단계 전투술 모두 완료';
 if(row.requires&&artLevel(p,row.requires)<row.requiresLevel)return `${ABILITY_INFO[data.arts.find(a=>a.id===row.requires)!.ability].name} ${row.requiresLevel}레벨 필요`;
 const req=data.artPrerequisites.find(r=>r.Type===row.id&&level>=r.Level&&artLevel(p,r.ReqType)<r.ReqLevel);
 return req?`${ABILITY_INFO[data.arts.find(a=>a.id===req.ReqType)!.ability].name} ${req.ReqLevel}레벨 필요`:'';
}
export function artQuote(p:HuntProgress,id:number,count:number){
 const row=data.arts.find(a=>a.id===id);if(!row||![1,10,100].includes(count))throw Error('잘못된 훈련 요청입니다.');
 const level=artLevel(p,id);let quantity=0,cost=0;
 while(quantity<count&&level+quantity<row.max){if(artLock(p,row,level+quantity))break;const next=curveValue([row.cost],level+quantity+1);if(next<=0||cost+next>p.gold)break;cost+=next;quantity++;}
 return {id,level,max:row.max,quantity,cost,lock:artLock(p,row),nextCost:level>=row.max?0:curveValue([row.cost],level+1)};
}
export function buyArt(p:HuntProgress,id:number,count:number){const q=artQuote(p,id,count);if(!q.quantity)throw Error(q.lock||'골드가 부족하거나 최대 훈련 단계입니다.');p.gold-=q.cost;
 if(id===101)p.attackTraining+=q.quantity;else if(id===102)p.healthTraining+=q.quantity;else p.combatArts[id]=(p.combatArts[id]??0)+q.quantity;
 return q;
}
export function traitPoints(p:HuntProgress){return Math.max(0,(p.level-1)*data.traitPointsPerLevel-Object.values(p.traits??{}).reduce((a,b)=>a+b,0));}
/** Guide-specific 13-node layout: each point equals ten levels of its first matching art. */
export function traitIncrement(ability:number){return data.arts.find(a=>a.ability===ability)!.increment*10;}
export function buyTrait(p:HuntProgress,ability:number){if(!ABILITY_ORDER.includes(ability))throw Error('잘못된 특성입니다.');if((p.traits[ability]??0)>=10)throw Error('특성 최대 레벨입니다.');if(!traitPoints(p))throw Error('특성 포인트가 부족합니다.');p.traits[ability]=(p.traits[ability]??0)+1;}
export function masteryNext(p:HuntProgress){return data.mastery.find(r=>r.level===p.masteryLevel+1);}
export function buyMastery(p:HuntProgress){const next=masteryNext(p);if(!next||p.masteryEssence<next.cost)throw Error('숙련의 정수가 부족하거나 최대 단계입니다.');p.masteryEssence-=next.cost;p.masteryLevel++;}
export function willCost(p:HuntProgress){return p.willLevel>=data.will.max?0:curveValue([data.will.cost],Math.max(1,p.willLevel));}
export function buyWill(p:HuntProgress){const cost=willCost(p);if(!cost||p.soulOrb<cost)throw Error('투혼의 오브가 부족하거나 최대 단계입니다.');p.soulOrb-=cost;p.willLevel++;}
export function skillCost(p:HuntProgress,i:number){return p.skillLevels[i]>=data.skillMax?0:data.skillCopyCosts[p.skillLevels[i]-1];}
export function buySkill(p:HuntProgress,i:number){if(!Number.isInteger(i)||i<0||i>=6)throw Error('잘못된 스킬입니다.');const cost=skillCost(p,i);if(!cost||p.skillCopies[i]<cost)throw Error('동일 스킬 재료가 부족하거나 최대 단계입니다.');p.skillCopies[i]-=cost;p.skillLevels[i]++;}
export function toggleSkill(p:HuntProgress,i:number){if(!Number.isInteger(i)||i<0||i>=6)throw Error('잘못된 스킬입니다.');p.skillEnabled[i]=p.skillEnabled[i]?0:1;}
export function developmentView(p:HuntProgress){return {arts:data.arts.map(a=>({...a,...artQuote(p,a.id,1)})),traitPoints:traitPoints(p),masteryNext:masteryNext(p)??null,willCost:willCost(p),skillCosts:p.skillLevels.map((_,i)=>skillCost(p,i))};}
export function extraAbilities(p:HuntProgress){const r:Record<number,number>={};const add=(id:number,n:number)=>r[id]=(r[id]??0)+n;
 for(const a of data.arts)if(a.id!==101&&a.id!==102)add(a.ability,artLevel(p,a.id)*a.increment);
 for(const a of ABILITY_ORDER)add(a,(p.traits?.[a]??0)*traitIncrement(a));
 const mastery=data.mastery.find(r=>r.level===p.masteryLevel);if(mastery)for(const [id,n] of mastery.abilities)add(id,n);
 for(const [id,n] of data.will.abilities)add(id,(p.willLevel??0)*n);
 return r;
}
