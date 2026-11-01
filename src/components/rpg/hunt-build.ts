import {areaRadius} from './combat-big';
/** Web build prototype; not the unrecovered native Umbra balance table. Pure, shared with Unity-ready JSON. */
export type SkillTag='MELEE'|'AREA'|'SPELL'|'PHYSICAL'|'DARK'|'COLD'|'HOLY'|'HEAL'|'AXE'|'ATTACK';
export const ACTIVE_SKILLS=[
 {id:'rift',name:'대지 균열',tags:['MELEE','AREA','PHYSICAL','AXE','ATTACK'],icon:'GroundRift'},
 {id:'dark',name:'암흑 구체',tags:['SPELL','AREA','DARK'],icon:'DarkHole'},
 {id:'frost',name:'서리 폭풍',tags:['SPELL','AREA','COLD'],icon:'Blizzard3'},
 {id:'holy',name:'빛의 심판',tags:['SPELL','AREA','HOLY'],icon:'HolyWrath2'},
 {id:'whirl',name:'회오리',tags:['MELEE','AREA','PHYSICAL','AXE','ATTACK'],icon:'Whirlwind'},
 {id:'heal',name:'회복',tags:['HEAL'],icon:'VitalRecovery'},
] as const;
export const GEMS=[
 {id:'power',name:'강타',tags:['PHYSICAL','SPELL'],text:'피해 ×1.30 · 재사용 ×1.15',more:1.3,cooldown:1.15},
 {id:'wide',name:'광역',tags:['AREA'],text:'범위 면적 ×1.40 · 피해 ×0.90',area:1.4,more:.9},
 {id:'echo',name:'메아리',tags:['MELEE','SPELL','HEAL'],text:'0.22초 후 1회 반복 · 각 효과 ×0.65',repeat:1,more:.65},
 {id:'quick',name:'가속',tags:['MELEE','SPELL','HEAL'],text:'재사용 ×0.75 · 각 효과 ×0.90',cooldown:.75,more:.9},
 {id:'reach',name:'도달',tags:['MELEE','SPELL'],text:'범위 면적 ×1.25 · 피해 ×1.08 · 재사용 ×1.10',area:1.25,more:1.08,cooldown:1.1},
 {id:'renew',name:'재생',tags:['HEAL'],text:'회복 ×1.45 · 재사용 ×1.20',more:1.45,cooldown:1.2},
] satisfies {id:string;name:string;tags:string[];text:string;more?:number;area?:number;cooldown?:number;repeat?:number}[];
export type GemId=typeof GEMS[number]['id'];
export type BuildState={version:2;weapon:'axe';nodes:string[];links:(GemId|null)[][]};
export type BuildAction=`gem-${number}-${number}-${string}`|`core-allocate-${string}`|`core-refund-${string}`|'core-reset';
export const newBuild=():BuildState=>({version:2,weapon:'axe',nodes:['root'],links:Array.from({length:6},()=>[null,null,null,null,null])});
export const buildBudget=(level=1)=>Math.min(51,12+Math.max(0,Math.floor(level)-1));
export type CoreNode={id:string;name:string;branch:number;tier:number;x:number;y:number;damage:number;reduction:number;cooldown:number;area:number;kind:'small'|'notable'|'keystone';moreDamage:number;moreArea:number};
export const SUPPORT_SOCKETS=5;
const branches=['도끼 파괴','도끼 수호','도끼 광역'];
const root:CoreNode={id:'root',name:'도끼 숙련의 시작',branch:-1,tier:0,x:450,y:60,damage:0,reduction:0,cooldown:0,area:0,kind:'notable',moreDamage:1,moreArea:1};
const main=branches.flatMap((name,b)=>Array.from({length:9},(_,i):CoreNode=>({id:`${b}_${i+1}`,name:b===2?(i===8?'광폭한 원호':i%3===2?'확장된 전장':`도끼 범위 ${i+1}`):`${name} ${i+1}`,branch:b,tier:i+1,x:150+b*300,y:140+i*70,damage:b===0?(i===8?.12:.06):0,reduction:b===1?(i===8?.04:.02):0,cooldown:b===2?.02:0,area:b===2?(i===8?.6:i%3===2?.3:.12):0,kind:i===8?'keystone':i%3===2?'notable':'small',moreDamage:b===2&&i===8?.85:1,moreArea:1})));
const satellites=branches.flatMap((name,b)=>Array.from({length:8},(_,i):CoreNode=>({id:`${b}_${i+10}`,name:b===2?(i===7?'전장의 지평':`광역 숙련 ${i+1}`):`${name} 숙련 ${i+1}`,branch:b,tier:i+10,x:150+b*300+(Math.floor(i/2)%2?-88:88),y:210+Math.floor(i/2)*140+(i%2)*70,damage:b===0?.05:0,reduction:b===1?.015:0,cooldown:0,area:b===2?.1:0,kind:i===7?'keystone':i%2?'notable':'small',moreDamage:b===2&&i===7?.8:1,moreArea:b===2&&i===7?1.75:1})));
export const CORE_NODES:CoreNode[]=[root,...main,...satellites];
export const CORE_EDGES:readonly (readonly [string,string])[]=branches.flatMap((_,b)=>[
 ...Array.from({length:9},(_,i)=>[i?`${b}_${i}`:'root',`${b}_${i+1}`] as const),
 ...Array.from({length:4},(_,i)=>[[`${b}_${2+i*2}`,`${b}_${10+i*2}`],[`${b}_${10+i*2}`,`${b}_${11+i*2}`],[`${b}_${11+i*2}`,`${b}_${Math.min(9,4+i*2)}`]] as [string,string][]).flat()
]);
/** Upgrade only known v1 saves; invalid shapes/IDs still fail validation below. */
export function migrateBuild(raw:unknown,level=1):BuildState{
 if(raw===undefined)return newBuild();const b=structuredClone(raw) as unknown as {version:number;weapon:string;nodes:string[];links:unknown[][]};
 if(b?.version===1){const old=b as unknown as {version:number;weapon:string;links:unknown[][]};if(!Array.isArray(old.links)||old.links.length!==6||old.links.some(l=>!Array.isArray(l)||l.length!==3))throw Error('잘못된 이전 젬 연결입니다.');old.version=2;old.weapon='axe';old.links=old.links.map(l=>[...l,null,null]);}
 validateBuild(b,level);return b;
}
export function connected(nodes:readonly string[]){const allowed=new Set(nodes),seen=new Set(['root']);for(let changed=true;changed;){changed=false;for(const [a,b] of CORE_EDGES)if(allowed.has(a)&&allowed.has(b)){if(seen.has(a)&&!seen.has(b)){seen.add(b);changed=true;}if(seen.has(b)&&!seen.has(a)){seen.add(a);changed=true;}}}return nodes.includes('root')&&nodes.every(n=>seen.has(n));}
export function supports(skill:number,gemId:string){const gem=GEMS.find(g=>g.id===gemId);return !!gem&&!!ACTIVE_SKILLS[skill]&&gem.tags.some(t=>(ACTIVE_SKILLS[skill].tags as readonly string[]).includes(t));}
export function validateBuild(raw:unknown,level=1):asserts raw is BuildState{
 const b=raw as BuildState;
 if(!b||b.version!==2||b.weapon!=='axe'||!Array.isArray(b.nodes)||b.nodes.length>buildBudget(level)+1||new Set(b.nodes).size!==b.nodes.length||b.nodes.some(n=>!CORE_NODES.some(c=>c.id===n))||!connected(b.nodes)||!Array.isArray(b.links)||b.links.length!==6)throw Error('잘못된 코어 연결입니다.');
 b.links.forEach((link,i)=>{if(!Array.isArray(link)||link.length!==SUPPORT_SOCKETS||link.some(g=>g!==null&&!supports(i,g))||new Set(link.filter(Boolean)).size!==link.filter(Boolean).length)throw Error('잘못된 보조 젬 연결입니다.');});
}
export function isBuildAction(action:unknown):action is BuildAction{return typeof action==='string'&&/^(gem-[0-5]-[0-4]-(power|wide|echo|quick|reach|renew|empty)|core-(allocate|refund)-(root|[0-2]_(?:[1-9]|1[0-7]))|core-reset)$/.test(action);}
export function changeBuild(raw:BuildState|undefined,action:BuildAction,level=1){
 const b=migrateBuild(raw,level);if(!isBuildAction(action))throw Error('잘못된 빌드 명령입니다.');
 if(action.startsWith('gem-')){const [,i,j,id]=action.split('-');b.links[Number(i)][Number(j)]=id==='empty'?null:id as GemId;}
 else if(action==='core-reset')b.nodes=['root'];
 else {const [,verb,id]=action.split('-');if(id==='root')throw Error('시작 코어는 변경할 수 없습니다.');if(verb==='allocate'){if(b.nodes.includes(id))throw Error('이미 배운 코어입니다.');b.nodes.push(id);}else{if(!b.nodes.includes(id))throw Error('아직 배우지 않은 코어입니다.');b.nodes=b.nodes.filter(n=>n!==id);}}
 validateBuild(b,level);return b;
}
export function passiveBuild(build:BuildState|undefined,weapon='axe'){
 const ids=new Set(weapon==='axe'?build?.nodes??['root']:['root']);return CORE_NODES.filter(n=>ids.has(n.id)).reduce((s,n)=>({damage:s.damage+n.damage,reduction:s.reduction+n.reduction,cooldown:s.cooldown+n.cooldown,area:s.area+n.area,moreDamage:s.moreDamage*n.moreDamage,moreArea:s.moreArea*n.moreArea}),{damage:0,reduction:0,cooldown:0,area:0,moreDamage:1,moreArea:1});
}
export function compileSkill(build:BuildState|undefined,index:number,weapon='axe'){
 if(!ACTIVE_SKILLS[index])throw Error('Invalid active skill');const passive=passiveBuild(build,weapon),heal=index===5;let effect=heal?1:(1+passive.damage)*passive.moreDamage,area=heal?1:(1+passive.area)*passive.moreArea,cooldown=1-passive.cooldown,repeats=0;
 for(const id of build?.links[index]??[]){const g=GEMS.find(g=>g.id===id) as {more?:number;area?:number;cooldown?:number;repeat?:number}|undefined;if(!g)continue;effect*=g.more??1;area*=g.area??1;cooldown*=g.cooldown??1;repeats+=g.repeat??0;}
 return {effect,area,range:areaRadius(0,area),cooldown:Math.max(.35,cooldown),repeats,repeatDelay:.22,heal};
}
export function basicBuild(build:BuildState|undefined,weapon='axe'){const p=passiveBuild(build,weapon);return {effect:(1+p.damage)*p.moreDamage,range:areaRadius(p.area,p.moreArea)};}
export function buildView(build:BuildState|undefined,level=1){const state=migrateBuild(build,level);return {state,budget:buildBudget(level),remaining:buildBudget(level)-(state.nodes.length-1),passive:passiveBuild(state),skills:ACTIVE_SKILLS.map((_,i)=>compileSkill(state,i)),level};}
export type BuildView=ReturnType<typeof buildView>;
