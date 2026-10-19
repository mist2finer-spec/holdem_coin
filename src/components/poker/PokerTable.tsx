"use client";
import { useState } from "react";
import { usePokerTable } from "./usePokerTable";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrainingPanel } from "./TrainingPanel";

interface Props {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

// 8좌석 테이블 상대 위치 (% 단위)
// 0번 = 하단 중앙 (유저 자리), 시계 방향으로 배치
const SEAT_POSITIONS = [
  { top: "92%", left: "50%" },  // 0: 하단 중앙 (유저)
  { top: "82%", left: "85%" },  // 1: 우하단
  { top: "45%", left: "94%" },  // 2: 우측
  { top: "12%", left: "82%" },  // 3: 우상단
  { top: "5%",  left: "50%" },  // 4: 상단 중앙
  { top: "12%", left: "18%" },  // 5: 좌상단
  { top: "45%", left: "6%"  },  // 6: 좌측
  { top: "82%", left: "15%" },  // 7: 좌하단
];

export function PokerTable({ userName, onToast }: Props) {
  const {
    seats,
    board,
    pot,
    phase,
    handNumber,
    buttonSeat,
    activeSeatId,
    lastActions,
    showdownReveal,
    winnerInfo,
    log,
    isDealing,
    awaitingUser,
    callAmount,
    minRaise,
    maxRaise,
    userSeatId,
    submitUserAction,
    trainingStats,
    setTrainingMode,
    resetTraining,
    toggleTraining,
  } = usePokerTable({ userName, onToast });

  const [raiseAmount, setRaiseAmount] = useState(0);

  const userSeat = seats.find((s) => s.isUser);
  const isUserTurn = awaitingUser && activeSeatId === userSeatId;

  // 유저가 raise slider 조정 시 초기값
  const effectiveRaise = Math.max(minRaise, Math.min(raiseAmount || minRaise, maxRaise));

  // 현재 팟 = 정산된 팟 + 진행 중인 베팅 합계
  const livePot = pot + seats.reduce((sum, s) => sum + s.currentBet, 0);

  const phaseLabel: Record<string, string> = {
    "PREFLOP": "PRE-FLOP",
    "FLOP": "FLOP",
    "TURN": "TURN",
    "RIVER": "RIVER",
    "SHOWDOWN": "SHOWDOWN",
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950">
      {/* 배경 장식: 돌벽 + 횃불 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 15% 25%, rgba(255,140,40,0.4) 0%, transparent 8%),
                            radial-gradient(circle at 85% 25%, rgba(255,140,40,0.4) 0%, transparent 8%),
                            radial-gradient(circle at 50% 95%, rgba(60,40,20,0.5) 0%, transparent 30%)`
        }}
      />
      {/* 돌 텍스처 노이즈 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6' /%3E%3C/svg%3E")`,
        }}
      />

      {/* 상단 HUD - 우측 상단 (training panel이 상단 중앙) */}
      <div className="absolute top-1 right-2 z-30 flex items-center gap-1.5">
        <div className="bg-amber-950/90 border border-amber-600 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-amber-300 text-[9px] font-bold">H#</span>
          <span className="text-amber-100 text-[11px] font-bold ml-1 tabular-nums">{handNumber}</span>
        </div>
        <div className="bg-amber-950/90 border border-amber-600 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-amber-100 text-[11px] font-bold">{phaseLabel[phase]}</span>
        </div>
        <div className="bg-rose-950/90 border border-rose-500 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-rose-200 text-[9px] font-bold">POT</span>
          <span className="text-amber-200 text-[11px] font-bold ml-1 tabular-nums">{livePot.toLocaleString()}</span>
        </div>
      </div>

      {/* 테이블 (타원형) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[min(95vw,1100px)] h-[min(85vh,640px)]">
          {/* 테이블 외곽 (나무 테두리) */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-3 rounded-[50%] bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] border-2 border-amber-700/40" />

          {/* 테이블 중앙 패턴 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-amber-700/10 text-[180px] font-bold">♠</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute top-[35%] text-rose-800/10 text-[100px] -translate-x-32">♥</div>
            <div className="absolute top-[35%] text-rose-800/10 text-[100px] translate-x-32">♦</div>
            <div className="absolute top-[60%] text-amber-700/10 text-[100px]">♣</div>
          </div>

          {/* 보드 카드 (중앙) */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2 z-10">
            {board.length === 0 && (
              <div className="text-amber-700/30 text-xs italic">카드 대기중...</div>
            )}
            {board.map((c, i) => (
              <div key={i} className="animate-[fadeIn_0.4s_ease-out]">
                <PlayingCard card={c} size="lg" />
              </div>
            ))}
          </div>

          {/* 팟 표시 (중앙 하단) */}
          {livePot > 0 && (
            <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-slate-950/85 border-2 border-amber-500/70 rounded-full px-5 py-1.5 backdrop-blur-sm shadow-lg">
                <span className="text-amber-400 text-[10px] font-bold tracking-wider">◈ POT</span>
                <span className="text-amber-100 text-base font-bold ml-2 tabular-nums">{livePot.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* 승자 표시 */}
          {winnerInfo && (
            <div className="absolute top-[25%] left-1/2 -translate-x-1/2 z-30 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-6 py-2 rounded-lg border-2 border-amber-200 shadow-2xl">
                <div className="text-amber-950 text-[10px] font-bold tracking-widest text-center">★ WINNER ★</div>
                <div className="text-amber-950 text-lg font-bold text-center">{winnerInfo.name}</div>
                <div className="text-amber-900 text-xs font-bold text-center tabular-nums">
                  +{winnerInfo.amount.toLocaleString()} 칩
                  {winnerInfo.hand && <span className="ml-2">[{winnerInfo.hand}]</span>}
                </div>
              </div>
            </div>
          )}

          {/* 8개 좌석 */}
          {seats.map((seat) => (
            <PlayerSeat
              key={seat.seatId}
              seat={seat}
              isActive={activeSeatId === seat.seatId}
              isDealer={buttonSeat === seat.seatId}
              isSmallBlind={(buttonSeat + 1) % 8 === seat.seatId}
              isBigBlind={(buttonSeat + 2) % 8 === seat.seatId}
              showCards={showdownReveal}
              position={SEAT_POSITIONS[seat.seatId]}
              lastActionText={lastActions[seat.seatId]}
            />
          ))}
        </div>
      </div>

      {/* 하단 액션 패널 (유저 전용) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          {isUserTurn ? (
            <div className="bg-slate-900/95 border-2 border-amber-600 rounded-xl p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <div className="text-amber-200 text-xs font-bold">
                  ⚔️ 당신의 차례입니다 — 행동을 선택하세요
                </div>
                <div className="text-amber-300 text-xs">
                  콜 필요: <span className="font-bold tabular-nums">{callAmount.toLocaleString()}</span>
                  {" / "}
                  잔고: <span className="font-bold tabular-nums">{userSeat?.stack.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  className="bg-rose-800 hover:bg-rose-700 text-rose-50 border border-rose-500 font-bold"
                  onClick={() => submitUserAction("fold", 0)}
                >
                  FOLD
                </Button>

                {callAmount === 0 ? (
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 border border-emerald-400 font-bold"
                    onClick={() => submitUserAction("check", 0)}
                  >
                    CHECK
                  </Button>
                ) : (
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 border border-emerald-400 font-bold"
                    onClick={() => submitUserAction("call", Math.min(callAmount, userSeat?.stack ?? 0))}
                  >
                    CALL {Math.min(callAmount, userSeat?.stack ?? 0).toLocaleString()}
                  </Button>
                )}

                <div className="flex-1 flex items-center gap-2 px-3 bg-slate-950/70 rounded-md border border-amber-700/50">
                  <span className="text-amber-300 text-[10px] font-bold">RAISE</span>
                  <Slider
                    value={[effectiveRaise]}
                    min={minRaise}
                    max={maxRaise}
                    step={50}
                    onValueChange={(v) => setRaiseAmount(v[0])}
                    className="flex-1"
                  />
                  <span className="text-amber-100 text-xs font-bold tabular-nums min-w-[60px] text-right">
                    {effectiveRaise.toLocaleString()}
                  </span>
                </div>

                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-amber-950 border border-amber-300 font-bold"
                  onClick={() => submitUserAction("raise", effectiveRaise)}
                  disabled={maxRaise <= minRaise}
                >
                  RAISE
                </Button>

                <Button
                  variant="default"
                  className="bg-rose-600 hover:bg-rose-500 text-amber-100 border border-rose-300 font-bold"
                  onClick={() => submitUserAction("allin", userSeat?.stack ?? 0)}
                >
                  ALL-IN
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-amber-800/40 rounded-xl px-4 py-2 backdrop-blur-sm">
              <div className="text-amber-200/70 text-xs text-center">
                {isDealing
                  ? "◆ 카드를 딜링하는 중..."
                  : winnerInfo
                  ? `★ ${winnerInfo.name} 님의 승리!`
                  : showdownReveal
                  ? "◆ 쇼다운 — 승자 판정 중..."
                  : activeSeatId >= 0
                  ? `${seats[activeSeatId]?.name} 님이 고민하는 중...`
                  : "◆ 다음 핸드 준비 중..."}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI 학습 패널 */}
      <TrainingPanel
        stats={trainingStats}
        onSetMode={setTrainingMode}
        onToggle={toggleTraining}
        onReset={resetTraining}
      />

      {/* 좌측 로그 패널 - 상단 좌측 모서리 (HUD 아래) */}
      <div className="absolute top-28 left-2 w-56 max-h-[28vh] z-20 hidden md:block">
        <div className="bg-slate-950/90 border border-amber-800/60 rounded-lg p-2 backdrop-blur-sm">
          <div className="text-amber-400 text-[9px] font-bold tracking-wider mb-1 px-1 flex items-center justify-between">
            <span>◆ BATTLE LOG</span>
            <span className="text-amber-700/60 text-[8px]">{log.length}</span>
          </div>
          <div className="overflow-y-auto max-h-[24vh] custom-scroll text-[10px] font-mono leading-relaxed space-y-0.5">
            {log.length === 0 && (
              <div className="text-slate-500 italic">대기 중...</div>
            )}
            {log.slice(-12).reverse().map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.tone === "system" ? "text-amber-200/80"
                  : entry.tone === "action" ? "text-slate-300"
                  : entry.tone === "win" ? "text-amber-300 font-bold"
                  : "text-rose-300"
                }
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 우측 페르소나 패널 - 상단 우측 모서리 (Training panel 아래) */}
      <div className="absolute top-28 right-2 w-52 z-20 hidden lg:block">
        <div className="bg-slate-950/90 border border-amber-800/60 rounded-lg p-2 backdrop-blur-sm">
          <div className="text-amber-400 text-[9px] font-bold tracking-wider mb-1 px-1">◆ PLAYERS</div>
          <div className="space-y-0.5 max-h-[24vh] overflow-y-auto custom-scroll">
            {seats.map((s) => (
              <div
                key={s.seatId}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                  activeSeatId === s.seatId ? "bg-amber-900/40 ring-1 ring-amber-500" : ""
                } ${s.folded ? "opacity-40" : ""}`}
              >
                <span className="text-sm">{s.isUser ? "⚔️" : s.persona?.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold truncate ${s.isUser ? "text-blue-300" : s.persona?.accent}`}>
                    {s.name}
                  </div>
                </div>
                <div className="text-amber-200 tabular-nums font-bold text-[9px]">
                  {s.stack > 999 ? `${(s.stack/1000).toFixed(1)}k` : s.stack}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(217,119,6,0.5); border-radius: 2px; }
      `}</style>
    </div>
  );
}
