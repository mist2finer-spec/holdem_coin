/** Web build prototype; not the unrecovered native Umbra balance table. Pure, shared with Unity-ready JSON. */
export type SkillTag='MELEE'|'AREA'|'SPELL'|'PHYSICAL'|'DARK'|'COLD'|'HOLY'|'HEAL';
export const ACTIVE_SKILLS=[
 {id:'rift',name:'대지 균열',tags:['MELEE','AREA','PHYSICAL'],icon:'GroundRift'},
 {id:'dark',name:'암흑 구체',tags:['SPELL','AREA','DARK'],icon:'DarkHole'},
 {id:'frost',name:'서리 폭풍',tags:['SPELL','AREA','COLD'],icon:'Blizzard3'},
 {id:'holy',name:'빛의 심판',tags:['SPELL','AREA','HOLY'],icon:'HolyWrath2'},
 {id:'whirl',name:'회오리',tags:['MELEE','AREA','PHYSICAL'],icon:'Whirlwind'},
 {id:'heal',name:'회복',tags:['HEAL'],icon:'VitalRecovery'},
] as const;
export const GEMS=[
 {id:'power',name:'강타',tags:['PHYSICAL','SPELL'],text:'피해 ×1.30 · 재사용 ×1.15',more:1.3,cooldown:1.15},
 {id:'wide',name:'광역',tags:['AREA'],text:'범위 ×1.40 · 피해 ×0.90',area:1.4,more:.9},
 {id:'echo',name:'메아리',tags:['MELEE','SPELL','HEAL'],text:'0.22초 후 1회 반복 · 각 효과 ×0.65',repeat:1,more:.65},
 {id:'quick',name:'가속',tags:['MELEE','SPELL','HEAL'],text:'재사용 ×0.75 · 각 효과 ×0.90',cooldown:.75,more:.9},
 {id:'reach',name:'도달',tags:['MELEE','SPELL'],text:'범위 ×1.25 · 피해 ×1.08 · 재사용 ×1.10',area:1.25,more:1.08,cooldown:1.1},
 {id:'renew',name:'재생',tags:['HEAL'],text:'회복 ×1.45 · 재사용 ×1.20',more:1.45,cooldown:1.2},
] satisfies {id:string;name:string;tags:string[];text:string;more?:number;area?:number;cooldown?:number;repeat?:number}[];
export type GemId=typeof GEMS[number]['id'];
export type BuildState={version:1;nodes:string[];links:(GemId|null)[][]};
export type BuildAction=`gem-${number}-${number}-${string}`|`core-allocate-${string}`|`core-refund-${string}`|'core-reset';
export const newBuild=():BuildState=>({version:1,nodes:['root'],links:Array.from({length:6},()=>[null,null,null])});
export const buildBudget=(level=1)=>Math.min(27,12+Math.max(0,Math.floor(level)-1));
export type CoreNode={id:string;name:string;branch:number;tier:number;x:number;y:number;damage:number;reduction:number;cooldown:number;area:number};
const branches=['파괴','보호','침식'];
export const CORE_NODES:CoreNode[]=[{id:'root',name:'옴브라의 씨앗',branch:-1,tier:0,x:180,y:40,damage:0,reduction:0,cooldown:0,area:0},...branches.flatMap((name,b)=>Array.from({length:9},(_,i)=>({id:`${b}_${i+1}`,name:`${name} ${i+1}`,branch:b,tier:i+1,x:60+b*120+(i%2?12:-12),y:95+i*52,damage:b===0?(i===8?.12:.06):0,reduction:b===1?(i===8?.04:.02):0,cooldown:b===2?.02:0,area:b===2?.025:0})))];
export const CORE_EDGES:readonly (readonly [string,string])[]=branches.flatMap((_,b)=>Array.from({length:9},(_,i)=>[i?`${b}_${i}`:'root',`${b}_${i+1}`] as const));
export function connected(nodes:readonly string[]){const allowed=new Set(nodes),seen=new Set(['root']);for(let changed=true;changed;){changed=false;for(const [a,b] of CORE_EDGES)if(allowed.has(a)&&allowed.has(b)){if(seen.has(a)&&!seen.has(b)){seen.add(b);changed=true;}if(seen.has(b)&&!seen.has(a)){seen.add(a);changed=true;}}}return nodes.includes('root')&&nodes.every(n=>seen.has(n));}
export function supports(skill:number,gemId:string){const gem=GEMS.find(g=>g.id===gemId);return !!gem&&!!ACTIVE_SKILLS[skill]&&gem.tags.some(t=>(ACTIVE_SKILLS[skill].tags as readonly string[]).includes(t));}
export function validateBuild(raw:unknown,level=1):asserts raw is BuildState{
 const b=raw as BuildState;
 if(!b||b.version!==1||!Array.isArray(b.nodes)||b.nodes.length>buildBudget(level)+1||new Set(b.nodes).size!==b.nodes.length||b.nodes.some(n=>!CORE_NODES.some(c=>c.id===n))||!connected(b.nodes)||!Array.isArray(b.links)||b.links.length!==6)throw Error('잘못된 코어 연결입니다.');
 b.links.forEach((link,i)=>{if(!Array.isArray(link)||link.length!==3||link.some(g=>g!==null&&!supports(i,g))||new Set(link.filter(Boolean)).size!==link.filter(Boolean).length)throw Error('잘못된 보조 젬 연결입니다.');});
}
export function isBuildAction(action:unknown):action is BuildAction{return typeof action==='string'&&/^(gem-[0-5]-[0-2]-(power|wide|echo|quick|reach|renew|empty)|core-(allocate|refund)-(root|[0-2]_[1-9])|core-reset)$/.test(action);}
export function changeBuild(raw:BuildState|undefined,action:BuildAction,level=1){
 const b=structuredClone(raw??newBuild());validateBuild(b,level);if(!isBuildAction(action))throw Error('잘못된 빌드 명령입니다.');
 if(action.startsWith('gem-')){const [,i,j,id]=action.split('-');b.links[Number(i)][Number(j)]=id==='empty'?null:id as GemId;}
 else if(action==='core-reset')b.nodes=['root'];
 else {const [,verb,id]=action.split('-');if(id==='root')throw Error('시작 코어는 변경할 수 없습니다.');if(verb==='allocate'){if(b.nodes.includes(id))throw Error('이미 배운 코어입니다.');b.nodes.push(id);}else{if(!b.nodes.includes(id))throw Error('아직 배우지 않은 코어입니다.');b.nodes=b.nodes.filter(n=>n!==id);}}
 validateBuild(b,level);return b;
}
export function passiveBuild(build:BuildState|undefined){const ids=new Set(build?.nodes??['root']);return CORE_NODES.filter(n=>ids.has(n.id)).reduce((s,n)=>({damage:s.damage+n.damage,reduction:s.reduction+n.reduction,cooldown:s.cooldown+n.cooldown,area:s.area+n.area}),{damage:0,reduction:0,cooldown:0,area:0});}
export function compileSkill(build:BuildState|undefined,index:number){
 if(!ACTIVE_SKILLS[index])throw Error('Invalid active skill');const passive=passiveBuild(build),heal=index===5;let effect=heal?1:1+passive.damage,range=1+passive.area,cooldown=1-passive.cooldown,repeats=0;
 for(const id of build?.links[index]??[]){const g=GEMS.find(g=>g.id===id) as {more?:number;area?:number;cooldown?:number;repeat?:number}|undefined;if(!g)continue;effect*=g.more??1;range*=g.area??1;cooldown*=g.cooldown??1;repeats+=g.repeat??0;}
 return {effect,range,cooldown:Math.max(.35,cooldown),repeats,repeatDelay:.22,heal};
}
export function buildView(build:BuildState|undefined,level=1){const state=structuredClone(build??newBuild());return {state,budget:buildBudget(level),remaining:buildBudget(level)-(state.nodes.length-1),passive:passiveBuild(state),skills:ACTIVE_SKILLS.map((_,i)=>compileSkill(state,i)),level};}
export type BuildView=ReturnType<typeof buildView>;
