import type { CSSProperties } from "react";

interface Props {
  amount: number;
  name: string;
  position: { top: string; left: string };
}

// Anchor chips to the table, independently of the avatar/name/stack height.
// Pull each seat towards the centre while keeping clear of the board and pot.
export function TableBet({ amount, name, position }: Props) {
  if (amount <= 0) return null;
  const seatTop = parseFloat(position.top);
  const seatLeft = parseFloat(position.left);
  const top = seatTop>75 ? 76 : seatTop<20 ? 27 : seatTop<40 ? 35 : 65;
  const left = seatTop>75 ? (seatLeft<50?42:58) : 50+(seatLeft-50)*.60;
  return (
    <div
      className="poker-bet absolute top-[var(--bet-mobile-top)] sm:top-[var(--bet-top)] z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ "--bet-top": `${top}%`, "--bet-mobile-top": `${top}%`, left: `${left}%` } as CSSProperties}
      aria-label={`${name} 베팅 ${amount.toLocaleString()} 칩`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-amber-300 bg-slate-950 px-2 py-1 sm:px-2.5 sm:py-1 shadow-lg whitespace-nowrap">
        <span aria-hidden="true" className="flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-full border-2 border-dashed border-rose-200 bg-rose-700 text-[7px] text-white">◆</span>
        <span className="text-[13px] sm:text-sm font-black text-white tabular-nums">{amount.toLocaleString()}</span>
      </div>
    </div>
  );
}
