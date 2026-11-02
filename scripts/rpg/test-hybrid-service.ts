import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createGameStorage} from '../../src/lib/game-storage';
import {RogueService,type RogueView} from '../../src/lib/rpg-rogue-service';
import {RogueEngine,type RogueInput} from '../../src/components/rpg/rogue/engine';
import {idleLevelCost} from '../../src/components/rpg/idle-progression';
import {traitPoints} from '../../src/components/rpg/hunt-development';
import {HYBRID_BALANCE} from '../../src/components/rpg/hybrid-balance';

process.env.POKER_TEST_MODE='1';
const account='b'.repeat(64),DAY=24*60*60*1000;
const idle:RogueInput={x:0,y:0,auto:false};
// These are the public daily allowance, independent of the per-enemy reward curve.
const XP_CAP=HYBRID_BALANCE.dailyXpCap,GOLD_CAP=HYBRID_BALANCE.dailyGoldCap;

function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'hybrid-service-')),file=path.join(dir,'game.sqlite');
 const a=createGameStorage(file),b=createGameStorage(file),clock={active:0,wall:20*DAY+100000};
 const service=new RogueService(()=>clock.active,()=>111,a.progress,a.items,true,()=>clock.wall);
 return {a,b,clock,service,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};
}
type Fixture=ReturnType<typeof fixture>;
function engine(f:Fixture){return (f.service as unknown as {sessions:Map<string,{game:RogueEngine}>}).sessions.get(account)!.game;}
/** Keep actual skill impact and kill settlement; isolate target placement and durability. */
function targets(f:Fixture,count=1,boss=false){
 const game=engine(f);game.mobs=game.mobs.slice(0,count);
 assert.equal(game.mobs.length,count);
 for(const [i,mob] of game.mobs.entries()){mob.hp=1;mob.x=game.hero.x+50+i*4;mob.y=game.hero.y;mob.until=99999;mob.boss=boss;}
 return game;
}
function kill(f:Fixture,started:RogueView,count=1,boss=false){
 targets(f,count,boss);f.service.command(account,started.id,1,{...idle,skill:0},'idle-socket-starter_weapon-0-rift');
 f.clock.active+=500;return f.service.command(account,started.id,2,idle);
}
function readyExit(service:RogueService){
 const game=(service as unknown as {sessions:Map<string,{game:RogueEngine}>}).sessions.get(account)!.game;
 const internal=game as unknown as {spawnRoom(id:number):void};
 game.room=9;internal.spawnRoom(9);game.mobs=[];game.cleared.add(9);Object.assign(game.hero,game.map.exit);
 return game;
}
function failCommitOnce(db:Fixture['a']['db']){
 const original=db.exec.bind(db);let armed=true;
 (db as unknown as {exec(sql:string):void}).exec=(sql:string)=>{if(sql==='COMMIT'&&armed){armed=false;throw Error('injected hybrid commit failure');}return original(sql);};
 return ()=>{(db as unknown as {exec(sql:string):void}).exec=original;};
}

test('real idle RogueService credits hybrid kill XP, gold and kills exactly once, preserving passive clock',()=>{
 const f=fixture();try{
  const start=f.service.start(account,'hong'),before=f.b.progress.load(account),view=kill(f,start,3);
  assert.equal(view.kills,3);assert.equal(view.progress.kills,before.progress.kills+3);
  assert.ok(view.progression.totalXp>0);assert.ok(view.progression.totalGold>0);
  assert.equal(view.progress.xp,before.progress.xp+view.progression.totalXp);
  assert.equal(view.progress.gold,before.progress.gold+view.progression.totalGold);
  assert.equal(view.progress.hybrid!.dailyXp,view.progression.totalXp);
  assert.equal(view.progress.hybrid!.dailyGold,view.progression.totalGold);
  assert.deepEqual(view.progress.idle,before.progress.idle);
  assert.deepEqual(f.b.progress.load(account).progress,view.progress);
  const committed=f.b.progress.load(account);
  assert.equal(f.service.command(account,start.id,2,{...idle,skill:0}),view);
  assert.deepEqual(f.b.progress.load(account),committed);
  f.clock.active+=20;const after=f.service.command(account,start.id,3,idle);
  assert.equal(after.progress.kills,view.progress.kills);assert.equal(after.progress.gold,view.progress.gold);assert.equal(after.progress.xp,view.progress.xp);
 }finally{f.close();}
});

