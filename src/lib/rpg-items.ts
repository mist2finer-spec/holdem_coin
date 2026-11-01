import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {randomBytes,randomInt} from 'node:crypto';
import path from 'node:path';
import {TRANSCEND_OUTCOMES,type TranscendOutcome,type BuildItems} from '../components/rpg/transcendence';
export type {BuildItems} from '../components/rpg/transcendence';
/** Shared web/poker reward wallet. SQL uniqueness is the authority, never a client winner claim. */
export class RpgItemsStore{
 readonly db:DatabaseSync;
 constructor(filename:string){if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS rpg_items(account TEXT PRIMARY KEY,orbs INTEGER NOT NULL DEFAULT 5,transcended TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,link TEXT UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_item_events(id TEXT PRIMARY KEY,account TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL);`);}
 private ensure(account:string){this.db.prepare('INSERT OR IGNORE INTO rpg_items(account,link) VALUES(?,?)').run(account,randomBytes(32).toString('hex'));}
 view(account:string):BuildItems{this.ensure(account);const row=this.db.prepare('SELECT * FROM rpg_items WHERE account=?').get(account) as any;return {testCollection:true,orbs:row.orbs,transcended:JSON.parse(row.transcended),revision:row.revision,recent:(this.db.prepare('SELECT kind FROM rpg_item_events WHERE account=? ORDER BY created DESC,rowid DESC LIMIT 6').all(account) as {kind:string}[]).map(r=>r.kind)};}
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
 close(){this.db.close();}
}
