import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionContext } from '../src/lib/poker-position.ts';
import { SelfPlayTrainer } from '../src/lib/self-play-trainer.ts';
import { decideLiveBot, normalizeLiveAction } from '../src/lib/poker-live.ts';
import type { BettingSeat } from '../src/lib/poker-rules.ts';
import type { Card } from '../src/lib/poker-engine.ts';
import { individualLivePersona, applyStrategyToPersona, RPG_BOT_POOL } from '../src/lib/personas.ts';
import { oopCheckMix } from '../src/lib/poker-position.ts';
import { applyStackTraits, stackBand, stackContext } from '../src/lib/poker-stack.ts';
import { shortStackOptions } from '../src/lib/poker-shortstack.ts';
import { estimateEquity } from '../src/lib/poker-ai.ts';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({rank, suit});
const hole = [card('A', '♠'), card('A', '♥')];
const board = [card('A', '♦'), card('8', '♣'), card('2', '♥')];
const trainer = new SelfPlayTrainer();
const persona = {vpip: 0.35, aggression: 0.8, bluffFreq: 0.2};
const seats = (ids = [0, 1]): BettingSeat[] => ids.map(seatId => ({
  seatId, stack: 20000, currentBet: 0, totalBet: 1000,
  inHand: true, folded: false, allIn: false,
}));

function withSeed<T>(run: () => T): T {
  const original = Math.random;
  let seed = 1987;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return run(); } finally { Math.random = original; }
}

test('heads-up BTN/SB acts last postflop; BB is OOP', () => {
  assert.equal(positionContext(seats(), 0, 0).isOOP, false);
  assert.equal(positionContext(seats(), 1, 0).isOOP, true);
});

test('position skips folded, empty and all-in seats, including a folded button', () => {
  const table = seats([0, 2, 4, 7]);
  table[0].folded = true;
  table[1].allIn = true;
  assert.equal(positionContext(table, 4, 0).relativePosition, 0);
  assert.equal(positionContext(table, 7, 0).relativePosition, 1);
  table[3].inHand = false;
  assert.equal(positionContext(table, 4, 0).isOOP, false);
});

function sample(checked: boolean, call = 0, actorId = 1, cards = hole) {
  const table = seats();
  table.find(s => s.seatId !== actorId)!.currentBet = call;
  const counts = [0, 0, 0, 0, 0];
  withSeed(() => {
    for (let i = 0; i < 600; i++) {
      const decision = trainer.decideActionForLive(cards, board, call, call ? call * 2 : 200,
        20000, 2000, 20000, 0, 1, actorId, 2, call ? 1 : 0, 0, persona,
        {actorId, seats: table, position: positionContext(table, actorId, 0, checked)});
      counts[decision.action]++;
    }
  });
  return counts;
}

test('OOP monsters mix free checks and value bets; IP leads substantially more', () => {
  const oop = sample(false);
  const ip = sample(false, 0, 0);
  assert.ok(oop[1] > 200 && oop[1] < 500, JSON.stringify(oop));
  assert.ok(ip[1] < oop[1] - 100, JSON.stringify({oop, ip}));
  assert.equal(oop[0], 0);
});

test('after checking, OOP value hands check-raise more without becoming automatic', () => {
  const ordinary = sample(false, 600);
  const checked = sample(true, 600);
  assert.ok(checked[2] + checked[3] > ordinary[2] + ordinary[3], JSON.stringify({ordinary, checked}));
  assert.ok(checked[1] > 0);
});

test('air also checks, and facing a bet never returns a free check', () => {
  const air = [card('7', '♠'), card('4', '♦')];
  assert.ok(sample(false, 0, 1, air)[1] > 300);
  const table = seats();
  table[0].currentBet = 600;
  withSeed(() => {
    for (let i = 0; i < 40; i++) {
      const decision = decideLiveBot(trainer, {actor: {...table[1], holeCards: hole}, seats: table,
        board, pot: 2000, minRaise: 1200, maxRaise: 20000,
        button: 0, smallBlind: 0, bigBlind: 1, hand: 1, raiseLevel: 1, checkedThisStreet: true});
      assert.notEqual(decision.action, 'check');
      assert.ok(normalizeLiveAction(table, 1, decision, 600));
    }
  });
});

test('position premium is bounded and leaves IP without an extra equity requirement', () => {
  assert.equal(positionContext(seats(), 1, 0).preflopEquityPremium, 0.07);
  assert.equal(positionContext(seats(), 0, 0).preflopEquityPremium, 0);
});

test('all table phases preserve distinct character traits without changing originals', () => {
  const calm = RPG_BOT_POOL.find(p => p.id === 'paladin_commander')!;
  const bold = RPG_BOT_POOL.find(p => p.id === 'orc_berserker')!;
  const before = JSON.stringify(RPG_BOT_POOL);
  for (const phase of ['AGGRESSIVE', 'TIGHT', 'LOOSE'] as const) {
    const a = applyStrategyToPersona(calm, phase), b = applyStrategyToPersona(bold, phase);
    assert.ok(a.vpip < b.vpip && a.aggression < b.aggression && a.bluffFreq < b.bluffFreq);
  }
  assert.equal(JSON.stringify(RPG_BOT_POOL), before);
});

