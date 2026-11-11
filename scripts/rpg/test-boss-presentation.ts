import test from 'node:test';import assert from 'node:assert/strict';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import arena from '../../src/lib/generated/zone-ten-arena.json';
test('chase settles into a neutral pose for half a second before hook or skill',()=>{
 const g=new UnityBossEngine(111,{slimeCount:0},arena);g.enterArena();let lastWalk=-100,attacks=0;
 for(let i=0;i<3000;i++){g.step(.02,{x:0,y:0,auto:false});if(g.boss.action==='walk')lastWalk=g.elapsed;if(g.boss.motion&&Math.abs(g.boss.motion.start-g.elapsed)<.001){assert(g.elapsed-lastWalk>=.5);attacks++;}}
 assert(attacks>=2);
});
test('defeated boss remains in place while the full fall animation plays',()=>{
 const g=new UnityBossEngine(111,{slimeCount:0,bossHP:60},arena);g.enterArena();for(let i=0;i<5000&&!g.bossDefeated;i++)g.step(.02,{x:0,y:0,auto:true});assert(g.bossDefeated);
 const {x,y}=g.boss;for(let i=0;i<60;i++){g.step(.02,{x:0,y:0,auto:false});assert(g.view().bossVisible);assert.equal(g.boss.x,x);assert.equal(g.boss.y,y);}
 for(let i=0;i<120;i++)g.step(.02,{x:0,y:0,auto:false});assert.equal(g.view().bossVisible,false);
});
