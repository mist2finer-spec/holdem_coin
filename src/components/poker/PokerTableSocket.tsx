"use client";
import { useState } from "react";
import { usePokerSocket } from "./usePokerSocket";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrainingPanel } from "./TrainingPanel";
import { Card } from "@/lib/poker-engine";
import { STRATEGY_PROFILES, StrategyType } from "@/lib/personas";
import { SelfPlayTrainer, TrainingStats } from "@/lib/self-play-trainer";

interface Props {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

function clampRaise(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(value, max));
}

// 글로벌 트레이너 (학습 통계 표시용)
let _globalTrainer: SelfPlayTrainer | null = null;
function getGlobalTrainer(): SelfPlayTrainer {
  if (!_globalTrainer) _globalTrainer = new SelfPlayTrainer();
  return _globalTrainer;
}

const phaseLabel: Record<string, string> = {
  "PREFLOP": "PRE-FLOP",
  "FLOP": "FLOP",
  "TURN": "TURN",
  "RIVER": "RIVER",
  "SHOWDOWN": "SHOWDOWN",
};

export function PokerTableSocket({ userName, onToast }: Props) {
  const {
    connected,
    log,
    preAction,
    setPreActionQ,
    submitUserAction,
    rotatedSeats,
    rotatedActiveSeatId,
    rotatedButtonSeat,
    userHandCategory,
    currentStrategy,
    livePot,
    callAmount,
    minRaise,
    maxRaise,
    isUserTurn,
    handInProgress,
    phase,
    handNumber,
    boardCards,
    showdownHands,
    winnerInfo,
    showdownReveal,
    mySeatId,
    myPlayerId,
    myName,
  } = usePokerSocket({ userName, onToast });

  const [raiseAmount, setRaiseAmount] = useState(0);
  const [trainingStats, setTrainingStats] = useState<TrainingStats>(getGlobalTrainer().stats);

  // 트레이너 학습 시작 (UI 표시용)
  useState(() => {
    const trainer = getGlobalTrainer();
    trainer.onStatsUpdate = (s) => setTrainingStats({ ...s });
    trainer.start();
  });

  const effectiveRaise = Math.max(minRaise, Math.min(raiseAmount || minRaise, maxRaise));

  // 보드 카드 문자열 → Card 변환
  const board: Card[] = boardCards.map(s => ({ rank: s[0], suit: s[1] }));

  // 유저 시트 찾기
  const userSeat = rotatedSeats.find(s => s.isMe);

  // 연결 대기 화면
  if (!connected) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-amber-200">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">🎰 RPG 홀덤 여관</div>
          <div className="text-sm">서버에 연결 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950">
      {/* 배경 장식 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 15% 25%, rgba(255,140,40,0.4) 0%, transparent 8%),
                            radial-gradient(circle at 85% 25%, rgba(255,140,40,0.4) 0%, transparent 8%),
                            radial-gradient(circle at 50% 95%, rgba(60,40,20,0.5) 0%, transparent 30%)`
        }}
      />

      {/* ★ 좌측 상단: 내 고유 ID/이름 표시 */}
      {myName && (
        <div className="absolute top-1 left-2 z-30 bg-blue-950/90 border border-blue-500 rounded-full px-3 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-blue-300 text-[9px] font-bold">👤</span>
          <span className="text-blue-100 text-[10px] font-bold ml-1">{myName}</span>
          {myPlayerId && (
            <span className="text-blue-400/60 text-[8px] ml-1">({myPlayerId})</span>
          )}
        </div>
      )}

      {/* 상단 HUD */}
      <div className="absolute top-1 right-2 z-30 flex items-center gap-1.5">
        <div className="bg-amber-950/90 border border-amber-600 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-amber-300 text-[9px] font-bold">H#</span>
          <span className="text-amber-100 text-[11px] font-bold ml-1 tabular-nums">{handNumber}</span>
        </div>
        <div className="bg-amber-950/90 border border-amber-600 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-amber-100 text-[11px] font-bold">{phaseLabel[phase] || phase}</span>
        </div>
        <div className="bg-rose-950/90 border border-rose-500 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-rose-200 text-[9px] font-bold">POT</span>
          <span className="text-amber-200 text-[11px] font-bold ml-1 tabular-nums">{livePot.toLocaleString()}</span>
        </div>
        {/* AI 전략 표시 */}
        <div
          className={`bg-gradient-to-r ${STRATEGY_PROFILES[currentStrategy as StrategyType].color} border border-amber-300 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg`}
          title={`AI 전략: ${STRATEGY_PROFILES[currentStrategy as StrategyType].name}`}
        >
          <span className="text-[10px]">{STRATEGY_PROFILES[currentStrategy as StrategyType].emoji}</span>
          <span className="text-amber-50 text-[10px] font-bold ml-1">
            {STRATEGY_PROFILES[currentStrategy as StrategyType].name}
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div className="absolute inset-0 flex items-center justify-center pt-12 pb-32 sm:pb-28">
        <div className="relative w-[min(98vw,1100px)] h-[min(72vh,640px)] sm:h-[min(85vh,640px)]">
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-2 sm:inset-3 rounded-[50%] bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] border-2 border-amber-700/40" />

          {/* 보드 카드 */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 z-10">
            {board.length === 0 && (
              <div className="text-amber-700/30 text-[10px] sm:text-xs italic">카드 대기중...</div>
            )}
            {board.map((c, i) => (
              <div key={i}>
                <PlayingCard card={c} size="md" />
              </div>
            ))}
          </div>

          {/* 팟 표시 */}
          {livePot > 0 && (
            <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-slate-950/85 border-2 border-amber-500/70 rounded-full px-3 py-1 sm:px-5 sm:py-1.5 backdrop-blur-sm shadow-lg">
                <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold tracking-wider">◈ POT</span>
                <span className="text-amber-100 text-sm sm:text-base font-bold ml-1 sm:ml-2 tabular-nums">{livePot.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* 승자 표시 */}
          {winnerInfo && (
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-30">
              <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg border-2 border-amber-200 shadow-2xl">
                <div className="text-amber-950 text-[9px] sm:text-[10px] font-bold tracking-widest text-center">
                  {winnerInfo.hand && winnerInfo.hand.startsWith("Split") ? "🤝 SPLIT POT 🤝" : "★ WINNER ★"}
                </div>
                <div className="text-amber-950 text-base sm:text-lg font-bold text-center">{winnerInfo.name}</div>
                <div className="text-amber-900 text-[10px] sm:text-xs font-bold text-center tabular-nums">
                  +{winnerInfo.amount.toLocaleString()} 칩
                  {winnerInfo.hand && <span className="ml-1 sm:ml-2">[{winnerInfo.hand}]</span>}
                </div>
              </div>
            </div>
          )}

          {/* 쇼다운 핸드 카테고리 패널 */}
          {showdownReveal && showdownHands.length > 0 && (
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20">
              <div className="bg-slate-950/95 border-2 border-amber-600/70 rounded-lg p-1.5 sm:p-2 shadow-2xl backdrop-blur-md max-w-[90vw]">
                <div className="text-amber-300 text-[9px] sm:text-[10px] font-bold tracking-wider mb-1 text-center">
                  ◆ SHOWDOWN — 핸드 족보 ◆
                </div>
                <div className="space-y-0.5">
                  {showdownHands.map((h, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs ${
                        h.isWinner
                          ? "bg-amber-900/50 border border-amber-400"
                          : "bg-slate-900/50 border border-slate-700/40"
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{h.isUser ? "⚔️" : "🎭"}</span>
                      <span className={`font-bold truncate min-w-[50px] sm:min-w-[70px] ${h.isUser ? "text-blue-300" : "text-amber-200"}`}>
                        {h.name}
                      </span>
                      <span className={`font-bold ml-auto ${h.isWinner ? "text-amber-300" : "text-slate-400"}`}>
                        {h.handCategory}
                      </span>
                      {h.isWinner && <span className="text-amber-400 text-[10px]">★</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8개 좌석 (시점 회전 적용) */}
          {rotatedSeats.map((seat, i) => (
            <SocketPlayerSeat
              key={i}
              seat={seat}
              isActive={rotatedActiveSeatId === i}
              isDealer={rotatedButtonSeat === i}
              isSmallBlind={(rotatedButtonSeat + 1) % 8 === i}
              isBigBlind={(rotatedButtonSeat + 2) % 8 === i}
              showCards={showdownReveal}
              position={seat.position}
            />
          ))}
        </div>
      </div>

      {/* ★ 핸드 진행 중 입장 메시지 (뒤에 들어온 플레이어에게만) */}
      {handInProgress && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="bg-slate-950/95 border-2 border-amber-500 rounded-xl px-6 py-3 shadow-2xl backdrop-blur-md text-center">
            <div className="text-amber-300 text-sm font-bold mb-1">⏳ 핸드 진행 중</div>
            <div className="text-amber-200/80 text-xs">현재 핸드 #{handNumber}이(가) 진행 중입니다.</div>
            <div className="text-amber-200/80 text-xs">다음 핸드부터 참여할 수 있습니다.</div>
          </div>
        </div>
      )}

      {/* 하단 액션 패널 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-1.5 sm:p-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          {isUserTurn ? (
            <div className="bg-slate-900/95 border-2 border-amber-600 rounded-xl p-2 sm:p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="text-amber-200 text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2">
                  ⚔️ 내 차례
                  {userHandCategory && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-900/70 border border-emerald-500/60 text-emerald-200 text-[9px] sm:text-[10px] font-bold">
                      내 핸드: {userHandCategory}
                    </span>
                  )}
                </div>
                <div className="text-amber-300 text-[10px] sm:text-xs">
                  콜: <span className="font-bold tabular-nums">{callAmount.toLocaleString()}</span>
                  {" / "}
                  잔고: <span className="font-bold tabular-nums">{userSeat?.stack.toLocaleString()}</span>
                </div>
              </div>

              {/* 5개 메인 액션 버튼 */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="destructive"
                  className="bg-rose-800 hover:bg-rose-700 text-rose-50 border border-rose-500 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => submitUserAction("fold", 0)}
                >
                  FOLD
                </Button>

                {callAmount === 0 ? (
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 border border-emerald-400 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                    onClick={() => submitUserAction("check", 0)}
                  >
                    CHECK
                  </Button>
                ) : (
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 border border-emerald-400 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                    onClick={() => submitUserAction("call", Math.min(callAmount, userSeat?.stack ?? 0))}
                  >
                    CALL {Math.min(callAmount, userSeat?.stack ?? 0).toLocaleString()}
                  </Button>
                )}

                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-amber-950 border border-amber-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => {
                    const baseTo = callAmount > 0
                      ? ((userSeat?.currentBet ?? 0) + callAmount) * 2.2
                      : (minRaise + livePot * 0.6);
                    const target = clampRaise(minRaise, maxRaise, Math.floor(baseTo));
                    submitUserAction("raise", target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title="스탠다드 리레이즈 (2.2x)"
                >
                  RAISE
                </Button>

                <Button
                  className="bg-orange-600 hover:bg-orange-500 text-orange-50 border border-orange-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => {
                    const target = clampRaise(minRaise, maxRaise, Math.floor(minRaise + livePot));
                    submitUserAction("raise", target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title="팟 리레이즈 (3-Bet)"
                >
                  3-BET
                </Button>

                <Button
                  variant="default"
                  className="bg-rose-600 hover:bg-rose-500 text-amber-100 border border-rose-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => submitUserAction("allin", userSeat?.stack ?? 0)}
                >
                  ALL-IN
                </Button>
              </div>

              {/* 커스텀 레이즈 슬라이더 */}
              <div className="flex items-center gap-1 sm:gap-2 mt-1.5">
                <span className="text-amber-300 text-[8px] sm:text-[9px] font-bold">CUSTOM:</span>
                <div className="flex-1 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 bg-slate-950/70 rounded-md border border-amber-700/50 h-7 sm:h-9">
                  <Slider
                    value={[effectiveRaise]}
                    min={minRaise}
                    max={maxRaise}
                    step={50}
                    onValueChange={(v) => setRaiseAmount(v[0])}
                    className="flex-1"
                  />
                  <span className="text-amber-100 text-[10px] sm:text-xs font-bold tabular-nums min-w-[50px] sm:min-w-[60px] text-right">
                    {effectiveRaise.toLocaleString()}
                  </span>
                </div>
                <Button
                  className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-400 font-bold h-7 sm:h-9 px-2 sm:px-3 text-[10px] sm:text-xs"
                  onClick={() => submitUserAction("raise", effectiveRaise)}
                  disabled={maxRaise <= minRaise}
                >
                  입력
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-amber-800/40 rounded-xl px-3 py-2 backdrop-blur-sm">
              <div className="text-amber-200/70 text-[10px] sm:text-xs text-center flex items-center justify-center gap-2 flex-wrap">
                <span>
                  {phase === "SHOWDOWN"
                    ? "◆ 쇼다운 — 승자 판정 중..."
                    : rotatedActiveSeatId >= 0 && rotatedSeats[rotatedActiveSeatId]
                    ? `${rotatedSeats[rotatedActiveSeatId].name} 님이 고민하는 중...`
                    : "◆ 다음 핸드 준비 중..."}
                </span>
                {userHandCategory && !winnerInfo && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-900/70 border border-emerald-500/60 text-emerald-200 text-[9px] sm:text-[10px] font-bold">
                    내 핸드: {userHandCategory}
                  </span>
                )}
              </div>

              {/* 사전 액션 큐 */}
              {!winnerInfo && !showdownReveal && rotatedActiveSeatId >= 0 && rotatedActiveSeatId !== 0 && mySeatId >= 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-amber-800/30">
                  {preAction ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-amber-300 text-[10px] sm:text-xs font-bold">
                        ✓ 사전 액션: <span className="text-amber-100">
                          {preAction.type === "fold" ? "FOLD" : preAction.type === "call" ? `CALL ${preAction.amount.toLocaleString()}` : "CHECK"}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 px-2 text-[9px] sm:text-[10px] border-rose-700/50 text-rose-200 hover:bg-rose-900/40"
                        onClick={() => setPreActionQ(null)}
                      >
                        ✕ 취소
                      </Button>
                      <span className="text-amber-200/40 text-[9px] hidden sm:inline">
                        {preAction.type === "fold" ? "(레이즈 와도 유지)" : "(레이즈 오면 자동 취소)"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-amber-200/50 text-[9px] sm:text-[10px] font-bold mr-1">사전 선택:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] border-rose-700/50 text-rose-200 hover:bg-rose-900/40"
                        onClick={() => setPreActionQ({ type: "fold", amount: 0 })}
                      >
                        폴드 예약
                      </Button>
                      {callAmount > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/40"
                          onClick={() => setPreActionQ({
                            type: "call",
                            amount: Math.min(callAmount, userSeat?.stack ?? 0)
                          })}
                        >
                          콜 예약 ({Math.min(callAmount, userSeat?.stack ?? 0).toLocaleString()})
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/40"
                          onClick={() => setPreActionQ({ type: "check", amount: 0 })}
                        >
                          체크 예약
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI 학습 패널 */}
      <TrainingPanel
        stats={trainingStats}
        onSetMode={(m) => getGlobalTrainer().setMode(m)}
        onToggle={() => {
          if (trainingStats.isRunning) getGlobalTrainer().stop();
          else getGlobalTrainer().start();
        }}
        onReset={() => getGlobalTrainer().resetTraining()}
      />

      {/* 좌측 로그 패널 */}
      <div className="absolute top-28 left-2 w-56 max-h-[28vh] z-20 hidden md:block">
        <div className="bg-slate-950/90 border border-amber-800/60 rounded-lg p-2 backdrop-blur-sm">
          <div className="text-amber-400 text-[9px] font-bold tracking-wider mb-1 px-1 flex items-center justify-between">
            <span>◆ BATTLE LOG</span>
            <span className="text-amber-700/60 text-[8px]">{log.length}</span>
          </div>
          <div className="overflow-y-auto max-h-[24vh] custom-scroll text-[10px] font-mono leading-relaxed space-y-0.5">
            {log.length === 0 && <div className="text-slate-500 italic">대기 중...</div>}
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

      <style jsx>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(217,119,6,0.5); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ============================================================
// 소켓 기반 PlayerSeat 래퍼
// ============================================================
interface SocketPlayerSeatProps {
  seat: {
    seatId: number;
    name: string;
    isBot: boolean;
    isMe: boolean;
    stack: number;
    currentBet: number;
    inHand: boolean;
    folded: boolean;
    allIn: boolean;
    holeCards: string[];
    position: { top: string; left: string };
  };
  isActive: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCards: boolean;
  position: { top: string; left: string };
}

function SocketPlayerSeat({
  seat,
  isActive,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCards,
  position,
}: SocketPlayerSeatProps) {
  // 문자열 홀카드를 Card 객체로 변환
  const holeCards: Card[] = seat.holeCards
    .filter(s => s !== "??")
    .map(s => ({ rank: s[0], suit: s[1] }));

  // isMe이면 실제 카드, 아니면 마스킹
  const displayCards = seat.isMe ? holeCards : (seat.holeCards[0] === "??" ? [] : holeCards);
  const isHidden = !seat.isMe && !showCards && seat.holeCards.length > 0 && seat.holeCards[0] === "??";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex flex-col items-center gap-1">
        {/* 홀카드 */}
        <div className="flex gap-0.5 h-8 sm:h-12 items-center">
          {displayCards.length === 2 && !seat.folded ? (
            <>
              <PlayingCard card={displayCards[0]} size="sm" />
              <PlayingCard card={displayCards[1]} size="sm" />
            </>
          ) : (isHidden || (seat.holeCards.length > 0 && !seat.folded && !seat.isMe && !showCards)) ? (
            <>
              <PlayingCard hidden size="sm" />
              <PlayingCard hidden size="sm" />
            </>
          ) : (
            <div className="w-12 sm:w-16 h-8 sm:h-12" />
          )}
        </div>

        {/* 아바타 프레임 */}
        <div
          className={`relative rounded-lg p-[2px] shadow-xl ${
            seat.isMe
              ? "bg-gradient-to-br from-blue-700 to-indigo-900"
              : "bg-gradient-to-br from-slate-700 to-slate-900"
          } ${isActive ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-emerald-950 animate-pulse" : ""} ${seat.folded ? "opacity-30 grayscale" : ""}`}
        >
          <div className="bg-slate-950/60 rounded-md p-0.5 sm:p-1 flex items-center justify-center">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-md flex items-center justify-center text-lg sm:text-2xl ${seat.isMe ? "bg-blue-900/50" : "bg-slate-800/50"}`}>
              {seat.isMe ? "⚔️" : seat.isBot ? "🤖" : "🎮"}
            </div>
          </div>

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
        </div>

        {/* 이름표 */}
        <div className={`bg-slate-950/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 sm:px-2 border ${seat.isMe ? "border-blue-500/50" : "border-amber-900/50"} min-w-[70px] sm:min-w-[90px] text-center`}>
          <div className={`text-[9px] sm:text-[11px] font-bold leading-tight truncate max-w-[80px] sm:max-w-[100px] ${seat.isMe ? "text-blue-300" : "text-amber-200"}`}>
            {seat.name}
          </div>
        </div>

        {/* 스택 */}
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
      </div>
    </div>
  );
}
