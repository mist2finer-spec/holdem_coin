'use client';
import {useEffect,useState} from 'react';
import {Hand,X,Info,Check,Sparkles} from 'lucide-react';
import {WEAPONS,type WeaponType} from './hunt-weapons';
import type {BattleView,HuntAction} from '../../lib/rpg-service';
import './hunt-armory.css';
const inventory=['sword','axe','spear','dual'] as const;
const format=(n:number)=>n.toLocaleString();
export function HuntArmory({view,active,onCommand,onClose}:{view:BattleView|null;active:boolean;onCommand:(action:HuntAction)=>void;onClose:()=>void}){
 const [selected,setSelected]=useState<WeaponType>(view?.weapon??'axe'),[info,setInfo]=useState(false);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const weapon=WEAPONS[selected],level=view?.progress.weaponLevels[selected]??1,cost=view?.weaponCosts[selected]??0;
 const equipped=view?.weapon===selected,affordable=!!view&&view.progress.soulGem>=cost;
 const icon=(type:WeaponType)=>type==='unarmed'?<Hand aria-hidden="true"/>:<img src={`/rpg/weapons/${type}.png`} alt=""/>;
 return <section className="hunt-armory" aria-label="무기창">
  <header className="armory-toolbar"><strong>소울 무기</strong><span>◆ {format(view?.progress.soulGem??0)}</span><button type="button" aria-label="무기 안내" aria-expanded={info} onClick={()=>setInfo(!info)}><Info/></button><button type="button" aria-label="무기창 닫기" onClick={onClose}><X/></button></header>
  {info&&<p className="armory-help">무기를 선택한 뒤 장착하거나 영혼석으로 강화하세요. 강화 단계는 무기별로 저장됩니다. 맨손도 선택할 수 있습니다.</p>}
  <div className="armory-inventory" role="group" aria-label="보유 무기 목록">{inventory.map(type=><button type="button" key={type} className={`armory-item ${selected===type?'is-selected':''} ${view?.weapon===type?'is-equipped':''}`} aria-pressed={selected===type} aria-label={`${WEAPONS[type].name} 레벨 ${view?.progress.weaponLevels[type]??1} 선택`} onClick={()=>setSelected(type)}>
   <span className="armory-level">Lv.{view?.progress.weaponLevels[type]??1}</span>{icon(type)}<strong>{WEAPONS[type].name}</strong>{view?.weapon===type&&<span className="armory-equipped"><Check/>장착</span>}
  </button>)}</div>
  <div className="armory-detail" aria-live="polite"><div className="armory-detail-icon">{icon(selected)}</div><div><small>{equipped?'현재 장착':'선택한 무기'}</small><h2>{weapon.name} <span>Lv.{level}</span></h2><p>{weapon.description} · 사거리 {weapon.range}</p><p>강화 공격력 +{Math.max(0,level-1)*2} <span className="armory-next">{cost>0?`→ +${level*2}`:'· 최대 단계'}</span></p></div></div>
  <div className="armory-actions"><button type="button" className="armory-unarmed" aria-pressed={selected==='unarmed'} onClick={()=>setSelected('unarmed')}><Hand/>맨손</button><button type="button" disabled={!active||equipped} onClick={()=>onCommand(`equip-${selected}`)}>{equipped?'장착 중':'장착하기'}</button><button type="button" className="armory-upgrade" disabled={!active||!cost||!affordable} onClick={()=>onCommand(`upgrade-${selected}`)}><Sparkles/><span>{selected==='unarmed'?'훈련':'강화'}<small>{cost?`◆ ${format(cost)}`:'MAX'}</small></span></button></div>
  <p className="armory-footnote">{!cost?'최대 강화 단계입니다.':!affordable?`영혼석 ${format(Math.max(0,cost-(view?.progress.soulGem??0)))}개가 더 필요합니다.`:'선택한 무기만 강화됩니다.'}</p>
 </section>;
}
