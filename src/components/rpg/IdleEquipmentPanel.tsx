'use client';
import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {X,Shield,Hand,Footprints,Circle,Swords,Gem,Coins,GitBranch,Clock,ArrowUp,Check} from 'lucide-react';
import {ACTIVE_CATALOG,GEMS} from './build-catalog';
import {newBuild,supports} from './hunt-build';
import {heroStats,type HuntProgress} from './hunt-progression';
import {GoldStatControls,TraitControls} from './HuntGrowth';
import {traitPoints} from './hunt-development';
import {EQUIPMENT_LABELS,EQUIPMENT_RARITIES,EQUIPMENT_SLOTS,EQUIPMENT_SLOT_LABELS,equipmentLinkCap,equipmentUpgradeCost,equippedItems,type EquipmentInstance,type EquipmentSlot} from './idle-equipment';
import {GACHA_POLICY,EQUIPMENT_GACHA_WEIGHTS,gachaLevel,type EquipmentGachaPool} from './idle-gacha';
import {IDLE_BALANCE,idleBuildBudget,idleLevelCost} from './idle-progression';
import {WEAPONS} from './hunt-weapons';
import './idle-equipment.css';
const format=(n:number)=>n.toLocaleString('ko-KR'),compact=(n:number)=>new Intl.NumberFormat('ko',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n);
const rarityColor={normal:'#b7bcb5',high:'#8fca88',rare:'#89b7ec',heroic:'#c59bee',ancient:'#edbd75',mythic:'#f0929c'};
const tabs=[['equipment','장비',Swords],['summon','소환',Gem],['goldstats','골드 성장',Coins],['traits','특성',GitBranch]] as const;
const pools:[EquipmentGachaPool,string][]=[['weapon','무기'],['armor','갑옷'],['gloves','장갑'],['boots','장화'],['ring','반지']];
const itemName=(item:EquipmentInstance)=>`${EQUIPMENT_LABELS[item.rarity]} ${item.weaponType?WEAPONS[item.weaponType].name:EQUIPMENT_SLOT_LABELS[item.slot]}`;
function ItemIcon({item}:{item:EquipmentInstance}){if(item.weaponType)return <img src={`/rpg/weapons/${item.weaponType}.png`} alt=""/>;const Icon=item.slot==='armor'?Shield:item.slot==='gloves'?Hand:item.slot==='boots'?Footprints:Circle;return <Icon aria-hidden="true"/>;}
const uniqueName={'cluster-notables':'군주얼 주요 노드마다 피해 +15%','devotion-speed':'헌신마다 공격속도 +0.1%'};

