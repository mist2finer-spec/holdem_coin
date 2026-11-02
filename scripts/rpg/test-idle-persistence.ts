import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createGameStorage} from '../../src/lib/game-storage';
import {RpgStore} from '../../src/lib/rpg-store';
import {RpgItemsStore} from '../../src/lib/rpg-items';
import {sqliteAtomic} from '../../src/lib/rpg-sqlite';
import {RogueService} from '../../src/lib/rpg-rogue-service';
import {initializeIdleProfile,syncIdleBuild,applyIdleAction,applyPhysicalBuildAction} from '../../src/lib/rpg-idle-profile';
import {newHuntProgress,DEFAULT_HUNT_BALANCE} from '../../src/components/rpg/hunt-progression';
import {RpgService} from '../../src/lib/rpg-service';
import {changeBuild,compileBuild} from '../../src/components/rpg/hunt-build';
import {equippedItems} from '../../src/components/rpg/idle-equipment';
import {IDLE_BALANCE,accrueIdleProgress} from '../../src/components/rpg/idle-progression';
process.env.POKER_TEST_MODE='1';
const {LobbyLedger}=require('../../mini-services/poker-server/lobby-ledger') as typeof import('../../mini-services/poker-server/lobby-ledger');
const {buyShopJewel}=require('../../mini-services/poker-server/jewel-shop') as typeof import('../../mini-services/poker-server/jewel-shop');
const idle={x:0,y:0,auto:false,paused:true};
const account='a'.repeat(64);
function fixture(){const dir=mkdtempSync(path.join(tmpdir(),'idle-persistence-')),file=path.join(dir,'game.sqlite'),a=createGameStorage(file),b=createGameStorage(file);return {dir,file,a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};}
function savedItems(view:ReturnType<RpgItemsStore['view']>){const {testCollection,gemCollection,ownedWeapons,equippedJewelIds,...saved}=view;return saved;}
function wallet(db:ReturnType<typeof createGameStorage>['db'],token:string){return {...db.prepare('SELECT balance,table_amount FROM holdem_wallets WHERE token=?').get(token)} as {balance:number;table_amount:number};}
function failCommitOnce(db:ReturnType<typeof createGameStorage>['db']){const original=db.exec.bind(db);let armed=true;(db as any).exec=(sql:string)=>{if(sql==='COMMIT'&&armed){armed=false;throw Error('injected commit failure');}return original(sql);};return ()=>{(db as any).exec=original;};}

test('legacy player and item files migrate once into the shared database without losing progress, links, jewels or receipts',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'idle-legacy-')),players=new RpgStore(path.join(dir,'players.sqlite')),items=new RpgItemsStore(path.join(dir,'items.sqlite'));
 const legacy=players.load(account);legacy.progress.gold=41234;legacy.progress.soulGem=5678;legacy.progress.weaponLevels.axe=legacy.progress.weaponLevel=7;legacy.progress.build=changeBuild(changeBuild(legacy.progress.build,'core-allocate-0_1'),'gem-0-0-power');players.save(account,legacy.progress,legacy.revision);const link=items.link(account);items.purchaseJewel(account,'crimson','legacy-migration-0001');items.awardChampion('legacy-tournament',account);for(let i=0;i<11;i++)items.awardCashWin(`legacy-cash-${i}`,account,{flushPlus:true});items.redeemMileage(account,'reroll','legacy-redeem-0001',items.view(account).revision);const expectedItems=savedItems(items.view(account));players.close();items.close();
 let storage=createGameStorage(path.join(dir,'game.sqlite'));
 try{assert.equal(storage.progress.db,storage.items.db);const p=storage.progress.load(account).progress;assert.equal(p.gold,41234);assert.equal(p.soulGem,5678);assert.equal(p.weaponLevel,7);assert.equal(p.build!.links[0][0],'power');assert.deepEqual(p.build!.nodes,['root','0_1']);assert.equal(storage.items.link(account),link);assert.deepEqual(savedItems(storage.items.view(account)),expectedItems);assert.equal(storage.items.view(account).testCollection,false);assert.ok(storage.db.prepare('SELECT 1 FROM rpg_item_requests WHERE id=?').get(`item:${account}:legacy-redeem-0001`));assert.equal(storage.items.purchaseJewel(account,'crimson','legacy-migration-0001'),false);storage.close();storage=createGameStorage(path.join(dir,'game.sqlite'));assert.equal(storage.progress.load(account).progress.gold,41234);assert.deepEqual(savedItems(storage.items.view(account)),expectedItems);assert.equal(storage.items.view(account).testCollection,false);assert.ok(storage.db.prepare('SELECT 1 FROM rpg_item_requests WHERE id=?').get(`item:${account}:legacy-redeem-0001`));assert.equal((storage.db.prepare('SELECT COUNT(*) AS n FROM storage_migrations').get() as {n:number}).n,2);storage.progress.close();storage.items.close();assert.ok(storage.db.prepare('SELECT 1').get());}
 finally{storage.close();rmSync(dir,{recursive:true,force:true});}
});

