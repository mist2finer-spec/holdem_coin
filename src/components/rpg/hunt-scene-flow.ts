import raw from './data/scene-flow-runtime.json';
import type {StageMonsterRow} from './hunt-labyrinth';
export type SceneSpawn={id:number;name:string;x:number};
export type SceneWave={id:number;waveNo:number;spawns:number[];delay:number;repeat:boolean;interval:number;count:number};
export type SceneTrigger={type:number;targets:number[];deps:number[];x:number;radius:number};
export type SceneLayout={source:string;mapKey:number[];root:string;axis:string;startX:number;unusedSpawnDefinitions?:number;spawns:SceneSpawn[];waves:SceneWave[];triggers:SceneTrigger[]};
export type SceneBinding={layout:string;roster:Record<string,{row:StageMonsterRow;boss:boolean}>};
const data=raw as unknown as {layouts:Record<string,SceneLayout>;stages:Record<string,SceneBinding>};
export function sceneBinding(stageId:number){const binding=data.stages[stageId];return binding?{binding,layout:data.layouts[binding.layout]}:null;}
export function sceneCoverage(){return {layouts:Object.keys(data.layouts).length,stages:Object.keys(data.stages).length};}
type WaveState={started:boolean;ended:boolean;timer:number;count:number};
/** Native wave timing with a bounded, explicit web projection of start/area/clear messages. */
export class SceneFlow {
 private states=new Map<number,WaveState>();private fired=new Set<number>();private lastX:number;
 constructor(readonly layout:SceneLayout){this.lastX=layout.startX;for(const w of layout.waves)this.states.set(w.id,{started:false,ended:false,timer:0,count:0});}
 get complete(){return this.states.size>0&&[...this.states.values()].every(s=>s.ended);}
 get nextAreaX(){return this.layout.triggers.find((t,i)=>t.type===20&&!this.fired.has(i)&&t.targets.some(id=>!this.states.get(id)?.started))?.x;}
 get startedCount(){return [...this.states.values()].filter(s=>s.started).length;}
 step(dt:number,x:number,alive:(waveId:number)=>boolean,spawn:(point:SceneSpawn,waveId:number)=>void){
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(x))throw Error('Invalid scene update');
  for(let i=0;i<this.layout.triggers.length;i++){
   if(this.fired.has(i))continue;const t=this.layout.triggers[i];
   const reached=t.type===10||t.type===40&&t.deps.length>0&&t.deps.every(id=>this.states.get(id)?.ended)
    ||t.type===20&&Math.min(this.lastX,x)<=t.x+t.radius&&Math.max(this.lastX,x)>=t.x-t.radius;
   if(!reached)continue;this.fired.add(i);
   for(const id of t.targets){const s=this.states.get(id),w=this.layout.waves.find(w=>w.id===id);if(s&&w&&!s.started){s.started=true;s.timer=Math.fround(w.delay);}}
  }
  this.lastX=x;
  // One update per wave. No catch-up loop or recursive trigger dispatch.
  for(const w of this.layout.waves){const s=this.states.get(w.id)!;if(!s.started||s.ended)continue;
   if(s.timer>0){s.timer=Math.max(0,Math.fround(s.timer-Math.fround(dt)));continue;}
   if(s.count<(w.repeat?w.count:1)){
    for(const id of w.spawns){const point=this.layout.spawns.find(p=>p.id===id);if(!point)throw Error('Unresolved scene spawn');spawn(point,w.id);}
    s.count++;s.timer=w.repeat?Math.fround(w.interval):-1;continue;
   }
   if(!alive(w.id))s.ended=true;
  }
 }
}
