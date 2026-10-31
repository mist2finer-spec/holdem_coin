'use client';
import {useState} from 'react';
import {ACTIVE_SKILLS,GEMS,CORE_NODES,CORE_EDGES,supports,changeBuild,type BuildView,type BuildAction} from './hunt-build';
import './gem-core.css';
export function GemCorePanel({view,onCommand,onClose,error}:{view:BuildView;onCommand:(action:BuildAction)=>void;onClose:()=>void;error?:string}){
 const [tab,setTab]=useState<'gems'|'core'>('gems'),[skill,setSkill]=useState(0),[selected,setSelected]=useState('0_1');
 const compiled=view.skills[skill],node=CORE_NODES.find(n=>n.id===selected)!,owned=view.state.nodes.includes(selected);
 const can=(action:BuildAction)=>{try{changeBuild(view.state,action,view.level);return true;}catch{return false;}};
 return <div className="gem-core">
  <header><div><small>UMBRA · BUILD LAB</small><h2>젬과 옴브라 코어</h2></div><button aria-label="빌드 닫기" onClick={onClose}>✕</button></header>
  <p className="gem-note">시험 빌드 · 보조 젬 6종 무료 사용 · 코어 기본 12P + 레벨 보너스<br/>같은 게스트의 두 사냥 모드에 저장 · 변경은 다음 시전부터 적용</p>
  <div className="gem-tabs"><button aria-pressed={tab==='gems'} onClick={()=>setTab('gems')}>스킬 링크</button><button aria-pressed={tab==='core'} onClick={()=>setTab('core')}>연결 코어 <b>{view.remaining}P</b></button></div>
  {error&&<p role="status" className="gem-error">{error}</p>}
  {tab==='gems'?<>
   <div className="gem-actives">{ACTIVE_SKILLS.map((s,i)=><button key={s.id} aria-label={`${s.name} 링크 편집`} aria-pressed={skill===i} onClick={()=>setSkill(i)}><img alt="" src={`/rpg/SkillIcon_${s.icon}.png`}/><span>{s.name}</span><small>{view.state.links[i].filter(Boolean).length}/3</small></button>)}</div>
   <h3>{ACTIVE_SKILLS[skill].name}</h3><div className="gem-tags">{ACTIVE_SKILLS[skill].tags.map(t=><span key={t}>{t}</span>)}</div>
   <div className="gem-links">{view.state.links[skill].map((id,slot)=><label key={slot}><span>보조 {slot+1}</span><select aria-label={`보조 슬롯 ${slot+1}`} value={id??'empty'} onChange={e=>onCommand(`gem-${skill}-${slot}-${e.target.value}`)}><option value="empty">빈 소켓</option>{GEMS.map(g=><option key={g.id} value={g.id} disabled={!supports(skill,g.id)||(id!==g.id&&view.state.links[skill].includes(g.id))}>{g.name}{!supports(skill,g.id)?' · 태그 불일치':''}</option>)}</select></label>)}</div>
   <div className="gem-preview" aria-label="스킬 계산 결과"><div><small>{compiled.heal?'회복':'타격당 피해'}</small><b>×{compiled.effect.toFixed(2)}</b></div><div><small>범위</small><b>×{compiled.range.toFixed(2)}</b></div><div><small>재사용</small><b>×{compiled.cooldown.toFixed(2)}</b></div><div><small>시전당 효과</small><b>{1+compiled.repeats}회</b></div></div>
   <p className="gem-note">코어 증가량은 합산, 젬 배율은 곱산합니다. 메아리는 0.22초 후 한 번 더 판정하며 시전 동작도 그만큼 길어집니다. 진행 중인 쿨타임은 변경되지 않습니다.</p>
   <div className="gem-library">{GEMS.map(g=><article key={g.id} className={!supports(skill,g.id)?'incompatible':''}><span>◆</span><div><strong>{g.name}</strong><p>{g.text}</p><small>{supports(skill,g.id)?'연결 가능':'이 스킬과 태그 불일치'}</small></div></article>)}</div>
  </>:<>
   <div className="gem-core-summary"><b>{view.remaining} / {view.budget} P 남음</b><span>피해 +{Math.round(view.passive.damage*100)}% · 피해 감소 {Math.round(view.passive.reduction*100)}%<br/>재사용 −{Math.round(view.passive.cooldown*100)}% · 범위 +{Math.round(view.passive.area*100)}%</span></div>
   <div className="gem-tree" aria-label="28개 연결 코어"><svg viewBox="0 0 360 560" preserveAspectRatio="none" aria-hidden="true">{CORE_EDGES.map(([a,b])=>{const n=CORE_NODES.find(n=>n.id===a)!,m=CORE_NODES.find(n=>n.id===b)!;return <line key={a+b} x1={n.x} y1={n.y} x2={m.x} y2={m.y} className={view.state.nodes.includes(b)?'lit':''}/>;})}</svg>{CORE_NODES.map(n=><button key={n.id} className={`core-node branch-${n.branch} ${view.state.nodes.includes(n.id)?'owned':''} ${selected===n.id?'selected':''}`} style={{left:`${n.x/3.6}%`,top:n.y}} aria-label={`${n.name}${view.state.nodes.includes(n.id)?' · 획득':''}`} aria-pressed={selected===n.id} onClick={()=>setSelected(n.id)}>{n.tier||'✦'}</button>)}<div className="core-branch-labels"><span>파괴</span><span>보호</span><span>침식</span></div></div>
   <div className="core-detail"><strong>{node.name}</strong><p>{node.damage?`피해 +${Math.round(node.damage*100)}%`:node.reduction?`받는 피해 −${Math.round(node.reduction*100)}%`:node.cooldown?'재사용 −2% · 범위 +2.5%':'세 갈래의 시작점 · 무료'}</p><div><button disabled={!can(`core-allocate-${selected}`)} onClick={()=>onCommand(`core-allocate-${selected}`)}>배우기 · 1P</button><button disabled={!owned||!can(`core-refund-${selected}`)} onClick={()=>onCommand(`core-refund-${selected}`)}>회수 · 1P</button><button disabled={view.state.nodes.length<=1} onClick={()=>onCommand('core-reset')}>전체 회수</button></div><small>시작점과 이어진 노드만 습득할 수 있습니다. 다른 노드를 끊는 중간 노드는 회수할 수 없습니다.</small></div>
  </>}
 </div>;
}
