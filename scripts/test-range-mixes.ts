import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Card} from '../src/lib/poker-engine.ts';
import {preflopPosition,planPreflop,connectorAllowed,connectorInfo,flatCallFrequency,limpFrequency} from '../src/lib/poker-preflop.ts';
import {stackContext} from '../src/lib/poker-stack.ts';
import {positionContext} from '../src/lib/poker-position.ts';
import {decideLiveBot} from '../src/lib/poker-live.ts';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer.ts';
import {RPG_BOT_POOL} from '../src/lib/personas.ts';
import {continuationBetFrequency,checkCallEquityRequired} from '../src/lib/poker-postflop.ts';

const cards=(a:Card['rank'],b:Card['rank'],suited=false):Card[]=>[{rank:a,suit:'♠'},{rank:b,suit:suited?'♠':'♥'}];
function seeded<T>(fn:()=>T) {
  const old=Math.random;let seed=4567;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{return fn();}finally{Math.random=old;}
}
function spot(hole=cards('2','3')):Parameters<typeof planPreflop>[0] {
  const seats=[
    {seatId:0,stack:9800,currentBet:200,totalBet:200,inHand:true,folded:false,allIn:false},
    {seatId:1,stack:9600,currentBet:400,totalBet:400,inHand:true,folded:false,allIn:false},
  ];
  return {hole,board:[],call:200,pot:700,stack:9800,currentBet:200,minRaise:600,maxRaise:10000,
    raiseLevel:1,smallBlind:1,persona:{vpip:0.60,aggression:0.85,bluffFreq:0.25},
    context:{actorId:0,seats,stack:stackContext(seats,0),position:positionContext(seats,0,1)}};
}

test('7 connectors and one-gappers use final trait gates, including offsuit',()=>{
  assert.equal(connectorInfo(cards('7','5')).gap,1);
  assert.equal(connectorAllowed(cards('7','6',true),{vpip:.35,aggression:.5}),true);
  assert.equal(connectorAllowed(cards('7','5',true),{vpip:.40,aggression:.60}),true);
  assert.equal(connectorAllowed(cards('7','6'),{vpip:.50,aggression:.70}),true);
  assert.equal(connectorAllowed(cards('9','7'),{vpip:.55,aggression:.75}),true);
  assert.equal(connectorAllowed(cards('7','6'),{vpip:.25,aggression:.35}),false);
  assert.equal(connectorAllowed(cards('2','3'),{vpip:.9,aggression:.9}),false,'low cards use their own cap');
});

test('rare 23o calls stay under ten percent and rejection cannot reach another AI branch',()=>{
  const s=spot();let calls=0;
  const forbidden={decideActionForLive:()=>{throw new Error('Rare gate fell through');}} as unknown as SelfPlayTrainer;
  const orc=RPG_BOT_POOL.find(p=>p.id==='orc_berserker')!;
  seeded(()=>{for(let i=0;i<4000;i++){
    const d=decideLiveBot(forbidden,{actor:{...s.context.seats[0],holeCards:s.hole,persona:orc},seats:s.context.seats,
      board:[],pot:100,minRaise:600,maxRaise:10000,button:1,smallBlind:1,bigBlind:0,hand:1,raiseLevel:1});
    assert.ok(d.action==='call'||d.action==='fold');
    if(d.action==='call')calls++;
  }});
  assert.ok(calls>180&&calls<360,`${calls}/4000`);
});

test('rare connector calls exclude short stacks, all-ins and re-raises',()=>{
  const s=spot();
  assert.equal(planPreflop({...s,raiseLevel:2}).decision?.action,'fold');
  assert.equal(planPreflop({...s,context:{...s.context,stack:{...s.context.stack!,ownStack:2500}}}).decision?.action,'fold');
  const table=s.context.seats.map((p,i)=>({...p,allIn:i===1}));
  assert.equal(planPreflop({...s,context:{...s.context,seats:table}}).decision?.action,'fold');
  assert.equal(planPreflop({...s,persona:{vpip:.25,aggression:.35,bluffFreq:.05}}).decision?.action,'fold');
});

