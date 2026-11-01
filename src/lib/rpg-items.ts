import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {randomBytes,randomInt} from 'node:crypto';
import path from 'node:path';
import {JEWELS_BY_ID} from '../components/rpg/jewel-catalog';
import type {JewelInstance} from '../components/rpg/jewel-system';
import {TRANSCEND_OUTCOMES,type TranscendOutcome,type BuildItems} from '../components/rpg/transcendence';
export type {BuildItems} from '../components/rpg/transcendence';
/** Shared web/poker reward wallet. SQL uniqueness is the authority, never a client winner claim. */
export class RpgItemsStore{
 readonly db:DatabaseSync;
 constructor(filename:string){if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS rpg_items(account TEXT PRIMARY KEY,orbs INTEGER NOT NULL DEFAULT 5,transcended TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,link TEXT UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_jewels(instance TEXT PRIMARY KEY,account TEXT NOT NULL,jewel TEXT NOT NULL,seed INTEGER NOT NULL,conqueror TEXT);
 CREATE TABLE IF NOT EXISTS rpg_jewel_receipts(id TEXT PRIMARY KEY,account TEXT NOT NULL,jewel TEXT NOT NULL,variant TEXT NOT NULL,instance TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_item_events(id TEXT PRIMARY KEY,account TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL);`);}
 private ensure(account:string){this.db.prepare('INSERT OR IGNORE INTO rpg_items(account,link) VALUES(?,?)').run(account,randomBytes(32).toString('hex'));}
 view(account:string):BuildItems{this.ensure(account);const row=this.db.prepare('SELECT * FROM rpg_items WHERE account=?').get(account) as any;return {jewels:this.jewels(account),testCollection:true,orbs:row.orbs,transcended:JSON.parse(row.transcended),revision:row.revision,recent:(this.db.prepare('SELECT kind FROM rpg_item_events WHERE account=? ORDER BY created DESC,rowid DESC LIMIT 6').all(account) as {kind:string}[]).map(r=>r.kind)};}
 link(account:string){this.ensure(account);return (this.db.prepare('SELECT link FROM rpg_items WHERE account=?').get(account) as {link:string}).link;}
 resolve(link:unknown){if(typeof link!=='string'||!/^[a-f0-9]{64}$/.test(link))return null;return (this.db.prepare('SELECT account FROM rpg_items WHERE link=?').get(link) as {account:string}|undefined)?.account??null;}
 private atomic<T>(fn:()=>T){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 awardChampion(tournamentId:string,account:string){return this.atomic(()=>{this.ensure(account);const id=`champion:${tournamentId}`;const exists=this.db.prepare('SELECT account FROM rpg_item_events WHERE id=?').get(id);if(exists)return false;this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,'토너먼트 1위 · 초월석 +1',Date.now());this.db.prepare('UPDATE rpg_items SET orbs=MIN(1000000,orbs+1),revision=revision+1 WHERE account=?').run(account);return true;});}
 transcend(account:string,target:string,request:string,revision:number,roll=()=>randomInt(4)){
  if(!/^(gem:[a-z]+|gear:(axe|sword|dual|spear))$/.test(target)||!/^[-a-zA-Z0-9]{16,80}$/.test(request)||!Number.isSafeInteger(revision))throw Error('잘못된 초월 요청입니다.');
  return this.atomic(()=>{const id=`transcend:${account}:${request}`,old=this.db.prepare('SELECT kind FROM rpg_item_events WHERE id=?').get(id);if(old)return this.view(account);
   const v=this.view(account);if(v.revision!==revision)throw Error('다른 창에서 보관함이 변경됐습니다. 다시 열어 주세요.');if(v.orbs<1)throw Error('초월석이 부족합니다.');if(v.transcended[target])throw Error('이미 초월한 대상입니다.');const n=roll();if(!Number.isInteger(n)||n<0||n>3)throw Error('Invalid roll');const outcome=(Object.keys(TRANSCEND_OUTCOMES) as TranscendOutcome[])[n];v.transcended[target]=outcome;
   this.db.prepare('UPDATE rpg_items SET orbs=orbs-1,transcended=?,revision=revision+1 WHERE account=?').run(JSON.stringify(v.transcended),account);this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,`${target} · ${TRANSCEND_OUTCOMES[outcome].name} 초월`,Date.now());return this.view(account);
  });
 }
 jewels(account:string):JewelInstance[]{return (this.db.prepare('SELECT instance,jewel,seed,conqueror FROM rpg_jewels WHERE account=? ORDER BY rowid').all(account) as {instance:string;jewel:string;seed:number;conqueror:string|null}[]).map(r=>({instanceId:r.instance,jewelId:r.jewel,seed:r.seed,...(r.conqueror?{conqueror:r.conqueror}:{})}));}
 /** Called inside a synchronous wallet purchase. A duplicate receipt grants and charges nothing. */
 purchaseJewel(account:string,jewelId:string,requestId:string,conqueror?:string){
  const def=JEWELS_BY_ID.get(jewelId);if(!def||typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))throw Error('잘못된 주얼 구매 요청입니다.');
  const variant=conqueror??def.variants?.[0]??'';if(def.variants?!def.variants.includes(variant):variant!=='')throw Error('주얼 변종이 올바르지 않습니다.');
  return this.atomic(()=>{this.ensure(account);const id=`jewel:${account}:${requestId}`,old=this.db.prepare('SELECT jewel,variant FROM rpg_jewel_receipts WHERE id=?').get(id) as {jewel:string;variant:string}|undefined;
   if(old){if(old.jewel!==jewelId||old.variant!==variant)throw Error('같은 구매 번호의 상품을 변경할 수 없습니다.');return false;}
   if(this.jewels(account).length>=200)throw Error('주얼 보관함이 가득 찼습니다. (200개)');
   // Matched Forbidden pair uses the same account seed; ordinary seeds are immutable random values.
   const seed=def.pair?(parseInt(account.slice(0,8),16)||0)%10000+1:randomInt(1,10001),instance=randomBytes(16).toString('hex');
   this.db.prepare('INSERT INTO rpg_jewels VALUES(?,?,?,?,?)').run(instance,account,jewelId,seed,variant||null);
   this.db.prepare('INSERT INTO rpg_jewel_receipts VALUES(?,?,?,?,?)').run(id,account,jewelId,variant,instance);
   this.db.prepare('UPDATE rpg_items SET revision=revision+1 WHERE account=?').run(account);
   this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,`${def.name} 구매`,Date.now());return true;
  });
 }
 jewelReceipt(account:string,requestId:string){return !!this.db.prepare('SELECT 1 FROM rpg_jewel_receipts WHERE id=? AND account=?').get(`jewel:${account}:${requestId}`,account);}
 close(){this.db.close();}
}
