'use client';
import {useState} from 'react';
import {X,Info,GitBranch,Swords} from 'lucide-react';
import {ABILITY_INFO,ABILITY_ORDER,DEVELOPMENT,artLevel,artQuote,traitIncrement,traitPoints} from './hunt-development';
import type {HuntProgress} from './hunt-progression';
import type {BattleView,HuntAction} from '../../lib/rpg-service';
import './hunt-development.css';
const tabs=[['arts','골드 성장',Swords],['traits','특성',GitBranch]] as const;
const fmt=(n:number)=>new Intl.NumberFormat('ko',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n);
const value=(n:number)=>Number(n.toFixed(2)).toLocaleString();
type GrowthCommand=`art-${number}-${number}`|`trait-${number}`;
type ControlsProps={progress:HuntProgress;onCommand:(action:GrowthCommand)=>void;disabled?:boolean};
export function GoldStatControls({progress:p,onCommand,disabled=false}:ControlsProps){
 const [batch,setBatch]=useState(1);
 return <><p className="development-note">골드로 능력치를 영구 성장시킵니다. 묶음 훈련은 보유 골드와 선행 조건 안에서 가능한 단계만 구매합니다.</p><div className="development-batches" role="group" aria-label="훈련 횟수">{[1,10,100].map(n=><button key={n} aria-pressed={batch===n} onClick={()=>setBatch(n)}>×{n}</button>)}</div>
 <div className="development-list">{ABILITY_ORDER.map(ability=>{const meta=ABILITY_INFO[ability],rows=DEVELOPMENT.arts.filter(row=>row.ability===ability),row=rows.find(row=>artLevel(p,row.id)<row.max)??rows[rows.length-1],quote=artQuote(p,row.id,batch),total=rows.reduce((sum,row)=>sum+artLevel(p,row.id)*row.increment,0);
 return <article className="development-row" key={ability}><img src={`/rpg/SkillIcon_${meta.icon}.png`} alt=""/><div><small>단계 {row.tier} · Lv.{quote.level} / {row.max}</small><h3>{meta.name}</h3><p>+{value(total)}{meta.percent?'%':''}</p><span>{quote.lock||meta.hint}</span></div><button disabled={disabled||!quote.quantity} onClick={()=>onCommand(`art-${row.id}-${batch}`)}>{quote.level===row.max?'MAX':quote.lock?'잠김':`+${quote.quantity||batch} 훈련`}<small>{quote.quantity?`${fmt(quote.cost)} 골드`:quote.nextCost?`${fmt(quote.nextCost)} 골드`:''}</small></button></article>;
 })}</div></>;
}
export function TraitControls({progress:p,onCommand,disabled=false}:ControlsProps){
 const remaining=traitPoints(p);
 return <><p className="development-note">남은 특성 <b>{remaining}P</b> · 레벨 상승마다 1P<br/>각 항목 최대 10레벨 · 1P는 해당 전투술 10레벨의 효과입니다. 코어 트리 포인트와 별도로 사용합니다.</p><div className="development-traits">{ABILITY_ORDER.map(ability=>{const meta=ABILITY_INFO[ability],rank=p.traits?.[ability]??0;return <button key={ability} disabled={disabled||rank>=10||remaining<1} onClick={()=>onCommand(`trait-${ability}`)}><img src={`/rpg/SkillIcon_${meta.icon}.png`} alt=""/><strong>{meta.name}</strong><span>Lv. {rank} / 10</span><small>+{value(rank*traitIncrement(ability))}{meta.percent?'%':''}</small><i>{rank>=10?'MAX':'특성 1P 사용'}</i></button>;})}</div></>;
}
export function HuntGrowth({view,active,onCommand,onClose}:{view:BattleView|null;active:boolean;onCommand:(a:HuntAction)=>void;onClose:()=>void}){
 const [tab,setTab]=useState<typeof tabs[number][0]>('arts'),[info,setInfo]=useState(false),p=view?.progress;
 return <section className="hunt-development" aria-label="캐릭터 성장"><header className="development-header"><div><small>CHARACTER GROWTH</small><strong>성장 <span>Lv. {p?.level??1}</span></strong></div><span>{tab==='traits'?`특성 ${p?traitPoints(p):0}P`:`골드 ${fmt(p?.gold??0)}`}</span><button aria-label="성장 안내" aria-expanded={info} onClick={()=>setInfo(!info)}><Info size={19}/></button><button aria-label="성장창 닫기" onClick={onClose}><X size={21}/></button></header><nav className="development-tabs" aria-label="성장 분류">{tabs.map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
 {info&&<div className="development-help">복구된 전투술·골드 훈련과 레벨당 특성 1P를 유지합니다. 스킬은 보유한 액티브 젬과 장비의 보조 소켓으로 조합합니다. 장비와 젬은 장비·소환 창에서 관리하세요.</div>}
 <div className="development-body">{p?tab==='arts'?<GoldStatControls progress={p} onCommand={onCommand} disabled={!active}/>:<TraitControls progress={p} onCommand={onCommand} disabled={!active}/>:<p className="development-note">성장 정보를 불러오는 중입니다.</p>}</div><footer className="development-stats"><span>기초 공격력 <b>{fmt(view?.stats.attack??0)}</b></span><span>성장 체력 <b>{fmt(view?.stats.naturalHP??0)}</b></span><span>치명타 <b>{value((view?.stats.crit??0)*100)}%</b></span></footer></section>;
}
