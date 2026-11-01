import {DatabaseSync} from 'node:sqlite';import {existsSync,mkdirSync,readFileSync} from 'node:fs';import path from 'node:path';
import {RpgStore} from './rpg-store';import {RpgItemsStore} from './rpg-items';import {sqliteAtomic,configureSqlite} from './rpg-sqlite';
export function gameDatabasePath(){return path.join(process.env.RPG_SAVE_DIR||path.join(process.cwd(),'.data/rpg'),'game.sqlite');}
export function createGameStorage(filename=gameDatabasePath()){
 if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename);configureSqlite(db);const progress=new RpgStore(filename,db),items=new RpgItemsStore(filename,db);
 db.exec('CREATE TABLE IF NOT EXISTS storage_migrations(source TEXT PRIMARY KEY,at INTEGER NOT NULL)');
 if(filename!==':memory:')for(const source of ['players.sqlite','items.sqlite']){
  const old=path.join(/* turbopackIgnore: true */ path.dirname(filename),source);if(!existsSync(/* turbopackIgnore: true */ old)||path.resolve(/* turbopackIgnore: true */ old)===path.resolve(/* turbopackIgnore: true */ filename)||db.prepare('SELECT 1 FROM storage_migrations WHERE source=?').get(source))continue;
  db.prepare('ATTACH DATABASE ? AS legacy_game').run(old);
  try{sqliteAtomic(db,()=>{if(db.prepare('SELECT 1 FROM storage_migrations WHERE source=?').get(source))return;for(const table of ['rpg_players','rpg_items','rpg_item_events','rpg_jewels','rpg_jewel_receipts','rpg_item_rewards','rpg_item_requests'])if(db.prepare("SELECT 1 FROM legacy_game.sqlite_master WHERE type='table' AND name=?").get(table))db.exec(`INSERT OR IGNORE INTO main.${table} SELECT * FROM legacy_game.${table}`);db.prepare('INSERT INTO storage_migrations VALUES(?,?)').run(source,Date.now());});}finally{db.exec('DETACH DATABASE legacy_game');}
 }
 return {db,progress,items,path:filename,close:()=>db.close()};
}
let singleton:ReturnType<typeof createGameStorage>|undefined;
export function gameStorage(){return singleton??(singleton=createGameStorage());}
export function storageStatus(){
 let mounted=false;const directory=path.resolve(/* turbopackIgnore: true */ path.dirname(gameDatabasePath()));
 if(process.env.RPG_STORAGE_DURABLE==='1'&&process.platform==='linux')try{mounted=readFileSync(/* turbopackIgnore: true */ '/proc/self/mountinfo','utf8').split('\n').some(line=>{const mount=line.split(' ')[4]?.replace(/\\040/g,' ');return !!mount&&mount!=='/'&&(directory===mount||directory.startsWith(mount+'/'));});}catch{}
 return {provider:'sqlite' as const,persistence:mounted?'configured-persistent-volume':'ephemeral',atomicWallet:true};
}
