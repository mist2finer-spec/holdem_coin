"use client";
import type {Card} from '@/lib/poker-engine';
import type {WinnerInfo} from '@/lib/poker-rules';
import {topShowdownPlayers,type ShowdownPlayer} from '@/lib/poker-showdown-view';
import {CharacterPortrait} from './CharacterPortrait';
import {HandAwards} from './HandAwards';
import {PlayingCard} from './PlayingCard';
export function ShowdownResults({players,board,winnerInfo}:{players:ShowdownPlayer[];board:Card[];winnerInfo:WinnerInfo|null}) {
 const rows=topShowdownPlayers(players,board);
 if(!rows.length)return null;
 return <section className="poker-showdown-results" aria-label="쇼다운 상위 3명">
  <h2>SHOWDOWN <span>상위 {rows.length}명</span></h2>
  {rows.map((p,i)=>{
   const won=winnerInfo?.results.some(r=>r.seatId===p.seatId&&r.award>0);
   return <div key={p.seatId} className={`showdown-player ${won?'showdown-player-won':''}`}>
    <div className="showdown-person"><div className="showdown-avatar"><CharacterPortrait portrait={p.portrait} name={p.name}/></div><strong>{i+1}. {p.name}</strong></div>
    <div className="showdown-hand">
     <div className="showdown-card-groups">
      <div><small>홀카드 · {5-p.board.length}장 사용</small><div className="showdown-cards">{p.holeCards.map((c,j)=><PlayingCard key={j} card={c} size="xs" className={p.holeUsed[j]?'':'opacity-40'}/>)}</div></div>
      <div><small>사용한 보드 {p.board.length}장</small><div className="showdown-cards">{p.board.map((c,j)=><PlayingCard key={j} card={c} size="xs"/>)}</div></div>
     </div>
     <p>{won?'★ ':''}{p.category}<span> · 홀카드 {5-p.board.length} + 보드 {p.board.length} = 5장</span></p>
    </div>
   </div>;
  })}
  {winnerInfo&&<HandAwards winnerInfo={winnerInfo}/>}
 </section>;
}
