/** The stage service compiles loadouts once; mutable combat still runs in the shared engine. */
const profile=()=> (globalThis as any).__islandStageProfile;
export const newBuild=()=>profile().build;
export const compileBuild=()=>profile().compiled;
export const compileSkill=(_:unknown,index:number)=>profile().compiled.skills[index];
export const basicBuild=()=>profile().compiled.basic;
