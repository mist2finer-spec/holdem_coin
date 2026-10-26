'use client';
import {useEffect,useRef,useState} from 'react';
import {io,Socket} from 'socket.io-client';
import {CurrencyDisplay} from '@/ui/components/CurrencyDisplay';
import {StorePopup} from '@/ui/components/Store';
import type {StoreItemData,StoreItemCategory} from '@/ui/components/Store/StoreItem';
import {Leaderboard,type Player} from '@/ui/components/Leaderboard/Leaderboard';
import {lobbyToken,pokerSocketOptions,soloBalance,saveSoloBalance} from '@/lib/lobby-client';
type Account={id:string;name:string;token:string;multi:number;error?:string};
const catalog:{category:StoreItemCategory;label:string;image:string}[]=[
 {category:'weapon',label:'무기',image:'weapons/weapone_1.jpg'},
 {category:'armor',label:'방어구',image:'armor/armor_1.png'},
 {category:'accessory',label:'액세서리',image:'accessories/acce_1.png'},
 {category:'avatar',label:'아바타',image:'avatars/avatar_1.png'},
];
export function LobbyPanel({onName}:{onName:(name:string)=>void}){
 const socket=useRef<Socket|null>(null);
 const [account,setAccount]=useState<Account|null>(null);
 const [solo,setSolo]=useState(()=>typeof window==='undefined'?5000:soloBalance());
 const [message,setMessage]=useState('');
 const [store,setStore]=useState<StoreItemCategory|null>(null);
 const [showRanks,setShowRanks]=useState(false);
 const [players,setPlayers]=useState<Player[]>([]);
 const [updated,setUpdated]=useState('');
 const [busy,setBusy]=useState(false);
 const [nameDraft,setNameDraft]=useState('');
 useEffect(()=>{
  const {host,options}=pokerSocketOptions();const s=io(host,options);socket.current=s;
  const update=(a:Account)=>{if(!a||a.error)return;setAccount(a);onName(a.name);localStorage.setItem('holdem-lobby-token',a.token);};
  const ranks=()=>s.timeout(12000).emitWithAck('GET_LEADERBOARD').then((r:{players:Player[];updatedAt:number})=>{setPlayers(r.players);setUpdated(new Date(r.updatedAt).toLocaleTimeString());}).catch(()=>{});
  s.on('connect',()=>s.timeout(12000).emitWithAck('LOBBY_HELLO',{token:lobbyToken()}).then(update).then(ranks).catch(()=>{}));
  const poll=setInterval(()=>{ranks();s.timeout(12000).emitWithAck('LOBBY_STATUS').then(update).catch(()=>{});},180000);
  return ()=>{clearInterval(poll);s.disconnect();socket.current=null;};
 },[onName]);
 async function recharge(kind:'solo'|'multi'|'tournament'){
  if(kind==='tournament'){setMessage('토너먼트 입장 시 100BB가 배정됩니다. 리바인과 칩 충전은 불가합니다.');return;}
  if(kind==='solo'){const n=soloBalance()+5000;saveSoloBalance(n);setSolo(n);setMessage('싱글 재화 5,000이 충전되었습니다.');return;}
  if(busy||!socket.current?.connected){setMessage('서버 연결 후 다시 시도해 주세요.');return;}
  setBusy(true);try{const a:Account=await socket.current.timeout(12000).emitWithAck('LOBBY_RECHARGE');if(a.error)throw new Error(a.error);setAccount(a);setMessage('멀티플레이 재화 5,000이 충전되었습니다.');}catch{setMessage('충전하지 못했습니다. 잠시 후 다시 시도해 주세요.');}finally{setBusy(false);}
 }
 async function rename(){
  if(busy||!socket.current?.connected){setMessage('서버 연결 후 다시 시도해 주세요.');return;}
  setBusy(true);
  try{const a:Account=await socket.current.timeout(12000).emitWithAck('LOBBY_RENAME',{name:nameDraft.trim()});
   if(a.error){setMessage(a.error);return;}setAccount(a);onName(a.name);setNameDraft('');setMessage('플레이어 이름이 변경되었습니다.');
  }catch{setMessage('이름을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');}finally{setBusy(false);}
 }
 const items:StoreItemData[]=[...catalog].sort((a,b)=>Number(b.category===store)-Number(a.category===store)).flatMap(c=>Array.from({length:9},(_,i)=>({id:`${c.category}-${i}`,name:c.label,category:c.category,imageUrl:`/ui/shop/${c.image}`,price:100})));
 return <>
  <div className="lobby-wallets">
   <CurrencyDisplay amount={solo} currency="싱글" chipId="Chip_01" onRechargeClick={()=>recharge('solo')}/>
   <CurrencyDisplay amount={account?.multi??5000} currency="멀티" chipId="Chip_01_a" onRechargeClick={()=>recharge('multi')}/>
   <CurrencyDisplay amount={0} currency="토너먼트" chipId="Chip_01_b" onRechargeClick={()=>recharge('tournament')}/>
  </div>
  <div className="lobby-shop-buttons">{catalog.map(c=><button key={c.category} onClick={()=>setStore(c.category)}>{c.label}</button>)}</div>
  <button className="lobby-rank-button" onClick={()=>setShowRanks(true)}>리더보드 · 6인 서버</button>
  <form className="lobby-name-form" onSubmit={e=>{e.preventDefault();void rename();}}>
   <label htmlFor="lobby-player-name">플레이어 이름 · {account?.name??'연결 중'}</label>
   <div><input id="lobby-player-name" value={nameDraft} onChange={e=>setNameDraft(e.target.value)} placeholder={account?.name??'새 이름'} maxLength={24} autoComplete="nickname"/><button type="submit" disabled={busy||!account||!nameDraft.trim()}>이름 변경</button></div>
  </form>
  {store&&<StorePopup key={store} open items={items} onClose={()=>setStore(null)} titleKo="상점"/>}
  {showRanks&&<div className="lobby-overlay" role="dialog" aria-modal="true" aria-label="6인 서버 리더보드"><section><button className="lobby-close" onClick={()=>setShowRanks(false)} aria-label="리더보드 닫기">×</button><Leaderboard players={players.slice(0,7)} maxVisible={7} currency=""/><p>{players.length?'6인 서버 플레이어 TOP 7':'아직 참여한 플레이어가 없습니다.'} · 3분마다 갱신{updated&&` · ${updated}`}</p></section></div>}
  {message&&<div className="island-modal"><section role="alertdialog" aria-modal="true" aria-label="재화 안내"><p>{message}</p><button autoFocus onClick={()=>setMessage('')}>확인</button></section></div>}
 </>;
}
