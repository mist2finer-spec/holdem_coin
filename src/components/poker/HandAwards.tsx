import type {WinnerInfo} from '@/lib/poker-rules';

// A shared result panel for both showdowns and hands won by folds.
export function HandAwards({winnerInfo}:{winnerInfo:WinnerInfo}) {
 return <div className="showdown-awards" role="status" aria-label="핸드 정산 결과">
  <strong>★ WINNER · {winnerInfo.name}</strong>
  {winnerInfo.results.filter(r=>r.award>0).map(r=><p key={r.seatId}>{r.name} · 순수익 {r.netProfit>=0?'+':''}{r.netProfit.toLocaleString()} 칩</p>)}
  <small>레이크 {winnerInfo.rake.toLocaleString()} 칩 (5%)</small>
 </div>;
}
