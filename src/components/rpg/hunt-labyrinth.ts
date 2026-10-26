import type {MonsterAttack} from './hunt-actions';
import raw from './data/labyrinth-runtime.json';
export type MonsterAsset={skeleton:string;groundSlots:string[];clips:{idle:string;move:string;attack:string;hurt:string;death:string}};
export type MonsterProfile={name:string;asset:string;visualFallback:boolean;move:number;windup:number;recovery:number;attackSkill:number|null;attackFallback:boolean;skills:number[];aiType:number;keepDistance:number;radius:number};
export type StageMonsterRow=[number,number,number,number,number[],number[]];
export type StageDefinition={id:number;normal:StageMonsterRow[];boss:StageMonsterRow;reward:number[];victory:number;goal:number;objectIds:number[];timeLimit:number;entityObjects:{id:number;category:number;effect:number;value:number;value2:number;globalType:number;globalValue:number;globalType2:number;globalValue2:number}[]};
export const LABYRINTH=raw as unknown as {source:string;encounterLayout:string;stages:StageDefinition[];monsters:Record<string,MonsterProfile>;assets:Record<string,MonsterAsset>;actions:Record<string,MonsterAttack>;ai:Record<string,{min:number;max:number;waitMin:number;waitMax:number}>};
export type LabyrinthView={id:number;chapter:number;section:number;phase:'normal'|'boss'|'cleared'|'complete'|'failed';remaining:number;total:number;nextIn:number;objective:string;goal:number;done:number;remainingTime:number|null;failure:string;objects:{id:number;x:number;done:boolean}[];exitX:number|null;escort:{x:number;hp:number;maxHP:number}|null};
export function stageDefinition(index:number){if(!Number.isInteger(index)||index<0||index>=LABYRINTH.stages.length)throw Error('Invalid labyrinth stage');return LABYRINTH.stages[index];}
/** Recovered class substeps; upstream effects and shields are separate. */
export function classDamage(damage:number,abilities:Record<number,number>,boss:boolean,incoming=false){
 if(!Number.isFinite(damage)||damage<0)throw Error('Invalid damage');
 const ids=incoming?(boss?[52,167]:[51,166]):(boss?[22,162]:[21,161]);
 if(!incoming)return damage*(1+ids.reduce((n,id)=>n+Math.max(0,abilities[id]??0),0)/100);
 return Math.max(damage*.1,ids.reduce((n,id)=>Math.max(0,n-n*(abilities[id]??0)/100),damage));
}
