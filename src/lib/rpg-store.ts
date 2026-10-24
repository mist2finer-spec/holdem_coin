import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {newHuntProgress,type HuntProgress} from '../components/rpg/hunt-progression';
export class RpgStore{
 readonly db:DatabaseSync;
 constructor(filename:string){if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});
  this.db=new DatabaseSync(filename);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS rpg_players (id TEXT PRIMARY KEY, progress TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)');}
 load(id:string){
  let row=this.db.prepare('SELECT progress,revision FROM rpg_players WHERE id=?').get(id) as {progress:string;revision:number}|undefined;
  if(!row){const count=this.db.prepare('SELECT COUNT(*) AS n FROM rpg_players').get() as {n:number};if(count.n>=10000)throw Error('RPG guest capacity reached');
   this.db.prepare('INSERT OR IGNORE INTO rpg_players(id,progress,updated_at) VALUES(?,?,?)').run(id,JSON.stringify(newHuntProgress()),Date.now());
   row=this.db.prepare('SELECT progress,revision FROM rpg_players WHERE id=?').get(id) as {progress:string;revision:number};}
  const progress=JSON.parse(row.progress) as HuntProgress;
  for(const value of Object.values(progress))if(!Number.isSafeInteger(value)||value<0||value>1e12)throw Error('Invalid saved progress');
  if(!progress.level||!progress.weaponLevel||!progress.armorLevel)throw Error('Invalid saved levels');
  return {progress,revision:row.revision};
 }
 save(id:string,progress:HuntProgress,revision:number){
  const result=this.db.prepare('UPDATE rpg_players SET progress=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(progress),Date.now(),id,revision);
  if(result.changes!==1)throw Error('다른 세션에서 진행이 변경됐습니다. 다시 입장해 주세요.');return revision+1;
 }
 close(){this.db.close();}
}
