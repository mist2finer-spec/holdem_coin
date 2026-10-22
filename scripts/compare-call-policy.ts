/** Counterfactual decisions on recorded public snapshots, NOT a replay of new whole hands.
 * Run with the server tsx loader and an admin history path; outputs aggregate counts only.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decideLiveBot,normalizeLiveAction,LIVE_RULES} from '../src/lib/poker-live';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer';
import {RPG_BOT_POOL} from '../src/lib/personas';
import type {HandHistory} from '../src/lib/poker-hand-history';
import type {Card} from '../src/lib/poker-engine';
const path=process.argv[2];if(!path)throw new Error('Usage: compare-call-policy.ts ADMIN_HISTORY.json [sample count]');
const file=JSON.parse(fs.readFileSync(path,'utf8')) as {hands:HandHistory[]};
const hands=file.hands;
const count=Math.max(1,Math.min(200,Number(process.argv[3]||80)));
const total=hands.reduce((n,h)=>n+h.actions.filter(a=>a.isBot&&a.street==='PREFLOP').length,0);
const selected=new Set(Array.from({length:Math.min(count,total)},(_,i)=>Math.floor(i*total/Math.min(count,total))));
const trainer=new SelfPlayTrainer();
const oldActions:Record<string,number>={},newActions:Record<string,number>={};
let index=0,sampled=0,foldToCall=0,seed=53210;
const random=Math.random;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
try {
 for(const h of hands){
  const seats=h.players.map(p=>{
   const blind=h.forcedBets?.filter(b=>b.seatId===p.seatId).reduce((sum,b)=>sum+b.paid,0)||0;
   return {seatId:p.seatId,stack:p.startingStack-blind,currentBet:blind,totalBet:blind,inHand:true,folded:false,allIn:p.startingStack===blind};
  });
  for(const a of h.actions){
   if(a.street!=='PREFLOP')break;
   const actor=seats.find(s=>s.seatId===a.seatId)!;
   if(a.isBot&&selected.has(index++)){
    const audit=a.privateAudit as Record<string,unknown>|undefined;
    const persona=RPG_BOT_POOL.find(p=>p.id===audit?.personaId);
    const cards=h.players.find(p=>p.seatId===a.seatId)!.holeCards;
    if(!persona||cards.length!==2||cards.some(c=>c==='??'))throw new Error('Admin history with acting CPU cards and persona audit required');
    const holeCards=cards.map(c=>({rank:c[0],suit:c.slice(1)})) as Card[];
    const result=decideLiveBot(trainer,{actor:{...actor,holeCards,persona},seats,board:[],
     pot:Math.max(0,a.potBefore-seats.reduce((sum,s)=>sum+s.currentBet,0)),minRaise:a.minRaiseBefore!,maxRaise:Number(audit?.maxRaise??actor.currentBet+actor.stack),
     button:h.buttonSeat,smallBlind:h.smallBlindSeat,bigBlind:h.bigBlindSeat,hand:h.handNumber,raiseLevel:a.raiseLevelBefore,
     lastRaiserSeat:audit?.lastRaiserSeat as number|undefined,openedPreflop:!!audit?.openedPreflop,limpedPreflop:!!audit?.limpedPreflop,
     threeBetRead:audit?.threeBetRead as Parameters<typeof decideLiveBot>[1]['threeBetRead']});
    assert.ok(normalizeLiveAction(seats,actor.seatId,result,a.lastFullRaiseBefore!,a.canRaiseBefore,200),'Invalid counterfactual action');
    oldActions[a.action]=(oldActions[a.action]||0)+1;newActions[result.action]=(newActions[result.action]||0)+1;
    if(a.action==='fold'&&result.action==='call')foldToCall++;
    sampled++;
   }
   actor.stack=a.stackAfter;actor.currentBet=a.betAfter;actor.totalBet+=a.paid;actor.allIn=a.stackAfter===0;
   if(a.action==='fold'){actor.inHand=false;actor.folded=true;}
  }
 }
} finally{Math.random=random;}
console.log(JSON.stringify({method:'Uniformly spaced recorded preflop CPU decision snapshots; original actions retained to construct each next snapshot, not new full hands',version:LIVE_RULES.version,sampled,oldActions,newActions,foldToCall},null,2));
