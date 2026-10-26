import raw from './data/labyrinth-runtime.json';
export type MonsterAsset={skeleton:string;groundSlots:string[];clips:{idle:string;move:string;attack:string;hurt:string;death:string}};
export type MonsterProfile={name:string;asset:string;visualFallback:boolean;move:number;windup:number;recovery:number;attackSkill:number|null;attackFallback:boolean};
export type StageDefinition={id:number;normal:number[][];boss:number[];reward:number[]};
export const LABYRINTH=raw as {source:string;encounterLayout:string;stages:StageDefinition[];monsters:Record<string,MonsterProfile>;assets:Record<string,MonsterAsset>};
export type LabyrinthView={id:number;chapter:number;section:number;phase:'normal'|'boss'|'cleared'|'complete';remaining:number;total:number;nextIn:number};
export function stageDefinition(index:number){if(!Number.isInteger(index)||index<0||index>=LABYRINTH.stages.length)throw Error('Invalid labyrinth stage');return LABYRINTH.stages[index];}
/** Recovered class substeps; upstream effects and shields are separate. */
export function classDamage(damage:number,abilities:Record<number,number>,boss:boolean,incoming=false){
 if(!Number.isFinite(damage)||damage<0)throw Error('Invalid damage');
 const ids=incoming?(boss?[52,167]:[51,166]):(boss?[22,162]:[21,161]);
 if(!incoming)return damage*(1+ids.reduce((n,id)=>n+Math.max(0,abilities[id]??0),0)/100);
 return Math.max(damage*.1,ids.reduce((n,id)=>Math.max(0,n-n*(abilities[id]??0)/100),damage));
}
