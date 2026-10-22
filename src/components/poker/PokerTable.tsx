"use client";
import "./poker-layout.css";
import { useState, useMemo } from "react";
import {PokerActionButtons} from "./PokerActionButtons";
import { LIVE_RULES } from "@/lib/poker-live";
import { usePokerTable } from "./usePokerTable";
import { PlayerSeat } from "./PlayerSeat";
import { TableBet } from "./TableBet";
import {SEAT_POSITIONS} from "@/lib/poker-seat-view";
import { PlayingCard } from "./PlayingCard";
import {HandAwards} from "./HandAwards";
import {ShowdownResults} from "./ShowdownResults";
import { Button } from "@/components/ui/button";
import { TrainingPanel } from "./TrainingPanel";
import { evaluateBestHand, scoreToCategoryName } from "@/lib/poker-engine";

interface Props {
  onMain:()=>void;
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

export function PokerTable({ userName, onToast, onMain }: Props) {
  const {
    leaveTable,
    seats,
    board,
    pot,
    phase,
    handNumber,
    buttonSeat,
    activeSeatId,
    showdownReveal,
    bluffReveal,
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
    smallBlindSeat,
    bigBlindSeat,
    preAction,
    setPreActionQ,
    trainingStats,
    setTrainingMode,
    resetTraining,
    toggleTraining,
    playerBusted,
    dismissBust,
  } = usePokerTable({ userName, onToast });


  const userSeat = seats.find((s) => s.isUser);
  const isUserTurn = awaitingUser && activeSeatId === userSeatId;

  // 유저가 raise slider 조정 시 초기값

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
    <div className="poker-table-layout w-full relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950">
      <button className="poker-room-exit" onClick={()=>{leaveTable();onMain();}}>← 로비로</button>
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
      <div className="poker-arena relative min-h-0 flex items-center justify-center pt-20 pb-20 sm:pt-24 sm:pb-24">
        <div className="poker-table-surface relative w-[min(98vw,1100px)] h-full max-h-[640px]">
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
            <div className="poker-pot absolute top-[50%] text-amber-700/10 text-[60px] sm:text-[100px]">♣</div>
          </div>

          {/* 보드 카드 (중앙) */}
          <div className="poker-board absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 z-10">
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
            <div className="poker-pot absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-slate-950/85 border-2 border-amber-500/70 rounded-full px-3 py-1 sm:px-5 sm:py-1.5 backdrop-blur-sm shadow-lg">
                <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold tracking-wider">◈ POT</span>
                <span className="text-amber-100 text-sm sm:text-base font-bold ml-1 sm:ml-2 tabular-nums">{livePot.toLocaleString()}</span>
              </div>
            </div>
          )}

          {winnerInfo&&!showdownReveal&&<section className="poker-fold-result" aria-label="폴드 승리 결과"><HandAwards winnerInfo={winnerInfo}/></section>}

          {showdownReveal&&<ShowdownResults board={board} winnerInfo={winnerInfo} players={seats.map(s=>({
            seatId:s.seatId,name:s.name,portrait:s.isUser?4:s.persona?.portrait,holeCards:s.holeCards,inHand:s.inHand,folded:s.folded,
          }))}/>}

          {seats.map(seat => (
            <TableBet key={`bet-${seat.seatId}`} amount={seat.currentBet} name={seat.name} position={SEAT_POSITIONS[seat.seatId]} />
          ))}

          {/* 8개 좌석 */}
          {seats.map((seat) => (
            <PlayerSeat
              key={seat.seatId}
              seat={seat}
              isActive={activeSeatId === seat.seatId}
              isDealer={buttonSeat === seat.seatId}
              isSmallBlind={smallBlindSeat === seat.seatId}
              isBigBlind={bigBlindSeat === seat.seatId}
              showCards={showdownReveal || bluffReveal === seat.seatId}
              position={SEAT_POSITIONS[seat.seatId]}
            />
          ))}
        </div>
      </div>

      {/* 하단 액션 패널 (유저 전용) */}
      <div className="poker-action-area relative z-20 p-1.5 sm:p-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
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
                  style={{ width: `${(userTimer / LIVE_RULES.userSeconds) * 100}%` }}
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

              <PokerActionButtons currentBet={userSeat?.currentBet ?? 0} call={callAmount}
                stack={userSeat?.stack ?? 0} minRaise={minRaise} maxRaise={maxRaise}
                pot={livePot} onSubmit={submitUserAction} />


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
                        className="island-preaction h-10 px-3 text-[11px] bg-slate-950 border-rose-700/50 text-rose-200 hover:bg-rose-900/40"
                        onClick={() => setPreActionQ({ type: "fold", amount: 0 })}
                      >
                        폴드 예약
                      </Button>
                      {callAmount > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="island-preaction h-10 px-3 text-[11px] bg-slate-950 border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/40"
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
                          className="island-preaction h-10 px-3 text-[11px] bg-slate-950 border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/40"
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
            <div className="text-amber-300 text-xl font-black mb-2">참여할 칩이 부족합니다</div>
            <div className="text-amber-200/70 text-sm mb-6">
              다음에 또 오세요!<br/>
              리바인하면 다음 핸드에 5,000칩으로 참여합니다.
            </div>
            <Button
              onClick={dismissBust}
              className="bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black text-base py-3 px-8 border-2 border-amber-300 shadow-lg rounded-xl"
            >
              💰 리바인하기 (5,000칩)
            </Button>
            <Button variant="outline" className="mt-3 w-full border-amber-700 text-amber-100" onClick={onMain}>메인으로</Button>
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
