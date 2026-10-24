import {evaluateBestHand,scoreToCategoryName,type Card} from './poker-engine';
export interface ShowdownPlayer {seatId:number;name:string;portrait?:number;holeCards:Card[];inHand:boolean;folded:boolean;}
const key=(c:Card)=>c.rank+c.suit;
export function bestFiveView(hole:Card[],board:Card[]) {
 const all=[...hole,...board];
 if(hole.length!==2||board.length!==5||new Set(all.map(key)).size!==7)return null;
 if(all.some(c=>!/^([2-9TJQKA])[♠♥♦♣]$/.test(key(c))))return null;
 let best=-1,chosen:number[]=[];
 for(let a=0;a<7;a++)for(let b=a+1;b<7;b++) {
  const indices=all.map((_,i)=>i).filter(i=>i!==a&&i!==b),cards=indices.map(i=>all[i]);
  const score=evaluateBestHand(cards.slice(0,2),cards.slice(2));
  if(score>best||score===best&&indices.filter(i=>i<2).length>chosen.filter(i=>i<2).length){best=score;chosen=indices;}
 }
 return {score:best,category:scoreToCategoryName(best),holeUsed:hole.map((_,i)=>chosen.includes(i)),
  board:chosen.filter(i=>i>=2).map(i=>all[i]),communityCards:[...board],boardUsed:board.map((_,i)=>chosen.includes(i+2)),bestFive:chosen.map(i=>all[i])};
}
export function topShowdownPlayers(players:ShowdownPlayer[],board:Card[]) {
 return players.filter(p=>p.inHand&&!p.folded).flatMap(p=>{const view=bestFiveView(p.holeCards,board);return view?[{...p,...view}]:[];})
  .sort((a,b)=>b.score-a.score||a.seatId-b.seatId).slice(0,3);
}
