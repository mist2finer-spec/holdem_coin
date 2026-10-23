import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDeck,type Card} from '../src/lib/poker-engine';
import {dealStartingHands,isPremiumStartingHand,DEALING_PROFILE,startingHandFeatures,startingHandWeight} from '../src/lib/poker-deal';
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
test('weighted features overlap by maximum, recognize wheel and preserve nonzero probabilities',()=>{
 assert.equal(startingHandWeight(...cards('A♠','A♥') as [Card,Card]),.4);
 assert.equal(startingHandWeight(...cards('7♠','8♠') as [Card,Card]),.5);
 assert.equal(startingHandWeight(...cards('7♠','9♥') as [Card,Card]),.6);
 assert.equal(startingHandWeight(...cards('2♠','K♥') as [Card,Card]),1);
 assert.equal(startingHandFeatures(...cards('A♠','2♥') as [Card,Card]).connector,true);
 const seats=[0,1,2,3,4,5].map(seatId=>({seatId,isBot:false}));
 assert.deepEqual(dealStartingHands(seats,0,seeded(5)),dealStartingHands(seats.map(s=>({...s,isBot:true})),0,seeded(5)));
});
test('seeded 20k tables suppress textures for both roles and conserve every rank',()=>{
 const random=seeded(0x20261023),seats=Array.from({length:6},(_,seatId)=>({seatId,isBot:seatId>=3}));
 const counts={pair:0,suited:0,connector:0},first={pair:0,suited:0,connector:0};
 const deck=makeDeck(seeded(1)),expected={pair:0,suited:0,connector:0};let weight=0;
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){
  const w=startingHandWeight(deck[a],deck[b]),f=startingHandFeatures(deck[a],deck[b]);weight+=w;
  for(const k of Object.keys(expected) as (keyof typeof expected)[])if(f[k])expected[k]+=w;
 }
 for(const k of Object.keys(expected) as (keyof typeof expected)[])expected[k]/=weight;
 const ranks=new Set<string>();
 for(let hand=0;hand<20000;hand++){
  const {hands}=dealStartingHands(seats,hand%6,random),firstId=(hand%6+1)%6;
  for(const [id,hole] of hands){const f=startingHandFeatures(hole[0],hole[1]);
   for(const c of hole)ranks.add(c.rank);
   for(const k of Object.keys(counts) as (keyof typeof counts)[])if(f[k]){counts[k]++;if(id===firstId)first[k]++;}
  }
 }
 for(const k of Object.keys(expected) as (keyof typeof expected)[])
  assert.ok(Math.abs(first[k]/20000-expected[k])<.012,`${k}: ${first[k]/20000} expected ${expected[k]}`);
 assert.ok(counts.pair/120000<78/1326);assert.ok(counts.suited/120000<312/1326);
 assert.equal(ranks.size,13);
 console.log(JSON.stringify({profile:DEALING_PROFILE.id,tables:20000,expectedFirstSeat:expected,observedFirstSeat:Object.fromEntries(Object.entries(first).map(([k,v])=>[k,v/20000])),observedAllSeats:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/120000]))}));
});
