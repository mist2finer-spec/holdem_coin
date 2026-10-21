import {wagerPosition} from '@/lib/poker-seat-view';
interface Props {amount:number;name:string;position:{top:string;left:string};}
export function TableBet({amount,name,position}:Props){
 if(amount<=0)return null;
 const lane=wagerPosition(position);
 return <div className={`poker-bet poker-bet-${lane.side}`} style={{top:`${lane.top}%`,left:`${lane.left}%`}}
   aria-label={`${name} 베팅 ${amount.toLocaleString()} 칩`}>
  <span className="poker-bet-owner" title={name}>{name}</span>
  <strong><span aria-hidden="true">◉</span>{amount.toLocaleString()}</strong>
 </div>;
}
