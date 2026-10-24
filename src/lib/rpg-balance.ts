import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {DEFAULT_HUNT_BALANCE,type HuntBalance} from '../components/rpg/hunt-progression';
export function loadHuntBalance(filename=process.env.RPG_BALANCE_PATH):HuntBalance{
 const privateFile=path.join(process.cwd(),'data/rpg-reference/runtime-balance.json');
 if(!filename&&existsSync(/* turbopackIgnore: true */ privateFile))filename=privateFile;
 if(!filename)return structuredClone(DEFAULT_HUNT_BALANCE);
 const b=JSON.parse(readFileSync(/* turbopackIgnore: true */ filename,'utf8')) as HuntBalance;
 if(b.version!==1||!Number.isSafeInteger(b.maxLevel)||b.maxLevel<2||b.maxLevel>10000||typeof b.source!=='string')throw Error('Invalid RPG balance');
 for(const name of ['team','weapon','armor'] as const){const curves=b[name];
  if(!Array.isArray(curves)||!curves.length||curves.length>2000)throw Error('Invalid curve list');
  for(let i=0;i<curves.length;i++){const c=curves[i];if(!c||!['min','max','base','inc','rate','scaler'].every(k=>Number.isFinite(c[k as keyof typeof c]))||c.scaler<=0||c.min<1||c.max<=c.min||!Number.isInteger(c.min)||!Number.isInteger(c.max)||i>0&&c.min<curves[i-1].max)throw Error('Invalid curve');}}
 if(!b.reward||!['gold','xp','soulGem'].every(k=>Number.isSafeInteger(b.reward[k as keyof typeof b.reward])&&b.reward[k as keyof typeof b.reward]>=0&&b.reward[k as keyof typeof b.reward]<=10000))throw Error('Invalid RPG reward');
 return b;
}
