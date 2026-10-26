import {DEVELOPMENT,ABILITY_ORDER} from '../components/rpg/hunt-development';
import {WEAPON_TYPES,isWeaponType} from '../components/rpg/hunt-weapons';
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
  // Additive migration
  const defaults=newHuntProgress();
  for(const k of ['labyrinthStage','labyrinthCompleted','combatArts','traits','masteryLevel','masteryEssence','willLevel','soulOrb','skillLevels','skillCopies','skillEnabled'] as const)if(progress[k]===undefined)(progress as any)[k]=defaults[k];
  const record=(x:unknown)=>!!x&&typeof x==='object'&&!Array.isArray(x);
  if(!record(progress.combatArts)||Object.entries(progress.combatArts).some(([id,n])=>!DEVELOPMENT.arts.some(a=>a.id===Number(id)&&a.id!==101&&a.id!==102&&Number.isInteger(n)&&n>=0&&n<=a.max)))throw Error('Invalid combat arts');
  if(!record(progress.traits)||Object.entries(progress.traits).some(([id,n])=>!ABILITY_ORDER.includes(Number(id))||!Number.isInteger(n)||n<0||n>10))throw Error('Invalid traits');
  if(Object.values(progress.traits).reduce((a,b)=>a+b,0)>Math.max(0,progress.level-1))throw Error('Invalid trait points');
  for(const [key,max,min] of [['skillLevels',50,1],['skillCopies',1e12,0],['skillEnabled',1,0]] as const)if(!Array.isArray(progress[key])||progress[key].length!==6||progress[key].some(n=>!Number.isSafeInteger(n)||n<min||n>max))throw Error('Invalid skills');
  if(progress.masteryLevel<1||progress.masteryLevel>10||progress.willLevel>100)throw Error('Invalid development');
  // Additive migration preserves balances in existing guest JSON rows.
  if(progress.attackTraining===undefined)progress.attackTraining=0;
  if(progress.healthTraining===undefined)progress.healthTraining=0;
  if(!Number.isSafeInteger(progress.attackTraining)||!Number.isSafeInteger(progress.healthTraining)||progress.attackTraining<0||progress.healthTraining<0||progress.attackTraining>500||progress.healthTraining>500)throw Error('Invalid training');
  if(progress.potions===undefined)progress.potions=3;
  if(progress.questTier===undefined)progress.questTier=0;
  if(progress.weaponType===undefined)progress.weaponType='axe';
  if(progress.weaponLevels===undefined)progress.weaponLevels={unarmed:1,sword:1,axe:progress.weaponLevel,dual:1,spear:1};
  if(progress.weaponLevels.unarmed===undefined)progress.weaponLevels.unarmed=1;
  if(!isWeaponType(progress.weaponType)||!progress.weaponLevels||WEAPON_TYPES.some(w=>!Number.isSafeInteger(progress.weaponLevels[w])||progress.weaponLevels[w]<1||progress.weaponLevels[w]>1e12)||progress.weaponLevels[progress.weaponType]!==progress.weaponLevel)throw Error('Invalid saved weapons');
  for(const value of Object.entries(progress).filter(([key])=>!['weaponType','weaponLevels','combatArts','traits','skillLevels','skillCopies','skillEnabled'].includes(key)))if(typeof value[1]!=='number'||!Number.isSafeInteger(value[1])||value[1]<0||value[1]>(value[0]==='xp'?Number.MAX_SAFE_INTEGER:1e12))throw Error('Invalid saved progress');
  if(progress.labyrinthStage>=6000||progress.labyrinthCompleted>1)throw Error('Invalid labyrinth progress');
  if(!progress.level||!progress.weaponLevel||!progress.armorLevel)throw Error('Invalid saved levels');
  return {progress,revision:row.revision};
 }
 save(id:string,progress:HuntProgress,revision:number){
  const result=this.db.prepare('UPDATE rpg_players SET progress=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(progress),Date.now(),id,revision);
  if(result.changes!==1)throw Error('다른 세션에서 진행이 변경됐습니다. 다시 입장해 주세요.');return revision+1;
 }
 close(){this.db.close();}
}