test('wallet debit and nested jewel grant are one transaction observable atomically from a second database connection',()=>{
 const f=fixture();try{const ledger=new LobbyLedger(f.a.db),w=ledger.connect('buyer',undefined)!,link=f.a.items.link(account);let inside=false;
 ledger.purchase('buyer',200,()=>{const granted=f.a.items.purchaseJewel(account,'crimson','atomic-purchase-0001');inside=true;assert.equal(f.b.items.jewels(account).length,0);assert.deepEqual(wallet(f.b.db,w.token),{balance:5000,table_amount:0});return granted;});assert.equal(inside,true);assert.equal(f.b.items.jewels(account).length,1);assert.equal(wallet(f.b.db,w.token).balance,4800);
 const retry=buyShopJewel(ledger,f.a.items,'buyer',{jewelId:'crimson',requestId:'atomic-purchase-0001',link});assert.equal(retry.account.multi,4800);assert.equal(f.b.items.jewels(account).length,1);
 f.a.db.exec("CREATE TRIGGER reject_debit BEFORE UPDATE OF balance ON holdem_wallets WHEN NEW.balance < OLD.balance BEGIN SELECT RAISE(ABORT,'injected debit failure'); END;");
 assert.throws(()=>buyShopJewel(ledger,f.a.items,'buyer',{jewelId:'silver',requestId:'atomic-purchase-0002',link}),/injected/);assert.equal(f.b.items.jewels(account).length,1);assert.equal(wallet(f.b.db,w.token).balance,4800);assert.equal(f.b.items.jewelReceipt(account,'atomic-purchase-0002'),false);assert.equal(f.b.items.view(account).revision,1);
 f.a.db.exec('DROP TRIGGER reject_debit');buyShopJewel(ledger,f.a.items,'buyer',{jewelId:'silver',requestId:'atomic-purchase-0002',link});assert.equal(wallet(f.b.db,w.token).balance,4600);assert.equal(f.b.items.jewels(account).length,2);
 }finally{f.close();}
});

test('nested transaction failure rolls back player progress, item events and jewel grants together',()=>{
 const f=fixture();try{const before=f.a.progress.load(account),oldItems=f.a.items.view(account);assert.throws(()=>sqliteAtomic(f.a.db,()=>{const p=structuredClone(before.progress);p.gold=900;f.a.progress.save(account,p,before.revision);f.a.items.purchaseJewel(account,'crimson','nested-failure-0001');f.a.items.awardChampion('rollback-champion',account);throw Error('after grants');}),/after grants/);assert.deepEqual(f.b.progress.load(account),before);assert.deepEqual(f.b.items.view(account),oldItems);assert.equal(f.b.items.jewelReceipt(account,'nested-failure-0001'),false);assert.equal(f.b.items.awardChampion('rollback-champion',account),true);}
 finally{f.close();}
});

