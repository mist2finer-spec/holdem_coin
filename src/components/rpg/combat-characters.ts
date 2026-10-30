/** Visual-only roster: appearance never selects poker AI or changes combat balance. */
export const COMBAT_CHARACTERS = [
 {id:'boy-hoodie',label:'갈색 후드',portrait:2},
 {id:'white-bob',label:'백발 붉은 드레스',portrait:3},
 {id:'gold-dress',label:'금빛 드레스',portrait:1},
 {id:'black-suit',label:'안경 검은 정장',portrait:4},
 {id:'longhair-man',label:'장발 검은 셔츠',portrait:5},
 {id:'teal-twins',label:'청록 트윈테일',portrait:6},
 {id:'hong',label:'홍',portrait:7},
 {id:'pink-glasses',label:'분홍머리 안경',portrait:8},
 {id:'blonde-office',label:'금발 오피스',portrait:9},
] as const;
export type CombatCharacterId = typeof COMBAT_CHARACTERS[number]['id'];
export function combatCharacter(id:string){return COMBAT_CHARACTERS.find(c=>c.id===id);}
export const SPRITE_CELL=256, SPRITE_FOOT={x:128,y:224};
/** Maps poses to the engine clock; damage remains owned by HuntEngine. */
export function combatSpriteFrame(action:string,time:number,strikeAt=.2){
 if(/run|rush|dash/i.test(action))return 4+Math.floor(Math.max(0,time)/.09)%4;
 if(/avoid/i.test(action))return time<.12?13:14;
 if(/damage|die/i.test(action))return 15;
 const attack=/^attack([1-5])$/.exec(action);
 if(attack){const strike=[9,10,11,12,12][Number(attack[1])-1];return time<strikeAt?8:strike;}
 if(/skill/i.test(action))return time<.12?8:12;
 return Math.floor(Math.max(0,time)/.18)%4;
}

/** Temporary live roster: preserve other assets while Hong jump testing is active. */
export function isHuntPlayable(id:string){return id==='hong';}