test('actual shared AI limp frequency stays below fifteen percent without fallback leakage',()=>{
  const s=spot(cards('6','6'));s.context.seats[0].stack=9900;s.context.seats[0].currentBet=100;s.context.seats[0].totalBet=100;
  s.context.seats[1].stack=9800;s.context.seats[1].currentBet=200;s.context.seats[1].totalBet=200;
  const trainer=new SelfPlayTrainer();let calls=0;
  const bard=RPG_BOT_POOL.find(p=>p.id==='wandering_bard')!;
  seeded(()=>{for(let i=0;i<2000;i++){
    const d=decideLiveBot(trainer,{actor:{...s.context.seats[0],holeCards:s.hole,persona:bard},seats:s.context.seats,
      board:[],pot:0,minRaise:400,maxRaise:10000,button:1,smallBlind:0,bigBlind:1,hand:1,raiseLevel:0});
    if(d.action==='call')calls++;
  }});
  assert.ok(calls>50&&calls<270,`${calls}/2000`);
  assert.ok(limpFrequency(.85)<limpFrequency(.35));
});

test('flat-call mix favors calling personalities, IP and non-premium hands',()=>{
  const calm={vpip:.55,aggression:.35},bold={vpip:.55,aggression:.85};
  assert.ok(flatCallFrequency(calm,false)>flatCallFrequency(bold,false));
  assert.ok(flatCallFrequency(calm,false)>flatCallFrequency(calm,true));
  assert.ok(flatCallFrequency(calm,false,true)<flatCallFrequency(calm,false));
  const s=spot(cards('A','Q'));s.call=600;s.pot=1200;s.currentBet=0;s.context.seats[0].currentBet=0;s.context.seats[1].currentBet=600;
  let flats=0;seeded(()=>{for(let i=0;i<1000;i++)if(planPreflop({...s,persona:{...calm,bluffFreq:.1}}).decision?.action==='call')flats++;});
  assert.ok(flats>200,`${flats}`);
});

test('non-trap limpers cannot re-raise through fallback',()=>{
  const s=spot(cards('7','7'));s.context.limpedPreflop=true;
  const d=planPreflop({...s,persona:{vpip:.45,aggression:.4,bluffFreq:.1}}).decision;
  assert.ok(d?.action==='call'||d?.action==='fold');
});

test('postflop continuation depends on traits, board, opponents and street',()=>{
  const dry=[...cards('A','8'),{rank:'2',suit:'♦'}] as Card[];
  const wet=[{rank:'8',suit:'♠'},{rank:'9',suit:'♠'},{rank:'T',suit:'♠'}] as Card[];
  const calm={aggression:.35,bluffFreq:.05},bold={aggression:.85,bluffFreq:.25};
  assert.ok(continuationBetFrequency(bold,dry,4,1)>continuationBetFrequency(calm,dry,4,1));
  assert.ok(continuationBetFrequency(bold,dry,4,1)>continuationBetFrequency(bold,wet,4,1));
  assert.ok(continuationBetFrequency(bold,dry,4,1)>continuationBetFrequency(bold,dry,4,3));
  assert.ok(checkCallEquityRequired({vpip:.55},.25)<checkCallEquityRequired({vpip:.25},.25));
});

test('qualified connector planner folds can reach blind defense, hard gate folds cannot',()=>{
  const s=spot(cards('7','6',true));
  const forbidden={decideActionForLive:()=>{throw new Error('Planner fold should not call trainer');}} as unknown as SelfPlayTrainer;
  const orc=RPG_BOT_POOL.find(p=>p.id==='orc_berserker')!;
  const ctx={actor:{...s.context.seats[0],holeCards:s.hole,persona:orc},seats:s.context.seats,
    board:[],pot:100,minRaise:600,maxRaise:10000,button:1,smallBlind:1,bigBlind:0,hand:1,raiseLevel:1};
  const old=Math.random;
  try {
    Math.random=()=>.4;
    assert.equal(decideLiveBot(forbidden,ctx).action,'call');
    assert.equal(decideLiveBot(forbidden,{...ctx,actor:{...ctx.actor,holeCards:cards('2','3')}}).action,'fold');
    assert.equal(decideLiveBot(forbidden,{...ctx,raiseLevel:3}).action,'fold');
    assert.equal(decideLiveBot(forbidden,{...ctx,actor:{...ctx.actor,holeCards:cards('4','6')}}).action,'fold');
  }finally {Math.random=old;}
});


