import type {PassiveStats} from './hunt-build';
/** Nine starting core identities. Only Hong is a selectable combat actor. */
export const CHARACTER_IDENTITIES=[
 {characterId:'hong',id:'axe-heart',name:'홍 · 도끼의 심장',stats:{meleeDamage:.15,leech:.01}},
 {characterId:'boy-hoodie',id:'fleet-shadow',name:'후드 · 신속한 그림자',stats:{movement:.1,attackSpeed:.08}},
 {characterId:'white-bob',id:'iron-duelist',name:'백발 · 철벽 연격',stats:{life:.12,block:.08}},
 {characterId:'gold-dress',id:'golden-volley',name:'금빛 · 황금 탄막',stats:{projectileDamage:.15,pierce:1}},
 {characterId:'black-suit',id:'precise-agony',name:'정장 · 정밀한 고통',stats:{crit:.05,dotDamage:.15}},
 {characterId:'longhair-man',id:'steadfast-ward',name:'장발 · 불굴의 수호',stats:{armour:.2,guard:.15}},
 {characterId:'teal-twins',id:'elemental-concord',name:'청록 · 원소의 조화',stats:{elementalDamage:.15,resistance:.05}},
 {characterId:'pink-glasses',id:'arcane-memory',name:'안경 · 비전의 기억',stats:{spellDamage:.15,mana:.15}},
 {characterId:'blonde-office',id:'balanced-purpose',name:'오피스 · 균형의 의지',stats:{damage:.08,regeneration:.003}},
] as const satisfies readonly {characterId:string;id:string;name:string;stats:Partial<PassiveStats>}[];
export type CharacterIdentity=typeof CHARACTER_IDENTITIES[number];
export function startingIdentity(character='hong'):CharacterIdentity{return CHARACTER_IDENTITIES.find(i=>i.characterId===character)??CHARACTER_IDENTITIES[0];}
/** Preserve historic 1..10000 inventory seeds; canonicalization changes only interpretation. */
export function forbiddenSeed(seed:number){return ((seed-1)%8)+1;}
export function forbiddenIdentity(character:string,seed:number):CharacterIdentity{return CHARACTER_IDENTITIES.filter(i=>i.characterId!==startingIdentity(character).characterId)[forbiddenSeed(seed)-1];}
export function skillSourceActor(skillId:string):string{
 if(['vitality','piercingshot','splitarrow','chainarrow','toxicrain'].includes(skillId))return 'gold-dress';
 if(['steelskin','moltenshell'].includes(skillId))return 'longhair-man';
 if(['fireball','icenova','stormcall','flameburst','lightningstrike','hatred'].includes(skillId))return 'teal-twins';
 return 'pink-glasses';
}
