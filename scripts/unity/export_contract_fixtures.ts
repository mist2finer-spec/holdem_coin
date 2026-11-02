/** Captured from the real current RPG service with an in-memory profile; no database created. */
import fs from 'node:fs';
import {RogueService} from '../../src/lib/rpg-rogue-service';
const service=new RogueService(()=>100,()=>7,undefined,undefined,true,()=>1800000000000);
const input={x:0,y:0,auto:false};
const full=service.start('unity-contract','hong');
const equipped=service.command('unity-contract',full.id,1,input,'idle-socket-starter_ring2-0-heal');
const removed=service.command('unity-contract',full.id,2,input,'idle-socket-starter_ring2-0-empty');
function pick(v:typeof full){return {id:v.id,sequence:v.sequence,status:v.status,buildRevision:v.buildRevision,cooldowns:v.cooldowns,resources:v.resources,progress:{equipment:v.progress.equipment,gemCollection:v.progress.gemCollection,gacha:v.progress.gacha,skillEnabled:v.progress.skillEnabled},compiled:{skills:v.compiled.skills},build:{state:{equipment:v.build.state.equipment},skills:v.build.skills,tree:{nodes:v.build.tree.nodes.slice(0,2)}}};}
const fixtures={schema:1,full:pick(full),equipped:pick(equipped),removed:pick(removed)};
fs.mkdirSync('scripts/unity/contracts/fixtures',{recursive:true});fs.writeFileSync('scripts/unity/contracts/fixtures/rpg-current.json',JSON.stringify(fixtures,null,2)+'\n');
console.log('UNITY_RPG_FIXTURES_READY fresh empty / ring2 equip / ring2 remove from real RogueService');
