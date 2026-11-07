import {performance} from 'node:perf_hooks';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
const stats=(v:number[])=>{v.sort((a,b)=>a-b);return {samples:v.length,p50:v[Math.floor((v.length-1)*.5)],p95:v[Math.floor((v.length-1)*.95)],p99:v[Math.floor((v.length-1)*.99)],max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length};};
const runs=[];
for(let run=0;run<3;run++){
 const game=new UnityBossEngine(111),step:number[]=[],view:number[]=[],json:number[]=[];
 for(let i=0;i<3000;i++){
  let t=performance.now();game.step(.02,{x:0,y:0,auto:true});step.push(performance.now()-t);
  if(i%5===0){t=performance.now();const state=game.view();view.push(performance.now()-t);t=performance.now();JSON.stringify(state);json.push(performance.now()-t);}
 }
 runs.push({seed:111,simulationSeconds:game.elapsed,room:game.room,stepMs:stats(step),snapshotMs:stats(view),serializeMs:stats(json)});
}
console.log(JSON.stringify({mode:'headless fixed-step, same seed and auto input; not rendering FPS',node:process.version,runs},null,2));
