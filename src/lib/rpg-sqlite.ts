import type {DatabaseSync} from 'node:sqlite';
const active=new WeakSet<DatabaseSync>();
/** One connection is shared within each process; nesting joins the same all-or-nothing transaction. */
export function sqliteAtomic<T>(db:DatabaseSync,fn:()=>T):T{if(active.has(db))return fn();db.exec('BEGIN IMMEDIATE');active.add(db);try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}finally{active.delete(db);}}

/** Configure waiting before journal-mode changes: web and poker can boot against one fresh file. */
export function configureSqlite(db:DatabaseSync){
 db.exec('PRAGMA busy_timeout=5000');
 for(let attempt=0;;attempt++)try{const row=db.prepare('PRAGMA journal_mode').get() as {journal_mode:string};if(row.journal_mode!=='wal'&&row.journal_mode!=='memory')db.exec('PRAGMA journal_mode=WAL');break;}catch(error){const code=(error as {errcode?:number}).errcode;if((code!==5&&code!==6)||attempt>=4)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*2**attempt);}
}