test('tight short stacks surge more often than deep stacks and aggressive characters', () => {
  const calm = RPG_BOT_POOL.find(p => p.id === 'paladin_commander')!;
  const bold = RPG_BOT_POOL.find(p => p.id === 'orc_berserker')!;
  let short = 0, deep = 0, aggressive = 0;
  for (let hand = 1; hand <= 2000; hand++) {
    const s = individualLivePersona(calm, hand, 1, 10000);
    const d = individualLivePersona(calm, hand, 1, 10001);
    short += Number(s.surge); deep += Number(d.surge);
    aggressive += Number(individualLivePersona(bold, hand, 1, 10000).surge);
    if (s.surge) assert.ok(s.vpip >= 0.4099 && s.aggression >= 0.78 && s.aggression <= 0.95);
    if (d.surge) assert.equal(s.surge, true);
  }
  assert.ok(short > 650 && short < 950, `${short}`);
  assert.ok(deep > 160 && deep < 330, `${deep}`);
  assert.ok(aggressive < deep && deep < short);
});

test('live decision keeps the same personality while chips move into the pot', () => {
  const base = RPG_BOT_POOL.find(p => p.id === 'paladin_commander')!;
  const received: unknown[] = [];
  const spy = {decideActionForLive: (...args: unknown[]) => { received.push(args[13]); return {action:1,amount:0}; }} as unknown as SelfPlayTrainer;
  for (const committed of [0, 200, 4000]) {
    const table = seats();
    table[0].stack = 10000 - committed;
    table[0].totalBet = committed;
    decideLiveBot(spy, {actor:{...table[0],holeCards:hole,persona:base},seats:table,
      board,pot:4000,minRaise:200,maxRaise:table[0].stack,button:0,smallBlind:0,bigBlind:1,hand:20,raiseLevel:0});
  }
  assert.deepEqual(received[0], received[1]);
  assert.deepEqual(received[0], received[2]);
  assert.deepEqual(received[0], individualLivePersona(base, 20, 0, 10000));
});

test('OOP mixtures depend on character aggression and wet board texture', () => {
  const calm = {vpip:0.18,aggression:0.20}, bold = {vpip:0.65,aggression:0.85};
  const dry = [card('A','♠'),card('8','♥'),card('2','♦')];
  const wet = [card('T','♠'),card('J','♠'),card('Q','♠')];
  assert.ok(oopCheckMix(calm, 4, 1, dry) > oopCheckMix(bold, 4, 1, dry));
  assert.ok(oopCheckMix(calm, 4, 1, wet) < oopCheckMix(calm, 4, 1, dry));
  assert.ok(oopCheckMix(calm, 4, 3, dry) > oopCheckMix(calm, 4, 1, dry));
});

test('stack bands tighten low-chip entry and boost aggression starting at exactly 25k', () => {
  const amounts = [1000, 2000, 5000, 10000, 15000, 24999];
  const persona = {vpip:0.4,aggression:0.6,bluffFreq:0.2};
  const profiles = amounts.map(chips => applyStackTraits(persona, chips));
  const boundaries = [[0,1000],[1000,1000],[1001,2000],[2000,2000],[2001,5000],
    [5000,5000],[5001,10000],[10000,10000],[10001,15000],[15000,15000],
    [15001,25000],[24999,25000],[25000,Infinity],[25001,Infinity],[50000,Infinity]];
  for (const [chips,limit] of boundaries) assert.equal(stackBand(chips).limit, limit);
  for (let i=1;i<profiles.length;i++) {
    assert.ok(profiles[i].vpip > profiles[i-1].vpip);
    assert.equal(profiles[i].aggression, profiles[i-1].aggression);
    assert.ok(profiles[i].bluffFreq > profiles[i-1].bluffFreq);
    assert.ok(stackBand(amounts[i]).equity < stackBand(amounts[i-1]).equity);
  }
  const deep = applyStackTraits(persona,25000);
  assert.ok(Math.abs(deep.aggression - 0.68) < 1e-10);
  assert.equal(deep.vpip,profiles.at(-1)!.vpip);
  assert.equal(deep.bluffFreq,profiles.at(-1)!.bluffFreq);
  assert.equal(applyStackTraits({...persona,aggression:0.93},25000).aggression,0.95);
  assert.equal(applyStackTraits(persona,1000).aggression,persona.aggression);
});

