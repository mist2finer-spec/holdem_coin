"use client";
import { useState, useMemo } from "react";
import { usePokerTable } from "./usePokerTable";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrainingPanel } from "./TrainingPanel";
import { evaluateBestHand, scoreToCategoryName } from "@/lib/poker-engine";
import { STRATEGY_PROFILES, StrategyType } from "@/lib/personas";

interface Props {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

// 레이즈 금액을 min/max 범위로 클램프
function clampRaise(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(value, max));
}

// 8좌석 테이블 상대 위치 (% 단위)
// 0번 = 하단 중앙 (유저 자리), 시계 방향으로 배치
// 모바일에서도 화면 안에 들어오도록 여백 확보
const SEAT_POSITIONS = [
  { top: "90%", left: "50%" },  // 0: 하단 중앙 (유저)
  { top: "78%", left: "88%" },  // 1: 우하단
  { top: "45%", left: "93%" },  // 2: 우측
  { top: "14%", left: "82%" },  // 3: 우상단
  { top: "7%",  left: "50%" },  // 4: 상단 중앙
  { top: "14%", left: "18%" },  // 5: 좌상단
  { top: "45%", left: "7%"  },  // 6: 좌측
  { top: "78%", left: "12%" },  // 7: 좌하단
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
    showdownHands,
    winnerInfo,
    log,
    isDealing,
    awaitingUser,
    callAmount,
    minRaise,
    maxRaise,
    userSeatId,
    submitUserAction,
    userTimer,
    preAction,
    setPreActionQ,
    currentStrategy,
    trainingStats,
    setTrainingMode,
    resetTraining,
    toggleTraining,
    playerBusted,
    dismissBust,
  } = usePokerTable({ userName, onToast });

  const [raiseAmount, setRaiseAmount] = useState(0);

  const userSeat = seats.find((s) => s.isUser);
  const isUserTurn = awaitingUser && activeSeatId === userSeatId;

  // 유저가 raise slider 조정 시 초기값
  const effectiveRaise = Math.max(minRaise, Math.min(raiseAmount || minRaise, maxRaise));

  // 현재 팟 = 정산된 팟 + 진행 중인 베팅 합계
  const livePot = pot + seats.reduce((sum, s) => sum + s.currentBet, 0);

  // 유저의 현재 핸드 족보 (보드가 있을 때만)
  const userHandCategory = useMemo(() => {
    if (!userSeat || userSeat.holeCards.length < 2) return null;
    if (board.length < 3) return null; // 프리플랩은 족보 없음
    const score = evaluateBestHand(userSeat.holeCards, board);
    return scoreToCategoryName(score);
  }, [userSeat, board]);

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
        {/* ★ AI 전략 표시 (5핸드마다 로테이션) */}
        <div
          className={`bg-gradient-to-r ${STRATEGY_PROFILES[currentStrategy as StrategyType].color} border border-amber-300 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg`}
          title={`AI 전략: ${STRATEGY_PROFILES[currentStrategy as StrategyType].name} - ${STRATEGY_PROFILES[currentStrategy as StrategyType].description}`}
        >
          <span className="text-[10px]">{STRATEGY_PROFILES[currentStrategy as StrategyType].emoji}</span>
          <span className="text-amber-50 text-[10px] font-bold ml-1">
            {STRATEGY_PROFILES[currentStrategy as StrategyType].name}
          </span>
        </div>
      </div>

      {/* 테이블 (타원형) */}
      <div className="absolute inset-0 flex items-center justify-center pt-12 pb-32 sm:pb-28">
        <div className="relative w-[min(98vw,1100px)] h-[min(72vh,640px)] sm:h-[min(85vh,640px)]">
          {/* 테이블 외곽 (나무 테두리) */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-2 sm:inset-3 rounded-[50%] bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] border-2 border-amber-700/40" />

          {/* 테이블 중앙 패턴 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-amber-700/10 text-[100px] sm:text-[180px] font-bold">♠</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden sm:block">
            <div className="absolute top-[35%] text-rose-800/10 text-[60px] sm:text-[100px] -translate-x-32">♥</div>
            <div className="absolute top-[35%] text-rose-800/10 text-[60px] sm:text-[100px] translate-x-32">♦</div>
            <div className="absolute top-[60%] text-amber-700/10 text-[60px] sm:text-[100px]">♣</div>
          </div>

          {/* 보드 카드 (중앙) */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 z-10">
            {board.length === 0 && (
              <div className="text-amber-700/30 text-[10px] sm:text-xs italic">카드 대기중...</div>
            )}
            {board.map((c, i) => (
              <div key={i} className="animate-[fadeIn_0.4s_ease-out]">
                <PlayingCard card={c} size="md" />
              </div>
            ))}
          </div>

          {/* 팟 표시 (중앙 하단) */}
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
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-30 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg border-2 border-amber-200 shadow-2xl">
                <div className="text-amber-950 text-[9px] sm:text-[10px] font-bold tracking-widest text-center">
                  {winnerInfo.hand && winnerInfo.hand.startsWith("Split") ? "🤝 SPLIT POT 🤝" : "★ WINNER ★"}
                </div>
                <div className="text-amber-950 text-base sm:text-lg font-bold text-center">{winnerInfo.name}</div>
                <div className="text-amber-900 text-[10px] sm:text-xs font-bold text-center tabular-nums">
                  {winnerInfo.results.filter(r=>r.award>0).map(r=>(
                    <div key={r.seatId}>{r.name}: 순수익 {r.netProfit>=0?"+":""}{r.netProfit.toLocaleString()} 칩</div>
                  ))}
                  <div className="text-[9px]">레이크 {winnerInfo.rake.toLocaleString()} 칩 (5%)</div>
                  {winnerInfo.hand && <span className="ml-1 sm:ml-2">[{winnerInfo.hand}]</span>}
                </div>
              </div>
            </div>
          )}

          {/* 쇼다운 핸드 카테고리 패널 (각 콘텐더의 족보 표시) */}
          {showdownReveal && showdownHands.length > 0 && (
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-slate-950/95 border-2 border-amber-600/70 rounded-lg p-1.5 sm:p-2 shadow-2xl backdrop-blur-md max-w-[90vw]">
                <div className="text-amber-300 text-[9px] sm:text-[10px] font-bold tracking-wider mb-1 text-center">
                  ◆ SHOWDOWN — 핸드 족보 ◆
                </div>
                <div className="space-y-0.5">
                  {showdownHands.map((h) => (
                    <div
                      key={h.seatId}
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
      <div className="absolute bottom-0 left-0 right-0 z-20 p-1.5 sm:p-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          {isUserTurn ? (
            <div className="bg-slate-900/95 border-2 border-amber-600 rounded-xl p-2 sm:p-3 shadow-2xl backdrop-blur-md">
              {/* ★ 타이머 애니메이션 바 */}
              <div className="mb-1.5 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    userTimer <= 3
                      ? "bg-gradient-to-r from-rose-600 to-rose-400"
                      : userTimer <= 6
                      ? "bg-gradient-to-r from-amber-600 to-amber-400"
                      : "bg-gradient-to-r from-emerald-700 to-emerald-400"
                  }`}
                  style={{ width: `${(userTimer / 10) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="text-amber-200 text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2">
                  ⚔️ 차례
                  {/* 10초 타이머 숫자 */}
                  <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full font-bold text-xs sm:text-sm tabular-nums border-2 ${
                    userTimer <= 3
                      ? "bg-rose-700 text-amber-100 border-rose-300 animate-pulse"
                      : userTimer <= 6
                      ? "bg-amber-700 text-amber-50 border-amber-300"
                      : "bg-emerald-800 text-emerald-50 border-emerald-400"
                  }`}>
                    {userTimer}
                  </span>
                  {/* 유저 현재 핸드 족보 표시 */}
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

              {/* 5개 메인 액션 버튼 (Python 5-action 시스템과 매칭) */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* 0: FOLD */}
                <Button
                  variant="destructive"
                  className="bg-rose-800 hover:bg-rose-700 text-rose-50 border border-rose-500 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => submitUserAction("fold", 0)}
                >
                  FOLD
                </Button>

                {/* 1: CHECK_OR_CALL */}
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

                {/* 2: RAISE_STD (2.2x) */}
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-amber-950 border border-amber-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => {
                    // 2.2x 스탠다드 리레이즈
                    const baseTo = callAmount > 0
                      ? ((userSeat?.currentBet ?? 0) + callAmount) * 2.2
                      : (minRaise + livePot * 0.6);
                    const target = clampRaise(minRaise, maxRaise, Math.floor(baseTo));
                    submitUserAction("raise", target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`스탠다드 리레이즈 (2.2x)`}
                >
                  RAISE
                </Button>

                {/* 3: RERAISE_POT (3-Bet) */}
                <Button
                  className="bg-orange-600 hover:bg-orange-500 text-orange-50 border border-orange-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => {
                    // 팟 리레이즈 (3-Bet)
                    const target = clampRaise(minRaise, maxRaise, Math.floor(minRaise + livePot));
                    submitUserAction("raise", target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`팟 리레이즈 (3-Bet)`}
                >
                  3-BET
                </Button>

                {/* 4: ALL_IN */}
                <Button
                  variant="default"
                  className="bg-rose-600 hover:bg-rose-500 text-amber-100 border border-rose-300 font-bold h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-sm flex-1"
                  onClick={() => submitUserAction("allin", userSeat?.stack ?? 0)}
                >
                  ALL-IN
                </Button>
              </div>

              {/* 커스텀 레이즈 슬라이더 행 */}
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

              {/* 퀵 베팅 버튼 행 (1/3, 1/2, 3/4, 1:1 pot, Min) */}
              <div className="flex items-center gap-1 sm:gap-1.5 mt-1.5 sm:mt-2 flex-wrap">
                <span className="text-amber-300 text-[8px] sm:text-[9px] font-bold mr-0.5 sm:mr-1">QUICK:</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => {
                    const target = clampRaise(minRaise, maxRaise, callAmount + Math.floor(livePot * 1 / 3));
                    setRaiseAmount(target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`팟의 1/3 = ${Math.floor(livePot * 1 / 3).toLocaleString()}`}
                >
                  1/3
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => {
                    const target = clampRaise(minRaise, maxRaise, callAmount + Math.floor(livePot * 1 / 2));
                    setRaiseAmount(target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`팟의 1/2 = ${Math.floor(livePot * 1 / 2).toLocaleString()}`}
                >
                  1/2
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => {
                    const target = clampRaise(minRaise, maxRaise, callAmount + Math.floor(livePot * 3 / 4));
                    setRaiseAmount(target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`팟의 3/4 = ${Math.floor(livePot * 3 / 4).toLocaleString()}`}
                >
                  3/4
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => {
                    const target = clampRaise(minRaise, maxRaise, callAmount + livePot);
                    setRaiseAmount(target);
                  }}
                  disabled={maxRaise <= minRaise}
                  title={`팟의 1:1 = ${livePot.toLocaleString()}`}
                >
                  1:1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => setRaiseAmount(minRaise)}
                  disabled={maxRaise <= minRaise}
                  title={`최소 레이즈 = ${minRaise.toLocaleString()}`}
                >
                  Min
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] border-amber-700/50 text-amber-200 hover:bg-amber-900/40"
                  onClick={() => setRaiseAmount(maxRaise)}
                  disabled={maxRaise <= minRaise}
                  title={`올인 = ${maxRaise.toLocaleString()}`}
                >
                  Max
                </Button>
                <div className="ml-auto text-amber-200/60 text-[9px] sm:text-[10px] hidden sm:block">
                  팟: <span className="text-amber-200 font-bold tabular-nums">{livePot.toLocaleString()}</span>
                  {" · "}레이즈: <span className="text-amber-200 font-bold tabular-nums">{minRaise.toLocaleString()}~{maxRaise.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-amber-800/40 rounded-xl px-3 py-2 backdrop-blur-sm">
              <div className="text-amber-200/70 text-[10px] sm:text-xs text-center flex items-center justify-center gap-2 flex-wrap">
                <span>
                  {isDealing
                    ? "◆ 카드를 딜링하는 중..."
                    : winnerInfo
                    ? `★ ${winnerInfo.name} 님의 승리!`
                    : showdownReveal
                    ? "◆ 쇼다운 — 승자 판정 중..."
                    : activeSeatId >= 0
                    ? `${seats[activeSeatId]?.name} 님이 고민하는 중...`
                    : "◆ 다음 핸드 준비 중..."}
                </span>
                {userHandCategory && !winnerInfo && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-900/70 border border-emerald-500/60 text-emerald-200 text-[9px] sm:text-[10px] font-bold">
                    내 핸드: {userHandCategory}
                  </span>
                )}
              </div>

              {/* ★ 사전 액션 큐 (내 차례가 아닐 때 폴드/콜 미리 선택) */}
              {!isDealing && !winnerInfo && !showdownReveal && activeSeatId >= 0 && activeSeatId !== userSeatId && (
                <div className="mt-1.5 pt-1.5 border-t border-amber-800/30">
                  {preAction ? (
                    // 사전 액션이 예약된 상태
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
                        {preAction.type === "fold"
                          ? "(레이즈 와도 유지)"
                          : "(레이즈 오면 자동 취소)"}
                      </span>
                    </div>
                  ) : (
                    // 사전 액션 선택 가능
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

      {/* AI 학습 패널 - 숨김 (필요시 hidden 제거) */}
      <div className="hidden">
        <TrainingPanel
          stats={trainingStats}
          onSetMode={setTrainingMode}
          onToggle={toggleTraining}
          onReset={resetTraining}
        />
      </div>

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
            {log.slice(-12).map((entry) => (
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

      {/* ★ 플레이어 파산 모달 */}
      {playerBusted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900/95 border-2 border-amber-600 rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
            <div className="text-5xl mb-4">💔</div>
            <div className="text-amber-300 text-xl font-black mb-2">칩을 모두 잃었습니다</div>
            <div className="text-amber-200/70 text-sm mb-6">
              다음에 또 오세요!<br/>
              재접속 시 자동으로 20,000칩이 충전됩니다.
            </div>
            <Button
              onClick={dismissBust}
              className="bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black text-base py-3 px-8 border-2 border-amber-300 shadow-lg rounded-xl"
            >
              💰 리바인하기 (20,000칩)
            </Button>
          </div>
        </div>
      )}

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