test('all-player settlement is atomic and idempotent; restart refunds only the committed checkpoint and fences the stale process',()=>{
 const f=fixture();try{const old=new LobbyLedger(f.a.db),a=old.connect('one',undefined)!,b=old.connect('two',undefined)!;old.reserve('one');old.reserve('two');old.start('one');old.start('two');
 f.a.db.exec("CREATE TRIGGER reject_settlement BEFORE INSERT ON holdem_wallet_settlements BEGIN SELECT RAISE(ABORT,'injected settlement failure'); END;");assert.throws(()=>old.settleHand('hand:1',[{socketId:'one',stack:6500},{socketId:'two',stack:3500}]),/injected/);assert.equal(wallet(f.b.db,a.token).table_amount,5000);assert.equal(wallet(f.b.db,b.token).table_amount,5000);assert.equal(old.isSettled('hand:1'),false);f.a.db.exec('DROP TRIGGER reject_settlement');
 assert.equal(old.settleHand('hand:1',[{socketId:'one',stack:6500},{socketId:'two',stack:3500}]),true);assert.equal(old.settleHand('hand:1',[{socketId:'one',stack:99999},{socketId:'two',stack:1}]),false);assert.equal(wallet(f.b.db,a.token).table_amount,6500);assert.equal(wallet(f.b.db,b.token).table_amount,3500);
 // Current-hand bets are intentionally not persisted: these are the last completed-hand checkpoints.
 const current=new LobbyLedger(f.b.db);assert.deepEqual(wallet(f.a.db,a.token),{balance:6500,table_amount:0});assert.deepEqual(wallet(f.a.db,b.token),{balance:3500,table_amount:0});assert.equal(current.connect('reconnected',a.token)!.multi,6500);assert.throws(()=>old.recharge('one'),/교체/);assert.throws(()=>old.sync('two',1),/교체/);assert.throws(()=>old.settleHand('stale:2',[{socketId:'one',stack:1}]),/교체/);assert.equal(current.isSettled('hand:1'),true);assert.equal(wallet(f.a.db,a.token).balance+wallet(f.a.db,b.token).balance,10000);
 }finally{f.close();}
});

test('failed COMMIT cannot leak uncommitted hand checkpoints through a later disconnect metadata write',()=>{
 const f=fixture();try{const ledger=new LobbyLedger(f.a.db),w=ledger.connect('player',undefined)!;ledger.reserve('player');ledger.start('player');const restore=failCommitOnce(f.a.db);try{assert.throws(()=>ledger.settleHand('commit-failure',[{socketId:'player',stack:7000}]),/injected commit/);}finally{restore();}assert.equal(wallet(f.b.db,w.token).table_amount,5000);assert.equal(ledger.isSettled('commit-failure'),false);ledger.disconnect('player');assert.equal(wallet(f.b.db,w.token).table_amount,5000);}
 finally{f.close();}
});

test('failed release keeps the seat reservation recoverable and retry credits escrow exactly once',()=>{
 const f=fixture();try{const ledger=new LobbyLedger(f.a.db),w=ledger.connect('player',undefined)!;ledger.reserve('player');ledger.start('player');f.a.db.exec("CREATE TRIGGER reject_release BEFORE UPDATE ON holdem_wallets WHEN OLD.table_amount>0 AND NEW.table_amount=0 BEGIN SELECT RAISE(ABORT,'injected release failure'); END;");assert.throws(()=>ledger.release('player'),/injected/);assert.deepEqual(wallet(f.b.db,w.token),{balance:0,table_amount:5000});f.a.db.exec('DROP TRIGGER reject_release');ledger.release('player');assert.deepEqual(wallet(f.b.db,w.token),{balance:5000,table_amount:0});ledger.release('player');assert.equal(wallet(f.b.db,w.token).balance,5000);}
 finally{f.close();}
});

test('idle migration preserves earned values and all old linked copies while only real slots affect combat',()=>{
 const p=newHuntProgress();p.gold=1234;p.soulGem=456;p.skillLevels=[9,8,7,6,5,4];p.masteryLevel=5;p.willLevel=10;p.build=changeBuild(changeBuild(p.build,'gem-0-0-power'),'gem-2-0-power');const original=structuredClone(p.build);initializeIdleProfile(p,100000);assert.equal(p.gold,1234);assert.equal(p.soulGem,1456);assert.deepEqual(p.legacyBuild,original);assert.deepEqual(p.build!.links,original.links);assert.equal(p.gemCollection!.support.power,2);assert.deepEqual(p.skillLevels,[9,8,7,6,5,4]);assert.equal(p.masteryLevel,5);assert.equal(p.willLevel,10);assert.equal(compileBuild(p.build).skills[2].supportIds.length,0);initializeIdleProfile(p,100000);assert.equal(p.soulGem,1456);assert.equal(p.gemCollection!.support.power,2);
});

