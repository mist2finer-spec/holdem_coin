export const TRANSCEND_OUTCOMES={power:{name:'증폭',damage:1.2,area:1,mana:1.2},wide:{name:'확장',damage:.95,area:1.3,mana:1.1},pure:{name:'순수',damage:1.12,area:1,mana:1},stable:{name:'안정',damage:1,area:1,mana:1}} as const;
export type TranscendOutcome=keyof typeof TRANSCEND_OUTCOMES;
export type BuildItems={testCollection:true;orbs:number;transcended:Record<string,TranscendOutcome>;revision:number;recent:string[]};