test('premium opening stays 2.5–2.8BB and re-raises do not jump to all-in',()=>{
 seeded(()=>{for(const rank of ['A','K','Q','J'] as const)for(let i=0;i<50;i++){
  const s=spot(cards(rank,rank));s.stack=4800;s.maxRaise=5000;s.context.stack={...s.context.stack!,ownStack:5000};
  const opened=planPreflop({...s,raiseLevel:0,call:0,currentBet:200,minRaise:400}).decision!;
  assert.equal(opened.action,'raise');assert.ok(opened.amount>=500&&opened.amount<=560);
  const three=planPreflop({...s,call:400,currentBet:200,minRaise:1200,context:{...s.context,preflopPosition:{early:false,inPositionVsRaiser:true}}}).decision!;
  assert.equal(three.action,'raise');assert.equal(three.amount,1800);
  const four=planPreflop({...s,stack:19400,maxRaise:20000,currentBet:600,call:1200,raiseLevel:2,minRaise:3600,
   context:{...s.context,openedPreflop:true,stack:{...s.context.stack!,ownStack:20000}}}).decision!;
  assert.equal(four.action,'raise');assert.equal(four.amount,3960);
  const committed=planPreflop({...s,currentBet:600,call:1200,raiseLevel:2,minRaise:3600}).decision!;
  assert.equal(committed.action,'call');
 }});
});

test('UTG through UTG+2 exclude button/blinds and survive folded seats',()=>{
 const ids=[0,1,2,3,4,5,6,7]; // BTN 7, SB 0, BB 1
 for(const id of [2,3,4])assert.equal(preflopPosition(ids,id,7,1,0).early,true);
 for(const id of [0,1,5,6,7])assert.equal(preflopPosition(ids,id,7,1,0).early,false);
 assert.equal(preflopPosition(ids,7,7,1,2).inPositionVsRaiser,true);
 assert.equal(preflopPosition(ids,0,7,1,7).inPositionVsRaiser,false);
});

test('broadways and JT flat early; IP adds mixed non-shove 3-bets including rare aggressive 87s',()=>{
 const old=Math.random;
 try{
  for(const ranks of [['A','K'],['A','Q'],['K','Q'],['Q','J'],['J','T']] as const)for(const suited of [true,false]){
   const s=spot(cards(ranks[0],ranks[1],suited));s.call=400;s.currentBet=0;s.minRaise=800;s.pot=1600;
   s.context.preflopPosition={early:true,inPositionVsRaiser:false};Math.random=()=>0;
   assert.equal(planPreflop(s).decision?.action,'call');
   s.context.preflopPosition={early:false,inPositionVsRaiser:true};
   assert.equal(planPreflop(s).decision?.action,'raise');
   Math.random=()=>.99;assert.equal(planPreflop(s).decision?.action,'call');
  }
  const s=spot(cards('8','7',true));s.call=400;s.currentBet=0;s.minRaise=800;s.pot=3000;
  s.context.preflopPosition={early:false,inPositionVsRaiser:true};
  Math.random=()=>.079;assert.equal(planPreflop(s).decision?.action,'raise');
  Math.random=()=>.08;assert.equal(planPreflop(s).decision?.action,'call');
  Math.random=()=>0;assert.notEqual(planPreflop({...s,persona:{...s.persona,aggression:.50}}).decision?.action,'raise');
 }finally{Math.random=old;}
});

test('shared live premium policy bypasses trainer jams in both modes',()=>{
 const s=spot(cards('A','A'));s.context.seats[1].currentBet=200;
 const forbidden={decideActionForLive:()=>{throw new Error('premiums reached shove trainer');}} as unknown as SelfPlayTrainer;
 const d=decideLiveBot(forbidden,{actor:{...s.context.seats[0],holeCards:s.hole,persona:RPG_BOT_POOL[1]},seats:s.context.seats,
 board:[],pot:100,minRaise:400,maxRaise:10000,button:1,smallBlind:1,bigBlind:0,hand:1,raiseLevel:0});
 assert.equal(d.action,'raise');assert.ok(d.amount>=500&&d.amount<=560);
});

test('premium sizing does not override postflop or <=5BB emergency decisions',()=>{
 const s=spot(cards('K','K'));
 assert.equal(planPreflop({...s,board:cards('2','3')}).decision,null);
 const short={...s,stack:800,maxRaise:1000,call:0,currentBet:200,raiseLevel:0,
  context:{...s.context,stack:{...s.context.stack!,ownStack:1000}}};
 assert.equal(planPreflop(short).decision,null);
});
