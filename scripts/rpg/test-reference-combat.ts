import test from 'node:test';import assert from 'node:assert/strict';
import {MountSundayEngine,MOUNT_RULES} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import {skillContains} from '../../src/lib/rpg-reference-skills';
const idle={x:0,y:0,auto:false};
function arena(){const g=new MountSundayEngine();g.readyZone=0;g.spawned=30;g.groundAt=()=>0;g.hero.elevation=0;return g;}
function mob(g:MountSundayEngine,id:number,x:number,y=0){return {id,x:g.hero.x+x,y:g.hero.y+y,elevation:0,hp:1000,maxHP:1000,radius:12.5,bodyHeight:31,state:'idle',room:0,nextAttack:999};}
test('auto approach dashes only inside its distance band; manual movement never starts one',()=>{
 for(const [distance,auto,expected] of [[600,true,false],[300,true,true],[140,true,false],[70,true,false],[300,false,false]] as const){const g=arena();g.mobs=[mob(g,1,distance)];g.step(.02,{...idle,auto});assert.equal(g.hero.motion?.kind==='rush',expected,`${distance}/${auto}`);}
 const g=arena();g.mobs=[mob(g,1,300)];g.step(.02,{...idle,auto:true});assert.equal(g.hero.action,'dash');const start=g.hero.x;for(let i=0;i<18;i++)g.step(.02,idle);assert(g.hero.x>start+100);assert(Math.hypot(g.hero.x-g.mobs[0].x,g.hero.y-g.mobs[0].y)>=32.5);g.mobs=[mob(g,2,300)];g.step(.02,{...idle,auto:true});assert.notEqual(g.hero.motion?.kind,'rush');
});
test('a low sword sweep hits every intersecting row once and misses enemies beyond its reach',()=>{
 const g=arena();g.mobs=[mob(g,1,60,-35),mob(g,2,70,0),mob(g,3,60,35),mob(g,4,260,0)];const targets=[...g.mobs];
 assert(g.command({...idle,x:1,attack:true}));for(let i=0;i<29;i++)g.step(.02,idle);
 assert.deepEqual(targets.map(m=>m.hp),[940,940,940,1000]);assert.equal(new Set(g.fx.filter(f=>f.kind==='damage').map(f=>f.target)).size,3);
});
test('gem identity selects the skill even in a different slot; cooldown, mana, pause and unequip gate casts',()=>{
 const g=arena();g.skillIds[4]='stormcall';g.skillEnabled[4]=true;g.mobs=[mob(g,1,180,-70),mob(g,2,190,70),mob(g,3,700,0)];const targets=[...g.mobs];
 assert(g.command({...idle,skill:4}));assert.equal(g.hero.action,'skill2');assert.equal(g.hero.motion.skillId,'storm-call');assert.equal(g.resources.mana,935);
 for(let i=0;i<25;i++)g.step(.02,idle);assert.deepEqual(targets.map(m=>m.hp),[820,820,1000]);assert.equal(g.fx.filter(f=>f.kind==='skill-impact').length,1);
 for(let i=0;i<25;i++)g.step(.02,idle);assert(!g.command({...idle,skill:4}));g.cooldowns[4]=0;g.skillEnabled[4]=false;assert(!g.command({...idle,skill:4}));g.skillEnabled[4]=true;g.resources.mana=64;assert(!g.command({...idle,skill:4}));g.resources.mana=100;assert(!g.command({...idle,skill:4,paused:true}));
});
test('quarter-view skill aims along depth and emits one world-space impact at the locked target',()=>{
 const g=new UnityBossEngine(111,{slimeCount:0,bossHP:1000});g.enterArena();g.hero.x=g.boss.x;g.hero.y=g.boss.y-450;g.skillIds[2]='stormcall';g.skillEnabled[2]=true;
 assert(g.command({...idle,skill:2}));assert.equal(g.hero.action,'skill2');assert(g.hero.direction.y>.99);const target={...g.hero.motion!.target!};
 for(let i=0;i<26;i++)g.step(.02,idle);assert.equal(g.boss.hp,820);const impact=g.fx.find(f=>f.kind==='skill-impact');assert(impact);assert.equal(impact.x,target.x);assert.equal(impact.z,target.y);assert.equal(g.view().cameraMode,'QuarterView');
 assert(skillContains({x:target.x+100,y:target.y+100},target,240));assert(!skillContains({x:target.x,y:target.y+300},target,240));
});
test('gold cleave turns toward a nearby pack behind the hero and damages each enemy once',()=>{
 const g=arena();g.skillIds[0]='cleave';g.skillEnabled[0]=true;g.mobs=[mob(g,1,-150,-30),mob(g,2,-170,0),mob(g,3,-150,30)];const targets=[...g.mobs];
 assert(g.command({...idle,skill:0}));assert.equal(g.hero.facing,-1);assert.equal(g.hero.action,'skill1');for(let i=0;i<45;i++)g.step(.02,idle);assert.deepEqual(targets.map(m=>m.hp),[850,850,850]);
});
test('packs have actual depth, never exceed the visible cap, and cannot spawn outside the bridge deck',()=>{
 for(const zone of [1,4]){const g=new MountSundayEngine(111,undefined,zone);g.readyZone=zone;for(let i=0;i<350;i++)g.step(.02,idle);assert.equal(g.mobs.length,MOUNT_RULES.activeCap);assert(new Set(g.mobs.map(m=>Math.round(m.y))).size>=3);for(const m of g.mobs)assert(Math.abs(m.y-5000-g.centerZ(m.x)*100)<=g.zone.halfWidth*100-18+.001);}
});
