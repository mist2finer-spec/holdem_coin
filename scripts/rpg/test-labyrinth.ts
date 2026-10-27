import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
import {LABYRINTH,classDamage,stageDefinition} from '../../src/components/rpg/hunt-labyrinth';
import {newHuntProgress,DEFAULT_HUNT_BALANCE} from '../../src/components/rpg/hunt-progression';
import {RpgStore} from '../../src/lib/rpg-store';
import {RpgService} from '../../src/lib/rpg-service';
const step=(g:HuntEngine,n:number)=>{for(let i=0;i<n;i++)g.step(.05,0);};
test('all 6000 restored stages retain five sections and valid monster/asset/stat references',()=>{
 assert.equal(LABYRINTH.stages.length,6000);
 for(let i=0;i<6000;i++){const s=stageDefinition(i);assert.equal(s.id,Math.floor(i/5+1)*100+i%5+1);
  for(const row of [...s.normal,s.boss]){assert.ok(row[1]>0&&Number.isFinite(row[1])&&row[2]>0&&Number.isFinite(row[2]));assert.ok(LABYRINTH.assets[LABYRINTH.monsters[row[0]].asset]);}}
 for(const asset of Object.values(LABYRINTH.assets))for(const ext of ['json','atlas','png'])assert.ok(existsSync('public/rpg/'+asset.skeleton+'.'+ext),'Missing monster asset '+asset.skeleton+'.'+ext);
 assert.throws(()=>stageDefinition(6000));assert.throws(()=>stageDefinition(-1));
});
function defeatStage(g:HuntEngine){
 g.setAuto(true);
 for(let i=0;i<12000&&g.stage.phase!=='cleared'&&g.stage.phase!=='complete';i++){g.enemies.forEach(e=>e.hp=0);g.step(.05,0);}
 assert.ok(['cleared','complete'].includes(g.stage.phase));
}
test('scene monsters stay defeated and clearing 1-1 does not invent a midboss',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true});assert.equal(g.stage.remaining,19);const serial=g.enemies[0].serial;g.enemies[0].hp=0;step(g,20);
 assert.equal(g.enemies.find(e=>e.serial===serial)!.hp,0);assert.equal(g.stage.phase,'normal');assert.equal(g.stage.remaining,18);
 defeatStage(g);assert.equal(g.stage.phase,'cleared');assert.equal(g.enemies.some(e=>e.boss),false);
});
test('scene clear awards once, persists checkpoint and section five starts at its spawn area',()=>{
 const p=newHuntProgress(),g=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});
 defeatStage(g);const gold=p.gold;assert.equal(p.labyrinthStage,1);step(g,10);assert.equal(p.gold,gold);
 step(g,35);assert.equal(g.stage.id,102);assert.equal(g.stage.remaining,21);
 const restored=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});assert.equal(restored.stage.id,102);
 p.labyrinthStage=4;const boss=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});assert.equal(boss.stage.section,5);assert.equal(boss.stage.remaining,0);
 boss.setAuto(true);for(let i=0;i<2000&&!boss.stage.remaining;i++)boss.step(.05,0);assert.equal(boss.stage.remaining,1);assert.ok(boss.enemies.some(e=>e.boss));
});
test('final clear stays complete without out-of-bounds transition or repeated payout',()=>{
 const p=newHuntProgress();p.labyrinthStage=5999;const g=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});
 defeatStage(g);const gold=p.gold;step(g,100);assert.equal(g.stage.phase,'complete');assert.equal(p.labyrinthCompleted,1);assert.equal(p.gold,gold);
 const reopened=new HuntEngine(HUNT_RULES.combo,7,{hostile:true,campaign:true,progress:p});assert.equal(reopened.stage.remaining,0);
});
test('normal and boss damage channels remain separate and defense cap applies',()=>{
 assert.equal(classDamage(100,{21:20,161:30,22:80},false),150);
 assert.equal(classDamage(100,{51:20,166:30},false,true),56);
 assert.equal(classDamage(100,{52:110},true,true),10);
});
test('authoritative automatic combat clears finite encounters and checkpoint survives re-entry',()=>{
 const store=new RpgStore(':memory:'),saved=store.load('g');saved.progress.attackTraining=500;store.save('g',saved.progress,saved.revision);
 let now=0;const s=new RpgService(store,DEFAULT_HUNT_BALANCE,()=>now);let v=s.start('g','hong');
 for(let seq=1;seq<1800&&v.progress.labyrinthStage===0;seq++){now+=100;v=s.command('g',v.id,seq,{move:0,attack:false,auto:true});}
 assert.ok(v.progress.labyrinthStage>=1);assert.ok(v.progress.kills>=7);const gold=v.progress.gold;
 const retry=s.command('g',v.id,v.sequence,{move:0,attack:false,auto:true});assert.equal(retry.progress.gold,gold);
 assert.equal(s.start('g','hong').stage.id,102);store.close();
});
