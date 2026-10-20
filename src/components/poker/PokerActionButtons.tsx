"use client";
import {RaiseMultiplierButton} from './RaiseMultiplierButton';
import {ActionSkinButton} from './ActionSkinButton';
import {potFractionSizing} from '@/lib/poker-sizing';
import type {ActionType} from '@/lib/poker-engine';

export function PokerActionButtons({currentBet,call,stack,minRaise,maxRaise,pot,onSubmit}:{
  currentBet:number;call:number;stack:number;minRaise:number;maxRaise:number;pot:number;
  onSubmit:(action:ActionType,amount:number)=>void;
}) {
  const button='h-12 sm:h-14';
  const fractionButton=(fraction:number,label:string)=>{
    const size=potFractionSizing(currentBet,call,stack,minRaise,maxRaise,pot,fraction);
    return <ActionSkinButton skin="purple" disabled={!size.canRaise}
      onClick={()=>onSubmit(size.allIn?'allin':'raise',size.allIn?stack:size.target)}
      title={`${label} · 총 ${size.target.toLocaleString()}칩${size.allIn?' · ALL-IN':''} (현재 팟 기준 · 최소 ${minRaise.toLocaleString()}칩)`}
      className={button}>
      <span className="block">{label}</span>
      <span className="block text-[9px] sm:text-xs opacity-90">{size.allIn?'ALL-IN · ':'총 '}{size.target.toLocaleString()}</span>
      {size.belowMinimum&&<span className="block text-[8px] sm:text-[10px]">최소 {minRaise.toLocaleString()}</span>}
    </ActionSkinButton>;
  };
  return <div className="grid grid-cols-4 grid-rows-2 gap-1.5 sm:gap-2 my-2" aria-label="배팅 액션">
    <ActionSkinButton skin="red" onClick={()=>onSubmit('fold',0)}
      className={`${button} col-start-1 row-start-1`}>FOLD</ActionSkinButton>
    <ActionSkinButton skin="blue" onClick={()=>onSubmit(call>0?'call':'check',Math.min(call,stack))}
      className={`${button} col-start-1 row-start-2`}>
      {call>0?<><span className="block">CALL</span><span className="block text-[9px] sm:text-xs">{Math.min(call,stack).toLocaleString()}</span></>:'CHECK'}
    </ActionSkinButton>
    <div className="col-start-2 row-start-1 row-span-2 flex items-center min-w-0">
      <RaiseMultiplierButton currentBet={currentBet} call={call} stack={stack}
        minRaise={minRaise} maxRaise={maxRaise} onSubmit={onSubmit}/>
    </div>
    <div className="col-start-3 row-start-1">{fractionButton(1/4,'1/4 POT')}</div>
    <div className="col-start-3 row-start-2">{fractionButton(1/2,'1/2 POT')}</div>
    <div className="col-start-4 row-start-1">{fractionButton(3/4,'3/4 POT')}</div>
    <ActionSkinButton skin="red" onClick={()=>onSubmit('allin',stack)} disabled={stack<=0}
      className={`${button} col-start-4 row-start-2`}>ALL-IN</ActionSkinButton>
  </div>;
}