test('fresh idle profiles own six starter gems with no assigned skills; migration and reload never re-equip them',()=>{
 const f=fixture();try{const saved=f.a.progress.load(account);initializeIdleProfile(saved.progress,100000);assert.ok(saved.progress.equipment!.items.every(item=>item.gems.every(id=>id===null)));assert.deepEqual(saved.progress.gemCollection!.active,{rift:1,dark:1,frost:1,holy:1,whirl:1,heal:1});assert.ok(compileBuild(saved.progress.build).skills.every(skill=>!skill.enabled&&skill.activeId===''));
 applyPhysicalBuildAction(saved.progress,'active-5-rift');f.a.progress.save(account,saved.progress,saved.revision);const loaded=f.b.progress.load(account);initializeIdleProfile(loaded.progress,100000);assert.equal(equippedItems(loaded.progress.equipment!).ring2.gems[0],'rift');assert.equal(compileBuild(loaded.progress.build).skills[5].slotIndex,5);assert.equal(compileBuild(loaded.progress.build).skills.filter(skill=>skill.enabled).length,1);
 applyPhysicalBuildAction(loaded.progress,'active-5-empty');f.b.progress.save(account,loaded.progress,loaded.revision);const removed=f.a.progress.load(account).progress;initializeIdleProfile(removed,100000);assert.ok(compileBuild(removed.build).skills.every(skill=>!skill.enabled));assert.equal(removed.gemCollection!.active.rift,1);
 }finally{f.close();}
});

test('explicit legacy active and support assignments survive first migration while implicit defaults remain unassigned',()=>{
 const linked=newHuntProgress();linked.build=changeBuild(linked.build,'gem-0-0-power');initializeIdleProfile(linked,100000);assert.deepEqual(equippedItems(linked.equipment!).weapon.gems,['rift','power']);assert.equal(compileBuild(linked.build).skills.filter(skill=>skill.enabled).length,1);
 const explicit=newHuntProgress();explicit.build=changeBuild(explicit.build,'active-3-fireball');initializeIdleProfile(explicit,100000);assert.equal(equippedItems(explicit.equipment!).boots.gems[0],'fireball');assert.equal(explicit.gemCollection!.active.fireball,1);const before=structuredClone(explicit.equipment);initializeIdleProfile(explicit,100000);assert.deepEqual(explicit.equipment,before);
});

test('old untouched starter assignments clear once after SQL reload and a saved receipt preserves later manual re-equipping',()=>{
 const f=fixture();try{const old=f.a.progress.load(account);initializeIdleProfile(old.progress,100000);delete old.progress.equipment!.starterGemPolicyVersion;const ids=['rift','dark','frost','holy','whirl','heal'];old.progress.equipment!.items.forEach((item,i)=>item.gems[0]=ids[i]);syncIdleBuild(old.progress);const collection=structuredClone(old.progress.gemCollection);f.a.progress.save(account,old.progress,old.revision);
 const migrated=f.b.progress.load(account);initializeIdleProfile(migrated.progress,100000);assert.equal(migrated.progress.equipment!.starterGemPolicyVersion,1);assert.ok(migrated.progress.equipment!.items.every(item=>item.gems.every(id=>id===null)));assert.deepEqual(migrated.progress.gemCollection,collection);
 ids.forEach((id,i)=>applyPhysicalBuildAction(migrated.progress,`active-${i}-${id}`));f.b.progress.save(account,migrated.progress,migrated.revision);const manual=f.a.progress.load(account).progress;initializeIdleProfile(manual,100000);assert.deepEqual(manual.equipment!.items.map(item=>item.gems[0]),ids);assert.equal(manual.equipment!.starterGemPolicyVersion,1);assert.equal(compileBuild(manual.build).skills.filter(skill=>skill.enabled).length,6);
 }finally{f.close();}
});

test('equipping a lower-level physical weapon preserves legacy levels and remains reloadable from another connection',()=>{
 const f=fixture();try{const saved=f.a.progress.load(account);saved.progress.weaponLevel=saved.progress.weaponLevels.axe=10;initializeIdleProfile(saved.progress,100000);saved.progress.equipment!.items.push({instanceId:'new_low_axe',slot:'weapon',rarity:'normal',weaponType:'axe',level:1,gems:[null,null]});applyIdleAction(saved.progress,'idle-equip-new_low_axe');f.a.progress.save(account,saved.progress,saved.revision);const loaded=f.b.progress.load(account).progress;assert.equal(loaded.weaponLevel,1);assert.equal(loaded.weaponLevels.axe,10);assert.equal(equippedItems(loaded.equipment!).weapon.instanceId,'new_low_axe');}
 finally{f.close();}
});