test('active rewards stop at the daily caps, retain kill count, and reset on the next UTC day',()=>{
 const f=fixture();try{
  f.service.start(account,'hong');const near=f.b.progress.load(account);
  near.progress.hybrid!.dailyXp=XP_CAP-1;near.progress.hybrid!.dailyGold=GOLD_CAP-1;
  f.b.progress.save(account,near.progress,near.revision);
  const first=kill(f,f.service.start(account,'hong'),3);
  assert.equal(first.progress.xp,near.progress.xp+1);assert.equal(first.progress.gold,near.progress.gold+1);
  assert.equal(first.progress.hybrid!.dailyXp,XP_CAP);assert.equal(first.progress.hybrid!.dailyGold,GOLD_CAP);
  const capped=kill(f,f.service.start(account,'hong'),3);
  assert.equal(capped.progress.xp,first.progress.xp);assert.equal(capped.progress.gold,first.progress.gold);
  assert.equal(capped.progress.kills,first.progress.kills+3);
  // Hold passive accrual fixed so this assertion isolates the active daily rollover.
  const next=f.b.progress.load(account);f.clock.wall=(Math.floor(f.clock.wall/DAY)+1)*DAY+1000;
  next.progress.idle!.lastAccruedAt=f.clock.wall;f.b.progress.save(account,next.progress,next.revision);
  const reset=kill(f,f.service.start(account,'hong'),3);
  assert.equal(reset.progress.hybrid!.rewardDay,Math.floor(f.clock.wall/DAY));
  assert.equal(reset.progress.hybrid!.dailyXp,reset.progression.totalXp);
  assert.equal(reset.progress.hybrid!.dailyGold,reset.progression.totalGold);
  assert.ok(reset.progress.xp>capped.progress.xp);assert.ok(reset.progress.gold>capped.progress.gold);
 }finally{f.close();}
});

test('combat XP crosses the recovered level threshold and grants the matching trait point',()=>{
 const f=fixture();try{
  f.service.start(account,'hong');const near=f.b.progress.load(account);near.progress.xp=idleLevelCost(near.progress.level)-1;
  const available=traitPoints(near.progress);f.b.progress.save(account,near.progress,near.revision);
  const view=kill(f,f.service.start(account,'hong'),3);
  assert.equal(view.progress.level,near.progress.level+1);
  assert.equal(traitPoints(view.progress),available+1);assert.equal(view.development.traitPoints,available+1);
  assert.equal(view.progress.xp,view.progression.totalXp-1);
  const spent=f.service.command(account,view.id,3,idle,'trait-7');
  assert.equal(spent.progress.traits[7],1);assert.equal(spent.development.traitPoints,available);
  assert.equal(f.b.progress.load(account).progress.traits[7],1);
 }finally{f.close();}
});

test('winning unlocks exactly one difficulty across retries, later ticks, re-entry and stale simultaneous runs',()=>{
 const f=fixture();try{
  const first=f.service.start(account,'hong');assert.equal(first.progress.hybrid!.dungeonLevel,1);assert.equal(first.progression.dungeonLevel,1);
  const other=new RogueService(()=>f.clock.active,()=>112,f.b.progress,f.b.items,true,()=>f.clock.wall),stale=other.start(account,'hong');
  readyExit(f.service);f.clock.active+=20;const won=f.service.command(account,first.id,1,idle);
  assert.equal(won.status,'won');assert.equal(won.progress.hybrid!.dungeonLevel,2);assert.equal(won.progression.dungeonLevel,1);
  assert.equal(f.service.command(account,first.id,1,idle),won);
  f.clock.active+=20;assert.equal(f.service.command(account,first.id,2,idle).progress.hybrid!.dungeonLevel,2);
  readyExit(other);f.clock.active+=20;assert.equal(other.command(account,stale.id,1,idle).progress.hybrid!.dungeonLevel,2);
  const fresh=f.service.start(account,'hong');assert.equal(fresh.progression.dungeonLevel,2);assert.equal(fresh.progress.hybrid!.dungeonLevel,2);
  assert.equal(f.b.progress.load(account).progress.hybrid!.dungeonLevel,2);
 }finally{f.close();}
});

test('failed kill save rolls back XP, gold, kills and boss item reward; clean re-entry retries once',()=>{
 const f=fixture();try{
  const first=f.service.start(account,'hong');targets(f,1,true);f.service.command(account,first.id,1,{...idle,skill:0},'idle-socket-starter_weapon-0-rift');
  const before=f.b.progress.load(account),items=f.b.items.view(account);
  f.a.db.exec("CREATE TRIGGER reject_hybrid_reward BEFORE UPDATE ON rpg_players BEGIN SELECT RAISE(ABORT,'injected hybrid reward failure'); END;");
  f.clock.active+=500;assert.throws(()=>f.service.command(account,first.id,2,idle),/injected hybrid reward/);
  assert.deepEqual(f.b.progress.load(account),before);assert.deepEqual(f.b.items.view(account),items);
  f.a.db.exec('DROP TRIGGER reject_hybrid_reward');assert.throws(()=>f.service.command(account,first.id,2,idle),/만료/);
  const retry=kill(f,f.service.start(account,'hong'),1,true);
  assert.equal(retry.progress.kills,before.progress.kills+1);
  assert.equal(retry.progress.xp,before.progress.xp+retry.progression.totalXp);
  assert.equal(retry.progress.gold,before.progress.gold+retry.progression.totalGold);
  assert.equal(f.b.items.view(account).orbs,items.orbs+1);
  assert.equal(f.service.command(account,retry.id,2,idle),retry);
  assert.equal(f.b.items.view(account).orbs,items.orbs+1);
 }finally{f.close();}
});

