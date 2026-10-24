import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
import {huntLoadout} from '../../src/components/rpg/hunt-loadouts';
import {COMBAT_CHARACTERS} from '../../src/components/rpg/combat-characters';
import {curveValue,awardHuntKill,newHuntProgress,upgradeHunt,HUNT_QUESTS,DEFAULT_HUNT_BALANCE as balance} from '../../src/components/rpg/hunt-progression';
import {RpgStore} from '../../src/lib/rpg-store';
import {RpgService,parseHuntInput} from '../../src/lib/rpg-service';
const input={move:0,attack:false,auto:false};
const advance=(g:HuntEngine,seconds:number)=>{for(let t=0;t<seconds;t+=.01)g.step(.01,0);};
test('hostile enemy telegraphs, deals delayed damage, kills hero and safe revival restores input',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});g.enemyX=g.x+40;
 g.step(.01,0);assert.equal(g.hp,g.maxHP);advance(g,1.1);assert.equal(g.enemies[0].state,'windup');assert.equal(g.hp,g.maxHP);
 advance(g,.6);assert.ok(g.hp<g.maxHP);g.hp=1;advance(g,2.1);assert.equal(g.hp,0);assert.equal(g.action,'die1');
 assert.equal(g.attack(),false);assert.equal(g.revive(),false);advance(g,2.1);assert.equal(g.revive(),true);assert.equal(g.hp,g.maxHP);
 assert.ok(g.enemies.every(e=>Math.abs(e.x-g.x)>=36));
});
test('dodge avoids a telegraphed hit; monster movement cannot pass through hero or occupy a roll origin',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});g.enemyX=g.x+40;advance(g,1.1);g.dodge(-1);advance(g,.5);assert.equal(g.hp,g.maxHP);
 const h=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});h.enemyX=h.x+200;advance(h,4);assert.ok(h.enemyX-h.x>=36-1e-6);
});
test('nine training loadouts reuse valid frames and retain 3/4/5 hit variation',()=>{
 const counts=new Set<number>();for(const c of COMBAT_CHARACTERS){const p=huntLoadout(c.id);counts.add(p.combo.length);assert.doesNotThrow(()=>new HuntEngine(p.combo,7,{hostile:true,range:p.range,crit:p.crit}));}
 assert.deepEqual([...counts].sort(),[3,4,5]);assert.throws(()=>huntLoadout('../bad'));
});
test('native floors and half-open segments match known values; missing curve is never a free upgrade',()=>{
 assert.equal(curveValue(balance.team,1),1000);assert.equal(curveValue(balance.team,2),1107);assert.equal(curveValue(balance.weapon,10),92);assert.equal(curveValue(balance.team,50),0);
 const p=newHuntProgress();p.xp=995;awardHuntKill(p,balance);assert.equal(p.level,2);assert.equal(p.xp,7);assert.equal(p.kills,1);
 p.soulGem=100;const cost=upgradeHunt(p,balance,'weapon');assert.equal(cost,40);assert.equal(p.weaponLevel,2);assert.equal(p.soulGem,60);
 p.weaponLevel=50;assert.throws(()=>upgradeHunt(p,balance,'weapon'));assert.equal(p.soulGem,60);
});
test('SQLite revision protects concurrent accounts and persists after closing/reopening',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rpg-save-'));try{const file=path.join(dir,'save.sqlite'),store=new RpgStore(file),a=store.load('guest');a.progress.gold=99;
  assert.equal(store.save('guest',a.progress,a.revision),1);assert.throws(()=>store.save('guest',a.progress,0));store.close();
  const next=new RpgStore(file);assert.equal(next.load('guest').progress.gold,99);assert.equal(next.load('other').progress.gold,0);next.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('server controls time and rewards, rejects out-of-order requests and deduplicates retries',()=>{
 const store=new RpgStore(':memory:');let now=0;const service=new RpgService(store,balance,()=>now);let view=service.start('guest','hong');
 let seq=0;for(let i=0;i<160;i++){now+=100;view=service.command('guest',view.id,++seq,{...input,auto:true});}
 assert.ok(view.progress.kills>0);const savedGold=view.progress.gold;
 assert.deepEqual(service.command('guest',view.id,seq,{...input,auto:true}),view);assert.equal(store.load('guest').progress.gold,savedGold);
 const elapsed=view.elapsed;view=service.command('guest',view.id,++seq,{...input,auto:true});assert.equal(view.elapsed,elapsed);
 now+=100000;view=service.command('guest',view.id,++seq,input);assert.ok(view.elapsed-elapsed<=.300001);
 assert.throws(()=>service.command('guest',view.id,seq+2,input));
 const old=view.id;service.start('guest','white-bob');assert.throws(()=>service.command('guest',old,seq+1,input));store.close();
});
test('client cannot submit rewards or invalid movement/actions',()=>{
 assert.deepEqual(parseHuntInput({...input,gold:999,kills:999}),{...input,basic:undefined,skill:undefined,dodge:undefined,parry:undefined});
 for(const value of [{...input,move:NaN},{...input,move:2},{...input,skill:6},{...input,dodge:4}])assert.throws(()=>parseHuntInput(value));
});
test('insufficient upgrade does not consume a sequence or discard subsequent combat rewards',()=>{
 const store=new RpgStore(':memory:');let now=0;const service=new RpgService(store,balance,()=>now),v=service.start('guest','hong');now=200;
 assert.throws(()=>service.command('guest',v.id,1,input,'weapon'));const result=service.command('guest',v.id,1,input);assert.equal(result.sequence,1);assert.equal(result.progress.soulGem,0);store.close();
});
test('server upgrade charges once, raises combat stats and survives re-entry',()=>{
 const store=new RpgStore(':memory:'),saved=store.load('guest');saved.progress.soulGem=100;store.save('guest',saved.progress,saved.revision);
 const service=new RpgService(store,balance,()=>0),v=service.start('guest','hong');
 const result=service.command('guest',v.id,1,input,'weapon');assert.equal(result.progress.weaponLevel,2);assert.equal(result.progress.soulGem,60);
 assert.deepEqual(service.command('guest',v.id,1,input,'weapon'),result);const next=service.start('guest','pink-glasses');assert.equal(next.progress.soulGem,60);assert.equal(next.progress.weaponLevel,2);store.close();
});
test('respawn cannot introduce a fourth blocker or occupy the origin during a dodge',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,2,{hostile:true});g.x=500;g.enemies[0].x=540;g.enemies[1].x=500;g.enemies[1].hp=0;g.enemies[1].respawnAt=0;
 g.dodge(1);advance(g,.4);assert.equal(g.enemies[1].hp,0);advance(g,.3);assert.ok(g.enemies.every(e=>e.hp<=0||Math.abs(e.x-g.x)>=36-1e-6));
});
test('legacy guest rows gain inventory fields without resetting earned balances',()=>{
 const store=new RpgStore(':memory:');store.load('old');store.db.prepare('UPDATE rpg_players SET progress=? WHERE id=?').run(JSON.stringify({level:2,xp:9,gold:75,soulGem:6,kills:3,weaponLevel:2,armorLevel:1}),'old');
 const saved=store.load('old');assert.equal(saved.progress.gold,75);assert.equal(saved.progress.level,2);assert.equal(saved.progress.potions,3);assert.equal(saved.progress.questTier,0);store.close();
});
test('quest claims and potion purchases consume once, survive reentry and reject unearned rewards',()=>{
 const store=new RpgStore(':memory:'),saved=store.load('g');saved.progress.kills=HUNT_QUESTS[0].kills;saved.progress.gold=0;store.save('g',saved.progress,saved.revision);
 const service=new RpgService(store,balance,()=>0),v=service.start('g','hong');
 const q=service.command('g',v.id,1,input,'quest');assert.equal(q.progress.questTier,1);assert.equal(q.progress.gold,50);
 assert.deepEqual(service.command('g',v.id,1,input,'quest'),q);assert.throws(()=>service.command('g',v.id,2,input,'quest'));
 const purchase=service.command('g',v.id,2,input,'buy-potion');assert.equal(purchase.progress.gold,0);assert.equal(purchase.progress.potions,4);
 assert.deepEqual(service.command('g',v.id,2,input,'buy-potion'),purchase);assert.equal(service.start('g','hong').progress.potions,4);store.close();
});
test('healing potion cannot resurrect, exceed max HP, or bypass cooldown',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});assert.throws(()=>g.usePotion());g.hp=30;g.usePotion();assert.equal(g.hp,4030);assert.equal(g.progress.potions,2);
 assert.throws(()=>g.usePotion());g.enemyHP=0;g.respawnAt=Infinity;advance(g,2.1);g.hp=g.maxHP-10;g.usePotion();assert.equal(g.hp,g.maxHP);assert.equal(g.progress.potions,1);
 g.hp=0;assert.throws(()=>g.usePotion());assert.equal(g.progress.potions,1);
});

