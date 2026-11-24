// Same combat engines as the server; no economy or network access in this bundle.
import {linkedElementSupports,ertelOf} from './rpg-elemental-combat';
import {MountSundayEngine} from './rpg-mount-sunday-engine';
import {UnityBossEngine, type UnityInput} from './rpg-unity-boss-engine';
import {SOURCE_TRAVERSAL} from './rpg-traversal-profile';
import {heroKitFor} from './rpg-hero-kit-iai';
let game:MountSundayEngine|UnityBossEngine;
let lastMap:any=null;
let sequence=0;
function profile(raw:string){const p=JSON.parse(raw);game.skillSupportCounts=Array.from({length:6},(_,i)=>linkedElementSupports(p.build?.skills?.[i]));game.skillIds=Array.from({length:6},(_,i)=>p.build?.skills?.[i]?.activeId??'');game.skillEnabled=Array.from({length:6},(_,i)=>!!p.build?.skills?.[i]?.enabled&&!!p.build.skills[i].activeId&&!p.build.skills[i].trigger);return '';}
function snapshot(){const view:any=game.view();view.localCombat=true;view.training=true;view.sequence=++sequence;view.localProtocol='island-training-local-v1';if(game.map!==lastMap){lastMap=game.map;view.map=game.map;}return JSON.stringify(view);}
function initialize(raw:string){const boot=JSON.parse(raw);if(boot.mode!=='mount'&&boot.mode!=='boss')throw Error('Unknown local training mode');game=boot.mode==='mount'?new MountSundayEngine(boot.seed??111,undefined,boot.referencePreview===true?boot.previewZone??0:0):new UnityBossEngine(boot.seed??111);if(boot.traversalProfile===SOURCE_TRAVERSAL.id)game.traversal=SOURCE_TRAVERSAL;if(game instanceof MountSundayEngine)game.heroKit=heroKitFor(boot.heroKit);if(game instanceof MountSundayEngine&&boot.kitTempo!==undefined)game.setKitTempo(boot.kitTempo);if(boot.bossHero==='legacy'&&game instanceof MountSundayEngine)game.bossHeroLegacy=true;if(game instanceof UnityBossEngine&&boot.bossHero!=='legacy'){game.heroKit=heroKitFor(boot.heroKit);if(boot.kitTempo!==undefined)game.setKitTempo(boot.kitTempo);}if(game instanceof MountSundayEngine)game.syncBoss();if(typeof boot.bossStartHP==='number'){if(game instanceof MountSundayEngine)game.setBossStartHP(boot.bossStartHP);else game.setStartHP(boot.bossStartHP);}if(boot.autoSkills===true)game.autoSkills=true;if(boot.forks?.enabled===true&&game instanceof MountSundayEngine)game.enableForks(boot.forks.seed);if(boot.referencePreview===true&&boot.previewArena===true&&game instanceof UnityBossEngine)game.enterArena();
// Ertel (maintenance/ertel-electric-20261123): boot `ertel` ('electric' | null) wins; else the practice boot (referencePreview) equips 'electric'.
game.setErtel(ertelOf(boot.ertel)!==undefined?boot.ertel:boot.referencePreview===true?'electric':null);lastMap=null;sequence=0;profile(JSON.stringify(boot));return snapshot();}
function advance(raw:string){const batch=JSON.parse(raw);const input:UnityInput=batch.input;const steps=Math.max(0,Math.min(5,batch.steps|0));if(game instanceof MountSundayEngine)game.acceptClientHints(input);
 game.paused=!!input.paused;
 // The ertel toggle (menu) is taken while paused too; every other command only when not paused (as before).
 for(const event of batch.commands??[])if(!input.paused||event?.ertel!==undefined)game.command({...input,...event});
 for(let i=0;i<steps;i++)game.step(.02,input);
 return batch.snapshot?snapshot():'';
}
Object.assign(globalThis,{stageInitialize:initialize,stageAdvance:advance,stageProfile:profile,stageAcknowledge:profile});
