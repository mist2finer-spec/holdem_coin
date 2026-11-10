// Same combat engines as the server; no economy or network access in this bundle.
import {MountSundayEngine} from './rpg-mount-sunday-engine';
import {UnityBossEngine, type UnityInput} from './rpg-unity-boss-engine';
import {SOURCE_TRAVERSAL} from './rpg-traversal-profile';
let game:MountSundayEngine|UnityBossEngine;
let lastMap:any=null;
let sequence=0;
function profile(raw:string){const p=JSON.parse(raw);game.skillEnabled=Array.from({length:6},(_,i)=>!!p.build?.skills?.[i]?.enabled&&!!p.build.skills[i].activeId&&!p.build.skills[i].trigger);return '';}
function snapshot(){const view:any=game.view();view.localCombat=true;view.training=true;view.sequence=++sequence;view.localProtocol='island-training-local-v1';if(game.map!==lastMap){lastMap=game.map;view.map=game.map;}return JSON.stringify(view);}
function initialize(raw:string){const boot=JSON.parse(raw);if(boot.mode!=='mount'&&boot.mode!=='boss')throw Error('Unknown local training mode');game=boot.mode==='mount'?new MountSundayEngine(boot.seed??111):new UnityBossEngine(boot.seed??111);if(boot.traversalProfile===SOURCE_TRAVERSAL.id)game.traversal=SOURCE_TRAVERSAL;lastMap=null;sequence=0;profile(JSON.stringify(boot));return snapshot();}
function advance(raw:string){const batch=JSON.parse(raw);const input:UnityInput=batch.input;const steps=Math.max(0,Math.min(5,batch.steps|0));if(game instanceof MountSundayEngine)game.acceptClientHints(input);
 game.paused=!!input.paused;
 for(const event of batch.commands??[])if(!input.paused)game.command({...input,...event});
 for(let i=0;i<steps;i++)game.step(.02,input);
 return batch.snapshot?snapshot():'';
}
Object.assign(globalThis,{stageInitialize:initialize,stageAdvance:advance,stageProfile:profile,stageAcknowledge:profile});