test('test characters share 10000 HP and distant slime respawns remain outside the hero body',()=>{
 for(const c of COMBAT_CHARACTERS){const g=new HuntEngine(huntLoadout(c.id).combo,7,{hostile:true});assert.equal(g.hp,10000);assert.equal(g.maxHP,10000);}
 const g=new HuntEngine(HUNT_RULES.combo,7,{hostile:true});g.x=3600;g.enemies[0].hp=0;g.enemies[0].respawnAt=0;g.step(.01,0);
 assert.equal(g.enemies[0].hp,100);assert.ok(g.enemies[0].x>g.x+900);assert.ok(g.enemies.every(e=>e.x>=65&&e.x<=7200-65));
});

test('four weapons equip with independent upgrade levels, deduct once and persist across reentry',()=>{
 const store=new RpgStore(':memory:'),saved=store.load('armory');saved.progress.soulGem=100;store.save('armory',saved.progress,saved.revision);
 const service=new RpgService(store,balance,()=>0);let v=service.start('armory','hong');let seq=0;
 v=service.command('armory',v.id,++seq,input,'equip-sword');assert.equal(v.weapon,'sword');
 v=service.command('armory',v.id,++seq,input,'weapon');assert.equal(v.progress.weaponLevels.sword,2);assert.equal(v.progress.soulGem,60);
 assert.deepEqual(service.command('armory',v.id,seq,input,'weapon'),v);
 v=service.command('armory',v.id,++seq,input,'equip-dual');assert.equal(v.progress.weaponLevel,1);assert.equal(v.progress.weaponLevels.sword,2);
 v=service.command('armory',v.id,++seq,input,'equip-spear');assert.equal(v.weapon,'spear');
 v=service.command('armory',v.id,++seq,input,'equip-sword');assert.equal(v.progress.weaponLevel,2);
 v=service.start('armory','white-bob');assert.equal(v.weapon,'sword');assert.equal(v.progress.weaponLevels.sword,2);assert.equal(v.progress.soulGem,60);
 // A previously returned snapshot cannot be changed by a subsequent equip/upgrade.
 assert.equal(saved.progress.weaponLevels.sword,1);store.close();
});
test('legacy weapon level migrates to axe without losing previous upgrades or currency',()=>{
 const store=new RpgStore(':memory:');store.load('legacy');store.db.prepare('UPDATE rpg_players SET progress=? WHERE id=?').run(JSON.stringify({level:1,xp:0,gold:100,soulGem:77,kills:9,weaponLevel:5,armorLevel:2}),'legacy');
 const p=store.load('legacy').progress;assert.equal(p.weaponType,'axe');assert.equal(p.weaponLevels.axe,5);assert.equal(p.weaponLevels.spear,1);assert.equal(p.soulGem,77);store.close();
});
test('faster weapons keep impact timing and never inherit a hit from a cancelled old swing',async()=>{
 const {weaponLoadout}=await import('../../src/components/rpg/hunt-weapons');
 for(const weapon of ['sword','axe','dual','spear'] as const){const l=weaponLoadout('hong',weapon),g=new HuntEngine(l.combo,1,{hostile:true,tempo:l.tempo,range:l.range,crit:0});g.enemyX=g.x+40;
  assert.equal(g.attack(),true);const hit=g.visualTiming.hitAt;advance(g,Math.max(0,hit-.02));assert.equal(g.enemyHP,100);advance(g,.03);assert.ok(g.enemyHP<100);
 }
 const l=weaponLoadout('hong','dual'),g=new HuntEngine(l.combo,1,{hostile:true,tempo:l.tempo});g.enemyX=g.x+40;g.attack();
 const s=weaponLoadout('hong','spear');g.configureLoadout(s.combo,s.range,s.crit,s.tempo);advance(g,.5);assert.equal(g.enemyHP,100);
 assert.equal(s.range,105);assert.equal(l.combo.length,5);
});

test('hunt tables have valid references, spawn bounds, real asset files and available clips',async()=>{
 const {HUNT_TABLES,validateHuntTables}=await import('../../src/components/rpg/hunt-tables');
 const {readFileSync,existsSync}=await import('node:fs');
 assert.doesNotThrow(()=>validateHuntTables(HUNT_TABLES));
 for(const asset of HUNT_TABLES.assets){for(const ext of ['json','atlas','png'])assert.ok(existsSync(`public/rpg/${asset.skeleton}.${ext}`));
  const skeleton=JSON.parse(readFileSync(`public/rpg/${asset.skeleton}.json`,'utf8'));for(const clip of Object.values(asset.clips))assert.ok(skeleton.animations[clip],clip);}
 const bad=structuredClone(HUNT_TABLES);bad.monsters[0].attackId='missing';assert.throws(()=>validateHuntTables(bad));
 const bounds=structuredClone(HUNT_TABLES);bounds.stages[0].spawns[0]=Infinity;assert.throws(()=>validateHuntTables(bounds));
});
