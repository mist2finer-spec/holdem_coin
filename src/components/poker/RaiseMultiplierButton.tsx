"use client";
import {useState} from 'react';
import {ActionSkinButton} from './ActionSkinButton';
import {raiseSizing} from '@/lib/poker-sizing';
import type {ActionType} from '@/lib/poker-engine';

export function RaiseMultiplierButton({currentBet,call,stack,minRaise,maxRaise,onSubmit}:{
  currentBet:number;call:number;stack:number;minRaise:number;maxRaise:number;
  onSubmit:(action:ActionType,amount:number)=>void;
}) {
  // Integer tenths avoid labels such as 3.3000000000000003X.
  const [tenths,setTenths]=useState(20);
  const size=raiseSizing(currentBet,call,stack,minRaise,maxRaise,tenths);
  return <div className="relative flex-1 min-w-0">
    <div className="absolute bottom-full mb-0.5 inset-x-0 grid grid-cols-2 gap-0.5">
      {[10,2].map(step=><button key={step} type="button" aria-label={`레이즈 배율 ${step/10} 증가`}
        disabled={!size.canRaise||size.selected>=size.maxTenths}
        onClick={()=>setTenths(Math.min(size.maxTenths,size.selected+step))}
        className="h-6 text-[10px] sm:text-xs leading-none text-rose-500 hover:text-rose-300 disabled:opacity-30"
      >▲{step/10}</button>)}
    </div>
    <ActionSkinButton skin="purple" disabled={!size.canRaise}
      onClick={()=>onSubmit(size.allIn?'allin':'raise',size.allIn?stack:size.target)}
      title={`${size.label} · 총 ${size.target.toLocaleString()}칩${size.allIn?' · ALL-IN':''}`}
      className="h-8 sm:h-10"
    ><span className="block leading-tight">RAISE {size.label}</span><span className="block text-[8px] sm:text-[10px] leading-tight opacity-90">{size.allIn?'ALL-IN · ':''}{size.target.toLocaleString()}</span></ActionSkinButton>
    <div className="absolute top-full mt-0.5 inset-x-0 grid grid-cols-2 gap-0.5">
      {[10,2].map(step=><button key={step} type="button" aria-label={`레이즈 배율 ${step/10} 감소`}
        disabled={!size.canRaise||size.selected<=20}
        onClick={()=>setTenths(Math.max(20,size.selected-step))}
        className="h-6 text-[10px] sm:text-xs leading-none text-rose-500 hover:text-rose-300 disabled:opacity-30"
      >▼{step/10}</button>)}
    </div>
  </div>;
}
