"use client";
import type {ButtonHTMLAttributes} from 'react';

type ActionSkin='red'|'blue'|'purple';
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{skin:ActionSkin};

export function ActionSkinButton({skin,className='',style,children,type='button',...props}:Props) {
  return <button {...props} type={type}
    className={`relative min-w-0 w-full border-0 bg-transparent rounded-md font-bold text-[10px] sm:text-sm leading-tight text-slate-50 touch-manipulation disabled:opacity-40 enabled:hover:brightness-125 transition-[filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] ${className}`}
    style={{backgroundImage:`url('/ui-buttons/btn-${skin}.png')`,backgroundSize:'100% 100%',
      backgroundPosition:'center',backgroundRepeat:'no-repeat',...style}}>
    <span className="relative flex h-full w-full flex-col items-center justify-center px-2 py-1">{children}</span>
  </button>;
}