test('short pair decisions respect full-bet rake instead of forcing negative-EV jams', () => {
  for(const rank of ['6','7','9'] as Card['rank'][]) {
    const table=seats();
    Object.assign(table[0],{stack:2300,currentBet:200,totalBet:200});
    Object.assign(table[1],{stack:4500,currentBet:500,totalBet:500});
    const context={actorId:0,seats:table,stack:stackContext(table,0),position:positionContext(table,0,1)};
    const cards=[card(rank,'♠'),card(rank,'♥')];
    const p={vpip:0.16,aggression:0.45,bluffFreq:0.05};
    const options=shortStackOptions({hole:cards,board:[],call:300,minRaise:800,maxRaise:2500,
      pot:700,stack:2300,currentBet:200,raiseLevel:1,persona:p,context})!;
    const counts=[0,0,0,0,0];
    withSeed(()=>{for(let i=0;i<300;i++){
      const d=trainer.decideActionForLive(cards,[],300,800,2500,700,2300,200,1,0,2,1,1,p,context);
      counts[d.action]++;
      const mapped=d.action===4?{action:'allin',amount:2300}:d.action===2?{action:'raise',amount:d.amount}:d.action===1?{action:'call',amount:300}:{action:'fold',amount:0};
      assert.ok(normalizeLiveAction(table,0,mapped,300));
    }});
    if(Math.max(options.callEV,options.jamEV,options.strongRaiseEV)<=0)assert.equal(counts[0],300,JSON.stringify({rank,counts,options}));
    else assert.ok(counts[1]+counts[2]+counts[4]>0,JSON.stringify({rank,counts,options}));
    if(counts[4])assert.ok(options.jamEV>0);
    if(counts[2])assert.ok(options.strongRaiseEV>0);
  }
});

test('tight short stacks fold KQo/QJo to a small open and never fold a free BB check', () => {
  const table=seats();Object.assign(table[0],{stack:2300,currentBet:200,totalBet:200});
  Object.assign(table[1],{stack:4500,currentBet:500,totalBet:500});
  const context={actorId:0,seats:table,stack:stackContext(table,0),position:positionContext(table,0,1)};
  for(const [a,b] of [['K','Q'],['Q','J']] as [Card['rank'],Card['rank']][]) {
    const d=trainer.decideActionForLive([card(a,'♠'),card(b,'♥')],[],300,800,2500,800,2300,200,1,0,2,1,1,
      {vpip:0.12,aggression:0.3,bluffFreq:0.01},context);
    assert.equal(d.action,0);
  }
  const options=shortStackOptions({hole,board:[],call:0,minRaise:200,maxRaise:2500,pot:400,
    stack:2300,currentBet:200,raiseLevel:0,persona:{vpip:0.12,aggression:0.3,bluffFreq:0.01},context});
  assert.equal(options,null);
  const common={hole:[card('K','♠'),card('Q','♥')],board:[],call:300,minRaise:800,maxRaise:2500,
    pot:800,stack:2300,currentBet:200,raiseLevel:1,context};
  assert.equal(shortStackOptions({...common,persona:{vpip:0.12,aggression:0.3,bluffFreq:0.01}})!.playable,false);
  assert.equal(shortStackOptions({...common,persona:{vpip:0.4,aggression:0.85,bluffFreq:0.2}})!.playable,true);
});

test('jam-call range reduces medium-pair equity relative to random callers', () => {
  const cards=[card('6','♠'),card('6','♥')];
  const random=estimateEquity(cards,[],1,192);
  const called=estimateEquity(cards,[],1,192,'jam-call');
  assert.ok(called<random);
  assert.equal(called,estimateEquity(cards,[],1,192,'jam-call'));
});

test('short blind defense cannot turn a policy fold back into a speculative call', () => {
  const table=seats();Object.assign(table[0],{stack:2300,currentBet:200,totalBet:200});
  Object.assign(table[1],{stack:4500,currentBet:500,totalBet:500});
  const folding={decideActionForLive:()=>({action:0,amount:0})} as unknown as SelfPlayTrainer;
  withSeed(()=>{
    const d=decideLiveBot(folding,{actor:{...table[0],holeCards:[card('K','♠'),card('Q','♥')]},seats:table,
      board:[],pot:300,minRaise:800,maxRaise:2500,button:1,smallBlind:0,bigBlind:1,hand:1,raiseLevel:1});
    assert.equal(d.action,'fold');
  });
});

test('effective stack distinguishes deep-v-short and deep-v-deep without changing during bets', () => {
  const table=seats(); table[0].stack=30000; table[0].totalBet=0;
  table[1].stack=2500; table[1].totalBet=0;
  const short=stackContext(table,0);
  assert.equal(short.effectiveStack,2500); assert.equal(short.deepVsDeep,false);
  table[1].stack=25000;
  const deep=stackContext(table,0);
  assert.equal(deep.deepVsDeep,true); assert.ok(deep.equityPremium>short.equityPremium);
  table[0].stack-=5000; table[0].totalBet+=5000;
  table[1].stack-=5000; table[1].totalBet+=5000;
  assert.deepEqual(stackContext(table,0),deep);
});
