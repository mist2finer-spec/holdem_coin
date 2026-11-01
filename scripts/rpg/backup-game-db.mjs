// Run at runtime (or with services stopped), never during a Render build.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const [source,output]=process.argv.slice(2);
if(!source||!output)throw Error('Usage: node scripts/rpg/backup-game-db.mjs SOURCE.sqlite NEW-BACKUP.sqlite');
if(!existsSync(source)||existsSync(output)||path.resolve(source)===path.resolve(output))throw Error('Source must exist; backup must be a new, different file');
mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
const db=new DatabaseSync(source);try{db.exec('PRAGMA busy_timeout=5000');if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Source integrity check failed');db.prepare('VACUUM INTO ?').run(path.resolve(output));}finally{db.close();}
const copy=new DatabaseSync(output,{readOnly:true});try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');}finally{copy.close();}
console.log('BACKUP_OK');
