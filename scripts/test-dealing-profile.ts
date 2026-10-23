import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDeck,type Card} from '../src/lib/poker-engine';
import {dealStartingHands,isPremiumStartingHand,DEALING_PROFILE} from '../src/lib/poker-deal';
import {dealNextStreet} from '../src/lib/poker-rules';
function seeded(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const cards=(...xs:string[])=>xs.map(x=>({rank:x[0],suit:x[1]} as Card));
test('premium house range is exactly JJ+/AK, including suited and offsuit AK',()=>{
 assert.equal(isPremiumStartingHand(cards('J♠','J♥')),true);
 assert.equal(isPremiumStartingHand(cards('A♠','K♠')),true);
 assert.equal(isPremiumStartingHand(cards('A♠','K♥')),true);
 assert.equal(isPremiumStartingHand(cards('T♠','T♥')),false);
 assert.equal(isPremiumStartingHand(cards('A♠','Q♠')),false);
 const deck=makeDeck(seeded(7));let count=0;
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)if(isPremiumStartingHand([deck[a],deck[b]]))count++;
 assert.equal(count,40);
});
test('6/8 seats conserve the deck across burns and runout, omit sitting-out seats, and preserve input',()=>{
 for(const ids of [[0,1,2,3,4,5],[0,1,2,3,4,5,6,7],[0,2,5]]) {
  const seats=ids.map(seatId=>({seatId,isBot:seatId%2===0})),before=JSON.stringify(seats);
  const {hands,deck}=dealStartingHands(seats,2,seeded(35));
  assert.equal(JSON.stringify(seats),before);assert.equal(hands.size,ids.length);
  const all=[...hands.values()].flat().concat(deck);
  assert.equal(all.length,52);assert.equal(new Set(all.map(c=>c.rank+c.suit)).size,52);
  let board:Card[]=[];for(let i=0;i<3;i++)board=dealNextStreet(board,deck).board;
  assert.equal(board.length,5);assert.equal(deck.length,52-2*ids.length-8);
  assert.equal(new Set([...hands.values()].flat().concat(board).map(c=>c.rank+c.suit)).size,ids.length*2+5);
 }
});
test('no seat gets an advantage from input array order; invalid RNG/seats fail explicitly',()=>{
 const seats=[0,1,2,3,4,5].map(seatId=>({seatId,isBot:seatId>0}));
 assert.deepEqual(dealStartingHands(seats,2,seeded(11)),dealStartingHands([...seats].reverse(),2,seeded(11)));
 assert.throws(()=>dealStartingHands(seats,0,()=>1),/RNG/);
 assert.throws(()=>dealStartingHands([seats[0],seats[0]],0),/seats/);
 // Constant RNG must terminate instead of repeatedly rejecting a premium pair.
 assert.equal(dealStartingHands(seats,0,()=>0).hands.size,6);
});
test('seeded 40k mixed tables approximate human -20% and CPU -10% without dropping ranks',()=>{
 const random=seeded(0x20261023),counts={human:0,cpu:0},samples={human:0,cpu:0};
 const ranks=new Map<string,number>(),seats=Array.from({length:6},(_,seatId)=>({seatId,isBot:seatId>=3}));
 for(let hand=0;hand<40000;hand++) {
  const {hands}=dealStartingHands(seats,hand%6,random);
  for(const s of seats){const hole=hands.get(s.seatId)!,kind=s.isBot?'cpu':'human';samples[kind]++;
   if(isPremiumStartingHand(hole))counts[kind]++;
   for(const c of hole)ranks.set(c.rank,(ranks.get(c.rank)||0)+1);
  }
 }
 const fair=40/1326,human=counts.human/samples.human,cpu=counts.cpu/samples.cpu;
 assert.ok(Math.abs(human-fair*DEALING_PROFILE.humanPremiumMultiplier)<.0018,`human ${human}`);
 assert.ok(Math.abs(cpu-fair*DEALING_PROFILE.cpuPremiumMultiplier)<.0018,`cpu ${cpu}`);
 assert.ok(cpu>human);
 // Suppressing high pairs/AK slightly alters rank marginals by design; prevent
 // a gross card-removal bug, not a false claim of fully uniform starting ranks.
 for(const n of ranks.values())assert.ok(n>30000&&n<44000);
 console.log(JSON.stringify({tables:40000,fair,human,cpu,humanReduction:1-human/fair,cpuReduction:1-cpu/fair}));
});
