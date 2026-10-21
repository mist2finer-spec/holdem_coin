import test from 'node:test';import assert from 'node:assert/strict';
import {LobbyLedger} from '../mini-services/poker-server/lobby-ledger';
import {formatCurrency} from '../src/lib/format-currency';
test('currency suffixes use raw chips and never round above balance',()=>{
 for(const [n,s] of [[9999,'9,999'],[10000,'10K'],[10599,'10.5K'],[999999,'999.9K'],[1000000,'1M'],[1500000000,'1.5B']] as const)assert.equal(formatCurrency(n),s);
});
test('tester names are unique; same identity cannot occupy two seats; balances survive reconnect in one runtime',()=>{
 const l=new LobbyLedger(),a=l.connect('a',undefined)!,b=l.connect('b',undefined)!;
 assert.equal(a.name,'테스터1');assert.equal(b.name,'테스터2');assert.equal(l.leaderboard().length,0);
 l.connect('a2',a.token);assert.ok(l.reserve('a'));assert.equal(l.reserve('a2'),false);
 assert.equal(l.start('a'),5000);l.sync('a',6700);
 l.recharge('a');assert.equal(l.view('a')!.multi,11700);assert.equal(l.takeCredit('a'),5000);assert.equal(l.takeCredit('a'),0);
 assert.equal(l.view('a')!.multi,11700);l.disconnect('a');assert.equal(l.reserve('a2'),false);
 l.release('a',11700);assert.ok(l.reserve('a2'));assert.equal(l.start('a2'),11700);assert.equal(l.leaderboard()[0].amount,11700);
});
