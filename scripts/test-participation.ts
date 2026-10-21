import test from 'node:test';
import assert from 'node:assert/strict';
import {supportTightParticipation} from '../src/lib/poker-participation';
import {RPG_BOT_POOL} from '../src/lib/personas';
const base=RPG_BOT_POOL.find(p=>p.id==='paladin_commander')!;
const ctx:Parameters<typeof supportTightParticipation>[1]={base,hand:1,seat:0,hole:[{rank:'A',suit:'♠'},{rank:'Q',suit:'♥'}],board:[],call:200,stack:5000,starting:5000,currentBet:0,raiseLevel:0,minRaise:400,maxRaise:5000,canRaise:true,pot:300,opponents:1};
const fold={action:'fold' as const,amount:0};
test('tight entry support opens eligible hands below target, then stops above target',()=>{
 const table={};const first=supportTightParticipation(table,ctx,fold);
 assert.equal(first.action.action,'raise');assert.equal(first.participation?.observed,1);
 assert.equal(supportTightParticipation(table,{...ctx,hand:2},fold).action.action,'fold');
});
test('support never manufactures a dry side pot or overrides 3-bet folds',()=>{
 assert.equal(supportTightParticipation({}, {...ctx,canRaise:false},fold).action.action,'fold');
 assert.equal(supportTightParticipation({}, {...ctx,raiseLevel:2},fold).action.action,'fold');
});
test('short weak hands remain folded and room statistics are isolated',()=>{
 const weak:typeof ctx={...ctx,starting:1000,stack:1000,maxRaise:1000,hole:[{rank:'K',suit:'♠'},{rank:'J',suit:'♥'}]};
 assert.equal(supportTightParticipation({},weak,fold).action.action,'fold');
 assert.equal(supportTightParticipation({},ctx,fold).participation?.supported,true);
 assert.equal(supportTightParticipation({},ctx,fold).participation?.supported,true);
});
