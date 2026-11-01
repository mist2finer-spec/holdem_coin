import test from 'node:test';import assert from 'node:assert/strict';
import {RpgItemsStore} from '../../src/lib/rpg-items';
import {LobbyLedger} from '../../mini-services/poker-server/lobby-ledger';
import {buyShopJewel} from '../../mini-services/poker-server/jewel-shop';
import {skillCooldown} from '../../src/components/rpg/skill-cooldown';
import {JEWEL_CATALOG} from '../../src/components/rpg/jewel-catalog';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
function setup(){const items=new RpgItemsStore(':memory:'),lobby=new LobbyLedger();const wallet=lobby.connect('socket',undefined)!;return {items,lobby,wallet,account:'a'.repeat(64),link:items.link('a'.repeat(64))};}
test('shop charges server catalog price, binds real guest inventory, and repeated receipt never charges twice',()=>{
 const s=setup();try{const def=JEWEL_CATALOG.find(j=>j.kind==='large')!,p={jewelId:def.id,requestId:'shop-request-00001',link:s.link,price:0};
 const first=buyShopJewel(s.lobby,s.items,'socket',p);assert.equal(first.account.multi,5000-def.price);assert.equal(first.items.jewels!.length,1);const j=first.items.jewels![0];assert.match(j.instanceId,/^[a-f0-9]{32}$/);assert.ok(j.seed>=1&&j.seed<=10000);
 const second=buyShopJewel(s.lobby,s.items,'socket',p);assert.deepEqual(second.items.jewels,first.items.jewels);assert.equal(second.account.multi,first.account.multi);assert.equal(s.items.jewels('b'.repeat(64)).length,0);
 assert.throws(()=>buyShopJewel(s.lobby,s.items,'socket',{...p,jewelId:'gloriousvanity'}),/상품/);
 }finally{s.items.close();}
});
test('insufficient chips, absent identity, invalid product, variant and seated player cannot create a grant',()=>{
 const s=setup();try{const base={jewelId:'gloriousvanity',link:s.link,requestId:'shop-request-00002'};
 for(const p of [{...base,link:'b'.repeat(64)},{...base,jewelId:'fake'},{...base,conqueror:'fake'},{...base,requestId:'bad'}])assert.throws(()=>buyShopJewel(s.lobby,s.items,'socket',p));
 assert.throws(()=>buyShopJewel(s.lobby,s.items,'unknown',base));s.lobby.reserve('socket');assert.throws(()=>buyShopJewel(s.lobby,s.items,'socket',base),/퇴장/);s.lobby.release('socket');
 s.lobby.purchase('socket',4999,()=>true);assert.throws(()=>buyShopJewel(s.lobby,s.items,'socket',base),/부족/);assert.equal(s.items.jewels(s.account).length,0);assert.equal(s.lobby.view('socket')!.multi,1);
 }finally{s.items.close();}
});
test('SQL grant failure leaves wallet and inventory unchanged; retry succeeds',()=>{
 const s=setup();try{const p={jewelId:'lethalpride',requestId:'shop-request-00003',link:s.link};s.items.db.exec("CREATE TRIGGER reject_purchase BEFORE INSERT ON rpg_jewel_receipts BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
 assert.throws(()=>buyShopJewel(s.lobby,s.items,'socket',p));assert.equal(s.lobby.view('socket')!.multi,5000);assert.equal(s.items.jewels(s.account).length,0);assert.equal(s.items.view(s.account).revision,0);
 s.items.db.exec('DROP TRIGGER reject_purchase');buyShopJewel(s.lobby,s.items,'socket',p);assert.equal(s.lobby.view('socket')!.multi,3200);assert.equal(s.items.jewels(s.account).length,1);
 }finally{s.items.close();}
});
test('paired Forbidden jewels have the same account seed and purchases survive store reopen',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'jewel-shop-')),file=path.join(dir,'items.sqlite'),account='c'.repeat(64);let store=new RpgItemsStore(file);
 try{const pair=JEWEL_CATALOG.filter(j=>j.pair);assert.equal(pair.length,2);pair.forEach((d,i)=>store.purchaseJewel(account,d.id,`shop-pair-request-${i}`));const before=store.jewels(account);assert.equal(before.length,2);assert.equal(before[0].seed,before[1].seed);store.close();store=new RpgItemsStore(file);assert.deepEqual(store.jewels(account),before);assert.equal(store.purchaseJewel(account,pair[0].id,'shop-pair-request-0'),false);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('cooldown UI uses captured total, decreases to zero, handles malformed input and 0.1s edge',()=>{
 assert.deepEqual(skillCooldown(5,5),{cooling:true,remaining:5,fraction:1,label:'5'});assert.equal(skillCooldown(2.5,5).fraction,.5);assert.equal(skillCooldown(.1,5).label,'0.1');assert.equal(skillCooldown(0,5).cooling,false);assert.equal(skillCooldown(-2,5).fraction,0);assert.equal(skillCooldown(NaN,0).cooling,false);assert.equal(skillCooldown(6,3).fraction,1);
});

test('real RogueService checks immutable ownership, persists equip/unequip, retries sequence once, and caches unchanged graph revision',async()=>{
 const {RogueService}=await import('../../src/lib/rpg-rogue-service'),{RpgStore}=await import('../../src/lib/rpg-store'),{CORE_EDGES}=await import('../../src/components/rpg/hunt-build');
 const store=new RpgStore(':memory:'),items=new RpgItemsStore(':memory:'),account='d'.repeat(64),other='e'.repeat(64),service=new RogueService(()=>0,()=>123,store,items),input={x:0,y:0,auto:false,paused:true};
 try{let v=service.start(account,'hong'),seq=0;const queue=[['root']],seen=new Set<string>();let route:string[]=[];for(let i=0;i<queue.length;i++){const p=queue[i],last=p.at(-1)!;if(last==='jewel_1'){route=p;break;}if(seen.has(last))continue;seen.add(last);for(const [a,b] of CORE_EDGES){if(a===last)queue.push([...p,b]);if(b===last)queue.push([...p,a]);}}assert.ok(route.length>1);
 for(const id of route.slice(1))v=service.command(account,v.id,++seq,input,`core-allocate-${id}`);
 items.purchaseJewel(other,'lethalpride','foreign-request-0001');const foreign=items.jewels(other)[0];assert.throws(()=>service.command(account,v.id,seq+1,input,`jewel-equip:jewel_1:${foreign.instanceId}`),/보유하지/);
 items.purchaseJewel(account,'lethalpride','owned-request-00001');const own=items.jewels(account)[0];v=service.command(account,v.id,++seq,input,`jewel-equip:jewel_1:${own.instanceId}`);assert.equal(v.build.state.jewels![0].seed,own.seed);assert.equal(v.build.state.jewels![0].conqueror,own.conqueror);assert.ok(v.build.tree.transformations.length>0);
 assert.equal(service.command(account,v.id,seq,input,`jewel-equip:jewel_1:${own.instanceId}`),v);const rev=v.buildRevision,tree=v.build.tree;v=service.command(account,v.id,++seq,input);assert.equal(v.buildRevision,rev);assert.equal(v.build.tree,tree);
 v=service.start(account,'hong');assert.equal(v.build.state.jewels![0].instanceId,own.instanceId);v=service.command(account,v.id,1,input,'jewel-unequip:jewel_1');assert.equal(v.build.state.jewels?.length??0,0);assert.equal(service.start(account,'hong').build.state.jewels?.length??0,0);
 }finally{store.close();items.close();}
});
