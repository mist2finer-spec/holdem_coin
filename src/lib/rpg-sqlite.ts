import type {DatabaseSync} from 'node:sqlite';
const active=new WeakSet<DatabaseSync>();
/** One connection is shared within each process; nesting joins the same all-or-nothing transaction. */
export function sqliteAtomic<T>(db:DatabaseSync,fn:()=>T):T{if(active.has(db))return fn();db.exec('BEGIN IMMEDIATE');active.add(db);try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}finally{active.delete(db);}}
