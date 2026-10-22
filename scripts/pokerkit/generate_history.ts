/** Generate real server histories for independent offline replay. Never run a live service. */
import {writeFileSync} from 'node:fs';
import {HybridHoldemRoom} from '../../mini-services/poker-server/index';
if(!process.argv[2])throw Error('Specify output JSON path');
let seed=83021;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
(async()=>{
 const hands=[];
 for(const size of [6,8] as const){
  const room:any=new HybridHoldemRoom(false,size);room.sleep=async()=>{await new Promise<void>(r=>setImmediate(r));};
  for(let hand=0;hand<10;hand++)await room.playOneHand();
  hands.push(...room.history.all());
 }
 writeFileSync(process.argv[2],JSON.stringify({schemaVersion:1,scope:'admin',hands}));
 console.log('EXPORTED_20_SERVER_HANDS');
})().catch(e=>{console.error(e);process.exitCode=1;});