test('failed completion COMMIT rolls back difficulty and invalidates the unpublished win before retry',()=>{
 const f=fixture();try{
  const first=f.service.start(account,'hong');readyExit(f.service);const before=f.b.progress.load(account),restore=failCommitOnce(f.a.db);
  f.clock.active+=20;try{assert.throws(()=>f.service.command(account,first.id,1,idle),/injected hybrid commit/);}finally{restore();}
  assert.deepEqual(f.b.progress.load(account),before);assert.throws(()=>f.service.command(account,first.id,1,idle),/만료/);
  const retry=f.service.start(account,'hong');readyExit(f.service);f.clock.active+=20;
  const won=f.service.command(account,retry.id,1,idle);assert.equal(won.progress.hybrid!.dungeonLevel,2);
  assert.equal(f.service.command(account,retry.id,1,idle),won);assert.equal(f.b.progress.load(account).progress.hybrid!.dungeonLevel,2);
 }finally{f.close();}
});

test('a boss spawned and defeated by a repeated skill within one command grants its first-kill item once',()=>{
 const f=fixture();try{
  const first=f.service.start(account,'hong'),game=engine(f);
  game.room=9;Object.assign(game.hero,game.map.rooms[9].center);
  const internal=game as unknown as {spawnRoom(id:number):void;waves:Map<number,{target:number;spawned:number;killed:number}>};
  internal.spawnRoom(9);game.mobs=game.mobs.filter(m=>m.room===9).slice(0,1);
  const wave=internal.waves.get(9)!;wave.spawned=wave.target-1;wave.killed=wave.target-2;
  const lastNormal=game.mobs[0];lastNormal.hp=1;lastNormal.x=game.hero.x+50;lastNormal.until=99999;
  assert.equal(game.mobs.some(m=>m.boss),false);
  const before=f.b.items.view(account);f.service.command(account,first.id,1,{...idle,skill:0},'idle-socket-starter_weapon-0-rift');
  // Isolate the legal repeat impact timing with enough reach/damage to include the newly spawned boss.
  const motion=game.hero.motion!;motion.build!.repeats=1;motion.build!.range=100;motion.build!.effect=1e6;motion.duration=1;
  f.clock.active+=700;const view=f.service.command(account,first.id,2,idle);
  assert.equal(view.kills,2);assert.equal(view.wave.killed,view.wave.target);
  assert.equal(f.b.items.view(account).orbs,before.orbs+1);
  assert.equal(f.service.command(account,first.id,2,idle),view);assert.equal(f.b.items.view(account).orbs,before.orbs+1);
 }finally{f.close();}
});

test('legacy rows without hybrid fields start at dungeon one and preserve earned character growth',()=>{
 const f=fixture();try{
  f.service.start(account,'hong');const legacy=f.b.progress.load(account).progress;
  legacy.level=120;legacy.xp=123;legacy.gold=456789;legacy.soulGem=9876;legacy.kills=777;
  legacy.attackTraining=37;legacy.healthTraining=29;legacy.traits={7:8,10:4,11:3,12:2};
  legacy.masteryLevel=7;legacy.masteryEssence=452;legacy.willLevel=11;legacy.soulOrb=983;
  legacy.skillLevels=[9,8,7,6,5,4];legacy.skillCopies=[20,21,22,23,24,25];
  delete legacy.hybrid;
  f.b.db.prepare('UPDATE rpg_players SET progress=?,revision=revision+1 WHERE id=?').run(JSON.stringify(legacy),account);
  const migrated=f.service.start(account,'hong');
  assert.equal(migrated.progression.dungeonLevel,1);assert.equal(migrated.progress.hybrid!.dungeonLevel,1);
  const {hybrid,...preserved}=migrated.progress;assert.deepEqual(preserved,legacy);
  assert.deepEqual(hybrid,{version:1,dungeonLevel:1,rewardDay:Math.floor(f.clock.wall/DAY),dailyXp:0,dailyGold:0});
  assert.deepEqual(f.b.progress.load(account).progress,migrated.progress);
  const second=f.service.start(account,'hong');assert.deepEqual(second.progress,migrated.progress);
 }finally{f.close();}
});
