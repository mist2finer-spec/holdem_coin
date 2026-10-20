"use client";
import {RaiseMultiplierButton} from './RaiseMultiplierButton';
import {potFractionSizing} from '@/lib/poker-sizing';
import type {ActionType} from '@/lib/poker-engine';

export function PokerActionButtons({currentBet,call,stack,minRaise,maxRaise,pot,onSubmit}:{
  currentBet:number;call:number;stack:number;minRaise:number;maxRaise:number;pot:number;
  onSubmit:(action:ActionType,amount:number)=>void;
}) {
  const button='min-w-0 w-full h-12 sm:h-14 rounded-md border font-bold text-[10px] sm:text-sm leading-tight touch-manipulation disabled:opacity-40';
  const fractionButton=(fraction:number,label:string)=>{
    const size=potFractionSizing(currentBet,call,stack,minRaise,maxRaise,pot,fraction);
    return <button type="button" disabled={!size.canRaise}
      onClick={()=>onSubmit(size.allIn?'allin':'raise',size.allIn?stack:size.target)}
      title={`${label} · 총 ${size.target.toLocaleString()}칩${size.allIn?' · ALL-IN':''} (최소 레이즈·잔고 제한 적용)`}
      className={`${button} bg-sky-800 hover:bg-sky-700 border-sky-500 text-sky-50`}>
      <span className="block">{label}</span>
      <span className="block text-[9px] sm:text-xs opacity-90">{size.allIn?'ALL-IN · ':''}{size.target.toLocaleString()}</span>
    </button>;
  };
  return <div className="grid grid-cols-4 grid-rows-2 gap-1.5 sm:gap-2 my-2" aria-label="배팅 액션">
    <button type="button" onClick={()=>onSubmit('fold',0)}
      className={`${button} col-start-1 row-start-1 bg-rose-800 hover:bg-rose-700 border-rose-500 text-rose-50`}>FOLD</button>
    <button type="button" onClick={()=>onSubmit(call>0?'call':'check',Math.min(call,stack))}
      className={`${button} col-start-1 row-start-2 bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-emerald-50`}>
      {call>0?<><span className="block">CALL</span><span className="block text-[9px] sm:text-xs">{Math.min(call,stack).toLocaleString()}</span></>:'CHECK'}
    </button>
    <div className="col-start-2 row-start-1 row-span-2 flex items-center min-w-0">
      <RaiseMultiplierButton currentBet={currentBet} call={call} stack={stack}
        minRaise={minRaise} maxRaise={maxRaise} onSubmit={onSubmit}/>
    </div>
    <div className="col-start-3 row-start-1">{fractionButton(1/4,'1/4 POT')}</div>
    <div className="col-start-3 row-start-2">{fractionButton(1/2,'1/2 POT')}</div>
    <div className="col-start-4 row-start-1">{fractionButton(3/4,'3/4 POT')}</div>
    <button type="button" onClick={()=>onSubmit('allin',stack)} disabled={stack<=0}
      className={`${button} col-start-4 row-start-2 bg-rose-600 hover:bg-rose-500 border-rose-300 text-amber-100`}>ALL-IN</button>
  </div>;
}