test('socket actions enforce copies across unequipped inventory, and all batch prefixes debit exactly their intended count',()=>{
 const p=newHuntProgress();initializeIdleProfile(p,100000);applyPhysicalBuildAction(p,'active-0-rift');p.soulGem=10000;const before=p.soulGem;applyIdleAction(p,'idle-draw-gems-1',()=>.1);assert.equal(p.gacha!.gemPulls,1);assert.equal(p.soulGem,before-75);applyIdleAction(p,'idle-draw-gems-10',()=>.1);assert.equal(p.gacha!.gemPulls,11);assert.equal(p.soulGem,before-825);let serial=0;applyIdleAction(p,'idle-draw-equipment-weapon-10',()=>.1,()=>`rolled_${++serial}`);assert.equal(p.gacha!.equipmentPulls,10);assert.equal(p.soulGem,before-1825);assert.equal(p.equipment!.items.length,16);const last=p.equipment!.items.at(-1)!;last.gems=[null];last.socketColors=['white'];last.socketLinks=[];assert.throws(()=>applyIdleAction(p,`idle-socket-${last.instanceId}-0-rift`),/수량/);applyPhysicalBuildAction(p,'active-0-empty');applyIdleAction(p,`idle-socket-${last.instanceId}-0-rift`);assert.throws(()=>applyPhysicalBuildAction(p,'active-0-rift'),/수량/);assert.equal(p.build!.equipment!.items.length,6);assert.equal(p.equipment!.items.length,16);
});

test('real idle RogueService credits server wall time once across retries, reconnects, two connections and backwards clocks',()=>{
 const f=fixture();try{let now=0,wall=100000;const service=new RogueService(()=>now,()=>111,f.a.progress,f.a.items,true,()=>wall);const first=service.start(account,'hong'),expected=structuredClone(first.progress);wall+=60000;accrueIdleProgress(expected,wall);const next=service.command(account,first.id,1,idle,'idle-claim');assert.equal(next.progress.gold,expected.gold);assert.equal(next.progress.xp,expected.xp);assert.equal(next.progress.level,expected.level);assert.deepEqual(service.command(account,first.id,1,idle,'idle-claim'),next);assert.deepEqual(f.b.progress.load(account).progress,next.progress);
 const other=new RogueService(()=>now,()=>111,f.b.progress,f.b.items,true,()=>wall),reopened=other.start(account,'hong');assert.equal(reopened.progress.gold,next.progress.gold);assert.equal(reopened.progress.soulGem,next.progress.soulGem);wall-=10000;const backwards=other.command(account,reopened.id,1,idle,'idle-claim');assert.equal(backwards.progress.idle!.lastAccruedAt,next.progress.idle!.lastAccruedAt);assert.equal(backwards.progress.gold,next.progress.gold);wall=next.progress.idle!.lastAccruedAt+60000;const fresh=service.command(account,first.id,2,idle,'idle-claim');assert.equal(fresh.progress.gold,next.progress.gold+IDLE_BALANCE.goldPerMinute);assert.equal(fresh.progress.idle!.totalAccruedMs,120000);
 }finally{f.close();}
});

test('gacha SQL failure rolls back debit and loot, invalidates dirty session, and retry after re-entry grants only once',()=>{
 const f=fixture();try{const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>100000),first=service.start(account,'hong'),before=f.b.progress.load(account);f.a.db.exec("CREATE TRIGGER reject_player_write BEFORE UPDATE ON rpg_players BEGIN SELECT RAISE(ABORT,'injected save failure'); END;");assert.throws(()=>service.command(account,first.id,1,idle,'idle-draw-equipment-all-1'),/injected/);assert.deepEqual(f.b.progress.load(account),before);f.a.db.exec('DROP TRIGGER reject_player_write');const retry=service.start(account,'hong'),rolled=service.command(account,retry.id,1,idle,'idle-draw-equipment-all-1');assert.equal(rolled.progress.equipment!.items.length,7);assert.equal(rolled.progress.gacha!.equipmentPulls,1);assert.equal(rolled.progress.soulGem,900);assert.deepEqual(service.command(account,retry.id,1,idle,'idle-draw-equipment-all-1'),rolled);assert.equal(f.b.progress.load(account).progress.equipment!.items.length,7);}
 finally{f.close();}
});