export function IdleEquipmentPanel({progress:p,onCommand,onClose,error,feedback}:{progress:HuntProgress;onCommand:(action:string)=>void;onClose:()=>void;error?:string;feedback?:string}){
 const [tab,setTab]=useState<typeof tabs[number][0]>('equipment'),[slot,setSlot]=useState<EquipmentSlot>('weapon'),[selection,setSelection]=useState(''),[pool,setPool]=useState<EquipmentGachaPool>('weapon');
 useEffect(()=>{const handle=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[onClose]);
 const equipment=p.equipment,collection=p.gemCollection;
 const equipped=useMemo(()=>equipment?equippedItems(equipment):null,[equipment]);
 const reserved=useMemo(()=>{const result={active:{} as Record<string,number>,support:{} as Record<string,number>};for(const item of equipment?.items??[])item.gems.forEach((id,index)=>{if(id){const kind=index===0?'active':'support';result[kind][id]=(result[kind][id]??0)+1;}});return result;},[equipment]);
 const items=useMemo(()=>equipment?.items.filter(item=>item.slot===slot).sort((a,b)=>EQUIPMENT_RARITIES.indexOf(b.rarity)-EQUIPMENT_RARITIES.indexOf(a.rarity)||b.level-a.level)||[],[equipment,slot]);
 const selected=items.find(item=>item.instanceId===selection)??equipped?.[slot],active=ACTIVE_CATALOG.find(gem=>gem.id===selected?.gems[0]),stats=heroStats(p),level=gachaLevel(p.gacha?.equipmentPulls??0),weights=EQUIPMENT_GACHA_WEIGHTS[level-1];
 const currentBuild={...(p.build??newBuild()),...(equipment?{equipment}:{})},budget=idleBuildBudget(p.level),required=idleLevelCost(p.level);
 const available=(kind:'active'|'support',id:string,current:string|null)=>Math.max(0,(collection?.[kind][id]??0)-(reserved[kind][id]??0)+(current===id?1:0));
 const chooseSlot=(next:EquipmentSlot)=>{setSlot(next);setSelection(equipped?.[next].instanceId??'');};
 return <section className="idle-panel" aria-label="방치 성장과 장비">
  <header className="idle-header"><div><small>THE LONG HUNT</small><h2>성장 · 장비</h2></div><div className="idle-wallet"><span><Coins size={13}/>{compact(p.gold)}</span><span><Gem size={13}/>{format(p.soulGem)}</span></div><button className="idle-close" aria-label="장비 성장창 닫기" onClick={onClose}><X size={20}/></button></header>
  <div className="idle-progress"><div><strong>Lv. {p.level}</strong><span>코어 {budget}P · 특성 {traitPoints(p)}P 남음</span></div><progress aria-label="다음 레벨 경험치" value={p.xp} max={required||1}/><small>{format(p.xp)} / {format(required)} XP · 방치 적립 + 전투 보상</small><button onClick={()=>onCommand('idle-claim')} disabled={!p.idle}><Clock size={14}/> 방치 보상 받기</button></div>
  <nav className="idle-tabs" aria-label="성장 메뉴">{tabs.map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={16}/><span>{label}</span></button>)}</nav>
  {error&&<p className="idle-error" role="status">{error}</p>}
  {feedback&&!error&&<p className="idle-feedback" role="status" aria-live="polite">{feedback}</p>}
  <div className="idle-content">
   {tab==='equipment'&&(!equipped||!equipment||!collection?<p className="idle-muted">보유 장비 정보를 불러오는 중입니다.</p>:<>
    <div className="idle-equipped" aria-label="장착한 여섯 장비">{EQUIPMENT_SLOTS.map(key=>{const item=equipped[key];return <button key={key} aria-pressed={slot===key} onClick={()=>chooseSlot(key)} style={{'--rarity':rarityColor[item.rarity]} as CSSProperties}><small>{EQUIPMENT_SLOT_LABELS[key]}</small><ItemIcon item={item}/><b>{EQUIPMENT_LABELS[item.rarity]}</b><span>{item.gems.filter(Boolean).length}/{equipmentLinkCap(item)} 소켓</span></button>;})}</div>
    <label className="idle-select-label">보유 {EQUIPMENT_SLOT_LABELS[slot]} <span>{items.length}개</span><select aria-label="보유 장비 선택" value={selected?.instanceId??''} onChange={event=>setSelection(event.target.value)}>{items.map(item=><option key={item.instanceId} value={item.instanceId}>{itemName(item)} · Lv.{item.level} · {equipmentLinkCap(item)}소켓{equipped[slot].instanceId===item.instanceId?' · 장착 중':''} · #{item.instanceId.slice(-5)}</option>)}</select></label>
    {selected&&<article className="idle-item-detail" style={{'--rarity':rarityColor[selected.rarity]} as CSSProperties}>
     <div className="idle-item-title"><div className="idle-large-icon"><ItemIcon item={selected}/></div><div><small>{equipped[slot].instanceId===selected.instanceId?'현재 장착':'보관 중'} · Lv.{selected.level} / 50</small><h3>{itemName(selected)}</h3><p>{equipmentLinkCap(selected)} 소켓 · 액티브 1 + 보조 {equipmentLinkCap(selected)-1}{selected.weaponType==='dual'?' · 두 자루가 한 그룹':''}</p></div></div>
     {!!selected.builtInSupports?.length&&<p className="idle-option">내장 보조 · {selected.builtInSupports.map(id=>GEMS.find(g=>g.id===id)?.name??id).join(', ')}<small>태그가 맞을 때 적용 · 동일 보조 효과는 중복되지 않습니다.</small></p>}
     {selected.uniqueEffect&&<p className="idle-option">고유 효과 · {uniqueName[selected.uniqueEffect]}</p>}
     <div className="idle-item-actions"><button disabled={equipped[slot].instanceId===selected.instanceId} onClick={()=>onCommand(`idle-equip-${selected.instanceId}`)}><Check size={15}/>{equipped[slot].instanceId===selected.instanceId?'장착 중':'장착하기'}</button><button disabled={!equipmentUpgradeCost(selected)||p.soulGem<equipmentUpgradeCost(selected)} onClick={()=>onCommand(`idle-upgrade-${selected.instanceId}`)}><ArrowUp size={15}/>{selected.level>=50?'최대 강화':`강화 · ◆ ${format(equipmentUpgradeCost(selected))}`}</button></div>
     <div className="idle-sockets"><label><span>액티브 젬</span><select aria-label="장비 액티브 젬" value={selected.gems[0]??'empty'} onChange={event=>onCommand(`idle-socket-${selected.instanceId}-0-${event.target.value}`)}><option value="empty">빈 액티브 소켓</option>{ACTIVE_CATALOG.filter(gem=>(collection.active[gem.id]??0)>0).map(gem=><option key={gem.id} value={gem.id} disabled={available('active',gem.id,selected.gems[0])<1}>{gem.name} · 보유 {collection.active[gem.id]}{available('active',gem.id,selected.gems[0])<1?' · 다른 장비에 사용 중':''}</option>)}</select></label>
      {selected.gems.slice(1).map((id,index)=><label key={index}><span>보조 {index+1}</span><select aria-label={`장비 보조 소켓 ${index+1}`} value={id??'empty'} onChange={event=>onCommand(`idle-socket-${selected.instanceId}-${index+1}-${event.target.value}`)}><option value="empty">빈 보조 소켓</option>{GEMS.filter(gem=>(collection.support[gem.id]??0)>0).map(gem=>{const previewEquipment={...equipment,equipped:{...equipment.equipped,[slot]:selected.instanceId}},compatible=!!active&&supports(EQUIPMENT_SLOTS.indexOf(slot),gem.id,{...currentBuild,equipment:previewEquipment}),duplicate=id!==gem.id&&selected.gems.slice(1).includes(gem.id),free=available('support',gem.id,id);return <option key={gem.id} value={gem.id} disabled={!compatible||duplicate||free<1}>{gem.name} · 보유 {collection.support[gem.id]}{!compatible?' · 태그 불일치':duplicate?' · 이미 연결':free<1?' · 사용 중':''}</option>;})}</select></label>)}
     </div><p className="idle-muted">{selected.gems.length===1?'이 장비는 액티브 전용입니다.':'같은 장비의 보조만 이 액티브에 적용됩니다.'} 가방에 꽂아 둔 젬도 보유 수량을 사용합니다.</p>
    </article>}
    <details className="idle-details"><summary>등급별 소켓 한도 · 이전 장비</summary><div className="idle-table-scroll"><table><thead><tr><th>장비</th>{EQUIPMENT_RARITIES.map(rarity=><th key={rarity}>{EQUIPMENT_LABELS[rarity]}</th>)}</tr></thead><tbody>{(['sword','axe','dual','spear','armor','gloves','boots','ring1'] as const).map(kind=><tr key={kind}><th>{kind in WEAPONS?WEAPONS[kind as keyof typeof WEAPONS].name:EQUIPMENT_SLOT_LABELS[kind as EquipmentSlot]}</th>{EQUIPMENT_RARITIES.map(rarity=><td key={rarity}>{equipmentLinkCap({slot:['sword','axe','dual','spear'].includes(kind)?'weapon':kind as EquipmentSlot,weaponType:['sword','axe','dual','spear'].includes(kind)?kind as 'sword'|'axe'|'dual'|'spear':undefined,rarity})}</td>)}</tr>)}</tbody></table></div><p>반지1·2는 각각 1소켓입니다. 예전 빌드의 젬은 보유 수량으로 옮겨집니다. 새 장비 한도를 넘던 연결은 보유 젬에서 다시 장착할 수 있습니다.</p></details>
   </>)}
   {tab==='summon'&&<>
    <div className="idle-summon-intro"><Gem size={26}/><div><h3>새 장비, 새로운 연결</h3><p>무료 게임 영혼석으로 소환합니다.<br/>기본 액티브 6개부터 나만의 조합을 모으세요.</p></div></div>
    <article className="idle-summon-card"><div className="idle-card-heading"><h3>장비 소환</h3><span>소환 Lv.{level}</span></div><div className="idle-pools" role="group" aria-label="장비 소환 종류">{pools.map(([id,label])=><button key={id} aria-pressed={pool===id} onClick={()=>setPool(id)}>{label}</button>)}</div><p className="idle-muted">{pool==='weapon'?'검 · 도끼 · 쌍수 · 창이 각각 25%입니다.':pool==='ring'?'반지1 · 반지2가 각각 50%입니다.':'선택한 종류의 장비를 획득합니다.'} 새 장비는 빈 소켓으로 획득합니다.</p><div className="idle-draw-buttons">{[1,10].map(count=><button key={count} disabled={!p.gacha||!equipment||p.soulGem<GACHA_POLICY.equipmentCost*count||equipment.items.length+count>2000} onClick={()=>onCommand(`idle-draw-equipment-${pool}-${count}`)}><strong>{count}회 소환</strong><span>◆ {format(GACHA_POLICY.equipmentCost*count)}</span></button>)}</div><small>누적 {format(p.gacha?.equipmentPulls??0)}회 · 100회마다 소환 레벨 상승 · 최대 10</small></article>
    <article className="idle-summon-card"><div className="idle-card-heading"><h3>젬 소환</h3><span>액티브 45% · 보조 55%</span></div><p className="idle-muted">추가 액티브 29종과 보조 30종. 중복 젬은 복사본으로 보관해 다른 장비에 사용할 수 있습니다.</p><div className="idle-draw-buttons">{[1,10].map(count=><button key={count} disabled={!p.gacha||!collection||p.soulGem<GACHA_POLICY.gemCost*count} onClick={()=>onCommand(`idle-draw-gems-${count}`)}><strong>{count}회 소환</strong><span>◆ {format(GACHA_POLICY.gemCost*count)}</span></button>)}</div><small>수집 액티브 {Object.keys(collection?.active??{}).length}/35 · 보조 {Object.keys(collection?.support??{}).length}/30</small></article>
    <details className="idle-details"><summary>소환 확률 · 정책 확인</summary><p>소환 Lv.{level}의 확률입니다. 원본 게임의 소환 확률·가격은 확인되지 않아 이 게임용으로 정한 수치를 사용합니다.</p><div className="idle-rates">{EQUIPMENT_RARITIES.map((rarity,index)=><div key={rarity}><span style={{color:rarityColor[rarity]}}>{EQUIPMENT_LABELS[rarity]}</span><b>{(weights[index]/100).toFixed(2)}%</b></div>)}</div><p>젬은 계열을 먼저 뽑은 뒤 그 안에서 균등하게 선택합니다. 추가 액티브 각 {(45/29).toFixed(4)}%, 보조 각 {(55/30).toFixed(4)}%. 기본 액티브 6개는 소환 풀에서 제외됩니다.</p><p>고대·신화 무기/갑옷은 추가 5% 확률로 옵션을 얻습니다. 무기: 포악함/출혈, 갑옷: 군주얼 피해/헌신 공속 중 하나입니다. 천장·10회 할인·결제는 없습니다.</p></details>
   </>}
   {tab==='goldstats'&&<GoldStatControls progress={p} onCommand={onCommand}/>}
   {tab==='traits'&&<TraitControls progress={p} onCommand={onCommand}/>}
   <details className="idle-details idle-pace"><summary><Clock size={13}/> 방치 성장 속도</summary><p>분당 경험치 {IDLE_BALANCE.xpPerMinute} · 골드 {IDLE_BALANCE.goldPerMinute} · 영혼석 {IDLE_BALANCE.soulGemPerMinute}. 접속 여부와 관계없이 같은 시간으로 적립되며 한 번에 최대 24시간입니다.</p><p>새 계정에서 매일 24시간을 빠짐없이 받으면 코어 50P 약32일, 60P 약57일이 설계 목표입니다. 처치로 경험치가 추가되지는 않습니다. 실제 플레이 측정값이 아니며 기존 레벨과 놓친 정산 시간에 따라 달라집니다.</p></details>
  </div><footer className="idle-stats"><span>기초 공격 <b>{compact(stats.attack)}</b></span><span>성장 체력 <b>{compact(stats.naturalHP)}</b></span><span>기초 치명타 <b>{(stats.crit*100).toFixed(1)}%</b></span></footer>
 </section>;
}
