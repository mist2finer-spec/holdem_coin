import {RogueEngine,type RogueInput} from '../rogue/engine';
// This bundle has no HTTP, filesystem or CLR access. The host supplies only JSON and fixed time steps.
const host=globalThis as any;
host.structuredClone??=((value:unknown)=>JSON.parse(JSON.stringify(value)));
let game:RogueEngine,stage:any,boundary:any=null,snapshotSerial=0;
function profile(value:any){host.__islandStageProfile=value;}
function view(){
 const v=game.view();
 // Large immutable build/compiled payloads are merged once by the host, never copied every frame.
 return {...v,compiled:undefined,rewards:undefined,stageLocal:true,stageBoundary:boundary,localSequence:++snapshotSerial};
}
host.stageInitialize=(json:string)=>{const boot=JSON.parse(json);profile(boot.combat);stage=boot.stage;game=new RogueEngine(boot.seed,undefined,1,stage.difficulty);game.pauseAtRoomBoundary=true;game.build=host.__islandStageProfile.build;game.setGrowth(host.__islandStageProfile.progress);game.transcended=boot.combat.transcended;game.step(0,{x:0,y:0,auto:true});boundary=null;return JSON.stringify({...view(),map:game.map});};
host.stageProfile=(json:string)=>{const p=JSON.parse(json);profile(p.combat);game.build=p.combat.build;game.setGrowth(p.combat.progress);game.transcended=p.combat.transcended;return true;};
host.stageAcknowledge=(json:string)=>{const p=JSON.parse(json);host.stageProfile(json);stage=p.stage;boundary=null;return true;};
host.stageAdvance=(json:string)=>{
 const p=JSON.parse(json),input=p.input as RogueInput;
 if(!boundary){
  for(const command of p.commands??[])game.command({...input,...command});
  for(let i=0;i<p.steps&&!boundary;i++){
   game.step(.02,input);
   if(game.room!==stage.room||game.status!=='playing'){
    boundary={runId:stage.runId,ticket:stage.ticket,room:stage.room,result:game.status==='dead'?'dead':'clear',nextRoom:game.status==='playing'?game.room:null,roomKills:game.kills-stage.settled.kills,totalKills:game.kills,totalGold:game.progression.totalGold,totalXp:game.progression.totalXp,elapsed:game.elapsed};
   }
  }
 }
 return p.snapshot||boundary?JSON.stringify(view()):'';
};