test('idle tick save failure cannot leave an unsaved clock cached; a clean re-entry credits the missing minute once',()=>{
 const f=fixture();try{let wall=100000;const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>wall),first=service.start(account,'hong'),before=f.b.progress.load(account);wall+=60000;f.a.db.exec("CREATE TRIGGER reject_tick_write BEFORE UPDATE ON rpg_players BEGIN SELECT RAISE(ABORT,'injected tick failure'); END;");assert.throws(()=>service.command(account,first.id,1,idle),/injected/);assert.deepEqual(f.b.progress.load(account),before);f.a.db.exec('DROP TRIGGER reject_tick_write');assert.throws(()=>service.command(account,first.id,1,idle),/만료/);const resumed=service.start(account,'hong');assert.equal(resumed.progress.gold,before.progress.gold+30);assert.equal(resumed.progress.soulGem,before.progress.soulGem+1);assert.equal(resumed.progress.idle!.totalAccruedMs,60000);const again=service.start(account,'hong');assert.equal(again.progress.gold,resumed.progress.gold);}
 finally{f.close();}
});

test('invalid actions do not consume an idle clock or sequence and a corrected retry credits the full elapsed minute',()=>{
 const f=fixture();try{let wall=100000;const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>wall),first=service.start(account,'hong'),before=f.b.progress.load(account);wall+=60000;assert.throws(()=>service.command(account,first.id,1,idle,'idle-socket-starter_weapon-0-fireball'),/수량/);assert.deepEqual(f.b.progress.load(account),before);const next=service.command(account,first.id,1,idle,'idle-claim');assert.equal(next.progress.gold,before.progress.gold+30);assert.equal(next.progress.idle!.totalAccruedMs,60000);}
 finally{f.close();}
});

test('failed start COMMIT does not publish an uncommitted session or starter bonus',()=>{
 const f=fixture();try{const initial=f.a.progress.load(account),service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>100000),restore=failCommitOnce(f.a.db);try{assert.throws(()=>service.start(account,'hong'),/injected commit/);}finally{restore();}assert.deepEqual(f.b.progress.load(account),initial);assert.equal((service as any).sessions.has(account),false);const started=service.start(account,'hong');assert.equal(started.progress.soulGem,1000);assert.equal(f.b.progress.load(account).progress.soulGem,1000);}
 finally{f.close();}
});

test('response construction failure after a paid action rolls back both SQL state and the mutated runtime session',()=>{
 const f=fixture();try{const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>100000),first=service.start(account,'hong'),before=f.b.progress.load(account),original=(service as any).viewBuild;(service as any).viewBuild=()=>{throw Error('injected snapshot failure');};try{assert.throws(()=>service.command(account,first.id,1,idle,'idle-draw-gems-1'),/injected snapshot/);}finally{(service as any).viewBuild=original;}assert.deepEqual(f.b.progress.load(account),before);assert.throws(()=>service.command(account,first.id,1,idle),/만료/);const fresh=service.start(account,'hong'),next=service.command(account,fresh.id,1,idle,'idle-draw-gems-1');assert.equal(next.progress.gacha!.gemPulls,1);assert.equal(next.progress.soulGem,925);}
 finally{f.close();}
});

test('out-of-order requests after a successful command preserve the committed session for the correct next sequence',()=>{
 const f=fixture();try{const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>100000),first=service.start(account,'hong'),one=service.command(account,first.id,1,idle,'idle-claim'),before=f.b.progress.load(account);assert.throws(()=>service.command(account,first.id,3,idle,'idle-draw-gems-1'),/sequence/);assert.deepEqual(f.b.progress.load(account),before);assert.equal(service.command(account,first.id,1,idle),one);const two=service.command(account,first.id,2,idle,'idle-claim');assert.equal(two.sequence,2);assert.equal(two.progress.soulGem,one.progress.soulGem);}
 finally{f.close();}
});

