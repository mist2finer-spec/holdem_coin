import type {WinnerInfo} from '@/lib/poker-rules';

// A shared result panel for both showdowns and hands won by folds.
export function HandAwards({winnerInfo,formatMoney=(n:number)=>`${n.toLocaleString()} 칩`,tournament=false}:{winnerInfo:WinnerInfo;formatMoney?:(n:number)=>string;tournament?:boolean}) {
 return <div className="showdown-awards" role="status" aria-label="핸드 정산 결과">
  <strong>★ WINNER · {winnerInfo.name}</strong>
  {winnerInfo.results.filter(r=>r.award>0).map(r=><p key={r.seatId}>{r.name} · 순수익 {r.netProfit>=0?'+':''}{formatMoney(r.netProfit)}</p>)}
  <small>레이크 {formatMoney(winnerInfo.rake)} {tournament?'(토너먼트 0%)':'(경쟁 팟 기준 5%)'}</small>
 </div>;
}
