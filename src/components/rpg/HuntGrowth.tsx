'use client';
import type {BattleView,HuntAction} from '../../lib/rpg-service';
export function HuntGrowth({view,active,onCommand}:{view:BattleView|null;active:boolean;onCommand:(a:HuntAction)=>void}){
 const enough=(cost:number|undefined,kind:'gold'|'soulGem')=>!!view&&!!cost&&active&&view.progress[kind]>=cost;
 return <div className="growth-panel">
  <div className="growth-summary"><strong>Lv. {view?.progress.level??1}</strong><span>골드 {(view?.progress.gold??0).toLocaleString()} · 영혼석 {(view?.progress.soulGem??0).toLocaleString()}</span></div>
  <div className="growth-stats"><span>공격력<strong>{view?.stats.attack??'—'}</strong></span><span>성장 체력<strong>{view?.stats.naturalHP??'—'}</strong></span><span>치명타<strong>{Math.round((view?.stats.crit??0)*100)}%</strong></span></div>
  <p className="growth-hint">무기의 장착 효과와 보유 효과가 함께 적용됩니다. 방어구와 체력 수련은 생존력을 높입니다.</p>
  <article className="growth-card"><img src="/rpg/weapons/sword.png" alt=""/><div><h3>공격 수련 <small>Lv.{view?.progress.attackTraining??0} / 500</small></h3><p>기본 공격력 +1</p></div><button disabled={!enough(view?.trainingCosts.attack,'gold')} onClick={()=>onCommand('train-attack')}>수련<small>{view?.trainingCosts.attack?`${view.trainingCosts.attack.toLocaleString()} 골드`:'MAX'}</small></button></article>
  <article className="growth-card"><span className="growth-emblem" aria-hidden="true">✦</span><div><h3>체력 수련 <small>Lv.{view?.progress.healthTraining??0} / 500</small></h3><p>기본 체력 +5</p></div><button disabled={!enough(view?.trainingCosts.health,'gold')} onClick={()=>onCommand('train-health')}>수련<small>{view?.trainingCosts.health?`${view.trainingCosts.health.toLocaleString()} 골드`:'MAX'}</small></button></article>
  <article className="growth-card"><span className="growth-emblem" aria-hidden="true">🛡</span><div><h3>방어구 <small>등급 1 · Lv.{view?.progress.armorLevel??1} / 50</small></h3><p>성장 체력 {view?.armorPreview.naturalHP??'—'} {view?.armorPreview.nextHP!=null?`→ ${view.armorPreview.nextHP}`:''}</p></div><button disabled={!enough(view?.armorCost,'soulGem')} onClick={()=>onCommand('armor')}>강화<small>{view?.armorCost?`${view.armorCost.toLocaleString()} 영혼석`:'MAX'}</small></button></article>
  <p className="growth-hint">전투 HP는 테스트용 10,000입니다. 성장 체력이 높아지면 받는 피해가 줄어듭니다. 수련과 강화 결과는 자동 저장됩니다.</p>
 </div>;
}