test('stale session IDs cannot evict a newer committed idle Rogue session',()=>{
 const f=fixture();try{const service=new RogueService(()=>0,()=>111,f.a.progress,f.a.items,true,()=>100000),old=service.start(account,'hong'),fresh=service.start(account,'hong');service.command(account,fresh.id,1,idle);assert.throws(()=>service.command(account,old.id,2,idle),/만료/);assert.equal(service.command(account,fresh.id,2,idle).sequence,2);}
 finally{f.close();}
});
const huntIdle={move:0,attack:false,auto:false};

test('campaign idle polling preserves in-flight motion and applies its actual hit instead of cancelling on every request',()=>{
 const f=fixture();try{let now=0;const service=new RpgService(f.a.progress,DEFAULT_HUNT_BALANCE,()=>now,true,()=>100000),first=service.start(account,'hong'),g=(service as any).sessions.get(account).engine;const target=g.enemies.find((e:any)=>e.hp>0);assert.ok(target);g.x=target.x-45;target.hp=target.maxHP=1000000;target.nextAttack=999;for(const e of g.enemies)if(e!==target){e.hp=0;e.state='dead';}let view=service.command(account,first.id,1,{...huntIdle,skill:0},'idle-socket-starter_weapon-0-rift');const start=view.motion.startedAt;assert.ok(view.motion.duration>0);for(let seq=2;seq<=30;seq++){now+=50;view=service.command(account,first.id,seq,huntIdle);if(seq<4)assert.equal(view.motion.startedAt,start);}assert.ok(target.hp<1000000);assert.ok(view.cooldowns[0]>0);assert.equal(view.progress.gacha!.equipmentPulls,0);}
 finally{f.close();}
});

test('campaign idle start and paid-action response failures roll back SQL and discard uncommitted runtime state',()=>{
 const f=fixture();try{const service=new RpgService(f.a.progress,DEFAULT_HUNT_BALANCE,()=>0,true,()=>100000),initial=f.a.progress.load(account),restore=failCommitOnce(f.a.db);try{assert.throws(()=>service.start(account,'hong'),/injected commit/);}finally{restore();}assert.deepEqual(f.b.progress.load(account),initial);assert.equal((service as any).sessions.has(account),false);const first=service.start(account,'hong'),before=f.b.progress.load(account),original=(service as any).view;(service as any).view=()=>{throw Error('campaign snapshot failure');};try{assert.throws(()=>service.command(account,first.id,1,huntIdle,'idle-draw-equipment-all-1'),/campaign snapshot/);}finally{(service as any).view=original;}assert.deepEqual(f.b.progress.load(account),before);assert.throws(()=>service.command(account,first.id,1,huntIdle),/만료/);const fresh=service.start(account,'hong'),one=service.command(account,fresh.id,1,huntIdle,'idle-draw-equipment-all-1');assert.equal(one.progress.gacha!.equipmentPulls,1);assert.equal(one.progress.soulGem,900);assert.equal(service.command(account,fresh.id,1,huntIdle,'idle-draw-equipment-all-1'),one);}
 finally{f.close();}
});

test('campaign idle clock merges external progress and keeps valid sequences after invalid or stale requests',()=>{
 const f=fixture();try{let wall=100000;const service=new RpgService(f.a.progress,DEFAULT_HUNT_BALANCE,()=>0,true,()=>wall),old=service.start(account,'hong'),first=service.start(account,'hong'),one=service.command(account,first.id,1,huntIdle,'idle-claim');assert.throws(()=>service.command(account,first.id,3,huntIdle),/sequence/);assert.throws(()=>service.command(account,old.id,2,huntIdle),/만료/);const external=f.b.progress.load(account);external.progress.gold+=100;f.b.progress.save(account,external.progress,external.revision);wall+=60000;assert.throws(()=>service.command(account,first.id,2,huntIdle,'idle-socket-starter_weapon-0-fireball'),/수량/);const two=service.command(account,first.id,2,huntIdle,'idle-claim');assert.equal(two.progress.gold,one.progress.gold+130);assert.equal(two.progress.idle!.totalAccruedMs,60000);assert.deepEqual(f.b.progress.load(account).progress,two.progress);}
 finally{f.close();}
});

