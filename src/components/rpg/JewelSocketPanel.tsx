'use client';
import {useEffect,useState} from 'react';
import type {BuildView,CoreNode} from './hunt-build';
import {JEWELS_BY_ID} from './jewel-catalog';
import type {JewelInstance} from './jewel-system';
import type {JewelAction} from '../../lib/rpg-rogue-service';
export function JewelSocketPanel({view,socket,onCommand}:{view:BuildView;socket:CoreNode;onCommand:(action:JewelAction)=>void}){
 const [items,setItems]=useState<JewelInstance[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/api/rpg/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'view'}),signal:c.signal}).then(r=>r.json()).then(v=>{if(v.error)throw Error(v.error);setItems(v.jewels??[]);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[]);
 const placed=view.state.jewels??[],equipped=placed.find(p=>p.socketId===socket.id),available=items.filter(j=>{const d=JEWELS_BY_ID.get(j.jewelId);return d&&!placed.some(p=>p.instanceId===j.instanceId)&& (socket.socketType==='unique'?d.kind==='unique'||d.kind==='normal':d.kind===socket.socketType);});
 const choice=available.some(j=>j.instanceId===selected)?selected:available[0]?.instanceId??'';
 return <section className="jewel-socket-panel" aria-label="주얼 장착"><b>◇ {socket.socketType==='timeless'?'군단 · 반경 310':socket.socketType==='large'?'대형 군주얼 · 최대 2개':socket.socketType==='unique'?'일반 / 고유 주얼':socket.socketType==='medium'?'중형 군주얼':'소형 군주얼'} 소켓</b>{equipped?<><p>장착: {JEWELS_BY_ID.get(equipped.jewelId)?.name} · 시드 {equipped.seed}{equipped.conqueror&&` · ${equipped.conqueror}`}</p><button onClick={()=>onCommand(`jewel-unequip:${socket.id}`)}>주얼 해제</button><small>군주얼 하위 노드를 먼저 회수해야 해제할 수 있습니다.</small></>:<><label>보유 주얼<select aria-label="장착할 보유 주얼" value={choice} onChange={e=>setSelected(e.target.value)}><option value="">주얼 선택</option>{available.map(j=><option key={j.instanceId} value={j.instanceId}>{JEWELS_BY_ID.get(j.jewelId)?.name} · {j.conqueror??''} #{j.seed}</option>)}</select></label><button disabled={!choice||!view.state.nodes.includes(socket.id)} onClick={()=>onCommand(`jewel-equip:${socket.id}:${choice}`)}>선택 주얼 장착</button><small>{!view.state.nodes.includes(socket.id)?'먼저 이 소켓까지 연결된 노드를 배워 주세요.':!available.length?'맞는 주얼이 없습니다. 홀덤 로비 → 주얼 상점에서 구매하세요.':'장착 후 변환된 효과와 군주얼의 연결 노드를 확인하세요.'}</small></>}{error&&<p role="status">{error}</p>}</section>;
}
