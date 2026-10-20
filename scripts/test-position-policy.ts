import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionContext } from '../src/lib/poker-position.ts';
import { SelfPlayTrainer } from '../src/lib/self-play-trainer.ts';
import { decideLiveBot, normalizeLiveAction } from '../src/lib/poker-live.ts';
import type { BettingSeat } from '../src/lib/poker-rules.ts';
import type { Card } from '../src/lib/poker-engine.ts';
import { individualLivePersona, applyStrategyToPersona, RPG_BOT_POOL } from '../src/lib/personas.ts';
import { oopCheckMix } from '../src/lib/poker-position.ts';

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
    if (s.surge) assert.ok(s.vpip >= 0.45 && s.aggression >= 0.78 && s.aggression <= 0.95);
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