function prepareBoss(service:RogueService,accountId:string){const game=(service as any).sessions.get(accountId).game;game.mobs=game.mobs.slice(0,1);const boss=game.mobs[0];boss.boss=true;boss.hp=1;boss.x=game.hero.x+60;boss.until=999;return game;}
test('real boss death grants one orb per dungeon difficulty, independent of map seed, campaign stage and gold delta',()=>{
 const f=fixture();try{let now=0,seed=100;const service=new RogueService(()=>now,()=>++seed,f.a.progress,f.a.items,true,()=>100000);const kill=(suppressGold=false)=>{const started=service.start(account,'hong'),game=prepareBoss(service,account);if(suppressGold){const original=game.step.bind(game);game.step=(dt:number,input:unknown)=>{const before=game.gold;original(dt,input);game.gold=before;};}service.command(account,started.id,1,{x:0,y:0,auto:false,skill:0},'idle-socket-starter_weapon-0-rift');now+=300;return service.command(account,started.id,2,{x:0,y:0,auto:false});};const orbs=f.a.items.view(account).orbs;const first=kill(true);assert.equal(first.kills,1);assert.equal(first.progress.gold,0);assert.equal(f.b.items.view(account).orbs,orbs+1);assert.equal(service.command(account,first.id,2,{x:0,y:0,auto:false}),first);kill();assert.equal(f.b.items.view(account).orbs,orbs+1);const saved=f.b.progress.load(account);saved.progress.labyrinthStage=1;f.b.progress.save(account,saved.progress,saved.revision);kill();assert.equal(f.b.items.view(account).orbs,orbs+1);const harder=f.b.progress.load(account);harder.progress.hybrid!.dungeonLevel=2;f.b.progress.save(account,harder.progress,harder.revision);kill();assert.equal(f.b.items.view(account).orbs,orbs+2);}
 finally{f.close();}
});

test('boss reward SQL failure rolls back kill rewards and invalidates the mutated run before a clean retry',()=>{
 const f=fixture();try{let now=0;const service=new RogueService(()=>now,()=>111,f.a.progress,f.a.items,true,()=>100000),started=service.start(account,'hong');prepareBoss(service,account);service.command(account,started.id,1,{x:0,y:0,auto:false,skill:0},'idle-socket-starter_weapon-0-rift');const before=f.b.progress.load(account),items=f.b.items.view(account);f.a.db.exec("CREATE TRIGGER reject_boss_reward BEFORE INSERT ON rpg_item_events WHEN NEW.id LIKE 'dungeonbossfirst:%' BEGIN SELECT RAISE(ABORT,'injected boss reward failure'); END;");now+=300;assert.throws(()=>service.command(account,started.id,2,{x:0,y:0,auto:false}),/injected boss/);assert.deepEqual(f.b.progress.load(account),before);assert.deepEqual(f.b.items.view(account),items);f.a.db.exec('DROP TRIGGER reject_boss_reward');assert.throws(()=>service.command(account,started.id,2,idle),/만료/);const retry=service.start(account,'hong');prepareBoss(service,account);service.command(account,retry.id,1,{x:0,y:0,auto:false,skill:0},'idle-socket-starter_weapon-0-rift');now+=300;service.command(account,retry.id,2,{x:0,y:0,auto:false});assert.equal(f.b.items.view(account).orbs,items.orbs+1);assert.equal(f.b.progress.load(account).progress.kills,before.progress.kills+1);}
 finally{f.close();}
});

test('socket crafting replays once through the real paused RogueService command transaction',()=>{
 const f=fixture();try{let now=0;const service=new RogueService(()=>now,()=>111,f.a.progress,f.a.items,true,()=>100000);const first=service.start(account,'hong'),cost=20;const next=service.command(account,first.id,1,{...idle,paused:true},'idle-craft-colors-starter_weapon');assert.equal(next.progress.soulGem,first.progress.soulGem-cost);assert.equal(next.progress.equipment!.items[0].socketColors!.length,2);assert.deepEqual(service.command(account,first.id,1,{...idle,paused:true},'idle-craft-colors-starter_weapon'),next);assert.equal(f.b.progress.load(account).progress.soulGem,next.progress.soulGem);}
 finally{f.close();}
});
