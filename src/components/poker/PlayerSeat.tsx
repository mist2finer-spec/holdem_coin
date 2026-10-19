"use client";
import { SeatState } from "@/lib/poker-engine";
import { PixelAvatar } from "./PixelAvatar";
import { PlayingCard } from "./PlayingCard";

interface Props {
  seat: SeatState;
  isActive: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCards: boolean; // 쇼다운에서 모든 카드 공개
  position: { top: string; left: string }; // 테이블 상대 위치 (%)
  lastActionText?: string;
}

export function PlayerSeat({
  seat,
  isActive,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCards,
  position,
  lastActionText,
}: Props) {
  const persona = seat.persona;
  const colorClass = seat.isUser
    ? "from-blue-700 to-indigo-900"
    : persona?.color ?? "from-slate-700 to-slate-900";
  const accentClass = seat.isUser ? "text-blue-200" : persona?.accent ?? "text-slate-300";

  // top이 50% 미만이면(상단) 카드를 아래에, 50% 이상이면(하단) 카드를 위에 배치
  const topNum = parseFloat(position.top);
  const cardsBelow = topNum < 50;

  const cardsElement = (
    <div className="flex gap-0.5 h-8 sm:h-12 items-center">
      {/* ★ 쇼다운에서만 카드 공개 (올인이어도 쇼다운 전에는 카드 백)
          - 본인 카드는 항상 보임
          - 다른 플레이어는 showCards(=쇼다운)일 때만 공개
          - 폴드한 플레이어는 쇼다운이어도 카드 숨김 */}
      {seat.holeCards.length > 0 && !seat.folded && (seat.isUser || showCards) ? (
        <>
          <PlayingCard card={seat.holeCards[0]} size="sm" />
          <PlayingCard card={seat.holeCards[1]} size="sm" />
        </>
      ) : seat.holeCards.length > 0 && !seat.folded ? (
        <>
          <PlayingCard hidden size="sm" />
          <PlayingCard hidden size="sm" />
        </>
      ) : (
        <div className="w-12 sm:w-16 h-8 sm:h-12" />
      )}
    </div>
  );

  const avatarBlock = (
    <div
      className={`relative rounded-lg bg-gradient-to-br ${colorClass} p-[2px] shadow-xl ${
        isActive ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-emerald-950 animate-pulse" : ""
      } ${seat.folded ? "opacity-30 grayscale" : ""}`}
    >
      <div className="bg-slate-950/60 rounded-md p-0.5 sm:p-1 flex items-center justify-center">
        <PixelAvatar persona={persona} isUser={seat.isUser} size={36} isActive={isActive} />
      </div>

      {/* 딜러 버튼 */}
      {isDealer && (
        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-amber-950 text-[9px] sm:text-[10px] font-bold flex items-center justify-center border-2 border-amber-200 shadow-lg">
          D
        </div>
      )}
      {isSmallBlind && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-400 text-sky-950 text-[8px] sm:text-[9px] font-bold flex items-center justify-center border-2 border-sky-200 shadow-lg">
          SB
        </div>
      )}
      {isBigBlind && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-400 text-rose-950 text-[8px] sm:text-[9px] font-bold flex items-center justify-center border-2 border-rose-200 shadow-lg">
          BB
        </div>
      )}

      {/* 액션 말풍선 */}
      {lastActionText && (
        <div className="absolute -top-6 sm:-top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
          <div
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border shadow-lg ${
              lastActionText === "FOLD"
                ? "bg-slate-800 text-slate-300 border-slate-500"
                : lastActionText === "CHECK" || lastActionText === "CALL"
                ? "bg-emerald-800 text-emerald-100 border-emerald-400"
                : lastActionText === "ALL-IN"
                ? "bg-rose-700 text-amber-200 border-rose-400 animate-pulse"
                : "bg-amber-500 text-amber-950 border-amber-300"
            }`}
          >
            {lastActionText}
          </div>
        </div>
      )}
    </div>
  );

  const nameBlock = (
    <div className="bg-slate-950/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 sm:px-2 border border-amber-900/50 min-w-[70px] sm:min-w-[90px] text-center">
      <div className={`text-[9px] sm:text-[11px] font-bold ${accentClass} leading-tight truncate max-w-[80px] sm:max-w-[100px]`}>
        {seat.name}
      </div>
      <div className="text-[8px] sm:text-[9px] text-amber-200/60 leading-tight truncate max-w-[80px] sm:max-w-[100px] hidden sm:block">
        {seat.isUser ? "용사님" : persona?.title}
      </div>
    </div>
  );

  const stackBlock = (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-0.5 sm:gap-1 bg-amber-950/80 rounded-full px-1.5 py-0.5 sm:px-2 border border-amber-700/50">
        <span className="text-[9px] sm:text-[10px] text-amber-400">◈</span>
        <span className="text-[9px] sm:text-[10px] font-bold text-amber-100 tabular-nums">
          {seat.stack > 9999 ? `${(seat.stack/1000).toFixed(0)}k` : seat.stack.toLocaleString()}
        </span>
      </div>
      {seat.currentBet > 0 && (
        <div className="flex items-center gap-0.5 sm:gap-1 bg-rose-950/80 rounded-full px-1.5 py-0.5 sm:px-2 border border-rose-700/50">
          <span className="text-[8px] sm:text-[9px] text-rose-300">bet</span>
          <span className="text-[9px] sm:text-[10px] font-bold text-rose-100 tabular-nums">
            {seat.currentBet > 9999 ? `${(seat.currentBet/1000).toFixed(0)}k` : seat.currentBet.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex flex-col items-center gap-1">
        {cardsBelow ? (
          <>
            {avatarBlock}
            {cardsElement}
            {nameBlock}
            {stackBlock}
          </>
        ) : (
          <>
            {cardsElement}
            {avatarBlock}
            {nameBlock}
            {stackBlock}
          </>
        )}
      </div>
    </div>
  );
}
