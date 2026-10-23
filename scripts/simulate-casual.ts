/** Seeded, headless real-room balance measurement. No LLM, sockets or training. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {HybridHoldemRoom} from '../mini-services/poker-server/index';
const count=Number(process.env.SIM_HANDS||1000),seedInput=Number(process.env.SIM_SEED||20261023);
let seed=seedInput;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const log=console.log;console.log=()=>{};
const room:any=new HybridHoldemRoom(false,6);room.sleep=async()=>{};room.broadcastTableState=()=>{};
const totals={hands:0,opportunities:0,vpip:0,pfr:0,unopenedWalks:0,preflopFoldWins:0,rake:0};
const individual:Record<string,{hands:number;vpip:number;pfr:number}>={};
(async()=>{
 for(let hand=0;hand<count;hand++){
  const started=Date.now();await room.playOneHand();
  const h=room.history.all().at(-1);assert.equal(h.status,'completed');
  assert.equal(h.results.reduce((n:any,r:any)=>n+r.contribution-r.payout,0),h.rake);
  assert.ok(room.state.seats.every((s:any)=>Number.isSafeInteger(s.stack)&&s.stack>=0));
  totals.hands++;totals.rake+=h.rake;
  const pre=h.actions.filter((a:any)=>a.street==='PREFLOP');
  for(const p of h.players){
   const actions=pre.filter((a:any)=>a.seatId===p.seatId);
   const vpip=actions.some((a:any)=>a.paid>0),pfr=actions.some((a:any)=>a.paid>0&&a.betAfter>a.betBefore+a.callBefore);
   totals.opportunities++;totals.vpip+=Number(vpip);totals.pfr+=Number(pfr);
   const key=room.state.seats[p.seatId].persona.id;
   const stat=individual[key]??={hands:0,vpip:0,pfr:0};stat.hands++;stat.vpip+=Number(vpip);stat.pfr+=Number(pfr);
  }
  if(pre.every((a:any)=>a.paid===0))totals.unopenedWalks++;
  if(h.board.length===0)totals.preflopFoldWins++;
  if((hand+1)%100===0)process.stderr.write(`SIM_PROGRESS ${hand+1}/${count} lastHandMs=${Date.now()-started}\n`);
 }
 const report={seed:seedInput,...totals,vpipRate:totals.vpip/totals.opportunities,pfrRate:totals.pfr/totals.opportunities,
  unopenedWalkRate:totals.unopenedWalks/totals.hands,preflopFoldWinRate:totals.preflopFoldWins/totals.hands,individual};
 if(process.env.SIM_REPORT)fs.writeFileSync(process.env.SIM_REPORT,JSON.stringify(report,null,2)+'\n');
 log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
