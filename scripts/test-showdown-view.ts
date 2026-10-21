import test from 'node:test';
import assert from 'node:assert/strict';
import type {Card} from '../src/lib/poker-engine';
import {evaluateBestHand} from '../src/lib/poker-engine';
import {bestFiveView,topShowdownPlayers} from '../src/lib/poker-showdown-view';
const cards=(...values:string[]):Card[]=>values.map(s=>({rank:s[0] as Card['rank'],suit:s[1] as Card['suit']}));
test('normal best five uses both hole cards plus three real community cards',()=>{
 const h=cards('9♥','9♦'),b=cards('9♠','8♥','2♦','K♣','3♣');const v=bestFiveView(h,b)!;
 assert.deepEqual(v.holeUsed,[true,true]);assert.equal(v.board.length,3);assert.equal(v.bestFive.length,5);
 assert.equal(v.score,evaluateBestHand(h,b));assert.ok(v.board.every(c=>b.some(d=>d.rank===c.rank&&d.suit===c.suit)));
});
test('board-playing royal flush never pretends two hole cards are part of the winning hand',()=>{
 const v=bestFiveView(cards('2♥','3♦'),cards('A♠','K♠','Q♠','J♠','T♠'))!;
 assert.deepEqual(v.holeUsed,[false,false]);assert.equal(v.board.length,5);
});
test('one-hole-card flush displays four board cards and the correct hole highlight',()=>{
 const v=bestFiveView(cards('A♠','3♦'),cards('K♠','Q♠','J♠','9♠','2♥'))!;
 assert.deepEqual(v.holeUsed,[true,false]);assert.equal(v.board.length,4);
});
test('showdown includes at most three ranked non-folded players and rejects hidden/duplicate cards',()=>{
 const b=cards('2♠','5♥','9♦','J♣','K♣');
 const players=[['A♠','A♥'],['Q♠','Q♥'],['T♠','T♥'],['8♠','8♥']].map((h,i)=>({seatId:i,name:'CPU'+i,holeCards:cards(...h),inHand:true,folded:false}));
 assert.deepEqual(topShowdownPlayers(players,b).map(p=>p.seatId),[0,1,2]);
 assert.deepEqual(topShowdownPlayers(players.map(p=>({...p,folded:p.seatId===0})),b).map(p=>p.seatId),[1,2,3]);
 assert.equal(bestFiveView(cards('2♠','A♥'),b),null);assert.equal(bestFiveView([],b),null);
});
