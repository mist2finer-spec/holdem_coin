"use client";
import {tournamentMoney,tournamentTime} from "@/lib/poker-tournament";
import {CharacterPortrait} from './CharacterPortrait';
import "./poker-layout.css";
import { useEffect, useRef, useState } from "react";
import {PokerActionButtons} from "./PokerActionButtons";
import { LIVE_RULES } from "@/lib/poker-live";
import { usePokerSocket } from "./usePokerSocket";
import { CLIENT_REVISION, useReleaseUpdate } from "./useReleaseUpdate";
import { IslandSeat } from "./IslandSeat";
import { TableBet } from "./TableBet";
import { PlayingCard } from "./PlayingCard";
import {HandAwards} from "./HandAwards";
import {ShowdownResults} from "./ShowdownResults";
import { Button } from "@/components/ui/button";
import { TrainingPanel } from "./TrainingPanel";
import { Card } from "@/lib/poker-engine";
import { SelfPlayTrainer, TrainingStats } from "@/lib/self-play-trainer";

interface Props {
  tournament?:boolean;
  onMain:()=>void;
  userName: string;
  tableSize?: 6 | 8;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
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

export function PokerTableSocket({ userName, onToast, tableSize=8, onMain,tournament=false }: Props) {
  const {
    tournamentState,clock,connected,
    historyCount,historyBusy,exportHistory,
    playerBusted,
    rebuyPending,
    requestRebuy,
    userTimer,
    rotatedSmallBlindSeat,
    rotatedBigBlindSeat,
    log,
    preAction,
    setPreActionQ,
    submitUserAction,
    rotatedSeats,
    rotatedActiveSeatId,
    rotatedButtonSeat,
    userHandCategory,
    livePot,
    callAmount,
    minRaise,
    maxRaise,
    isUserTurn,
    handInProgress,
    phase,
    handNumber,
    boardCards,
    winnerInfo,
    showdownReveal,
    bluffReveal,
    mySeatId,
    myPlayerId,
    myName,
  } = usePokerSocket({ userName, onToast, tableSize, onExit:onMain,tournament });
  const bb=tournamentState?.bigBlind??200;
  const bbMoney=(n:number)=>tournamentMoney(n,bb);
  const money=(n:number)=>tournamentState?bbMoney(n):n.toLocaleString();
  const [watchEliminated,setWatchEliminated]=useState(false);
  const eliminated=!!tournamentState&&rotatedSeats.some(s=>s.isMe&&s.eliminated);
  const nextSeconds=tournamentState?.nextLevelAt?Math.max(0,Math.ceil((tournamentState.nextLevelAt-clock)/1000)):300;
  const updateAvailable = useReleaseUpdate(connected);

  const logScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = logScrollRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [log]);

  const [trainingStats, setTrainingStats] = useState<TrainingStats>(getGlobalTrainer().stats);

  // 트레이너 학습 시작 (UI 표시용)
  useState(() => {
    const trainer = getGlobalTrainer();
    trainer.onStatsUpdate = (s) => setTrainingStats({ ...s });
    trainer.start();
  });


  // 보드 카드 문자열 → Card 변환
  const board: Card[] = boardCards.map(s => ({ rank: s[0] as Card["rank"], suit: s[1] as Card["suit"] }));

  // 유저 시트 찾기
  const userSeat = rotatedSeats.find(s => s.isMe);

  // 연결 대기 화면
  if (!connected) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-amber-200">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">🎰 Island Hold’em</div>
          <div className="text-sm">서버에 연결 중...</div>
          <Button className="mt-4" variant="outline" onClick={onMain}>← 로비로</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="poker-table-layout w-full relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950">
      <button className="poker-room-exit" onClick={onMain}>← 로비로</button>
      {updateAvailable && (
        <div role="status" className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-amber-500 bg-slate-950 px-4 py-2 text-sm text-amber-100 shadow-lg">
          <span>새 버전이 배포되었습니다. 진행 중인 핸드를 마친 뒤 화면을 업데이트하세요.</span>
          <Button size="sm" onClick={() => window.location.reload()}>화면 업데이트</Button>
        </div>
      )}
      <span className="absolute bottom-1 right-2 z-30 text-[9px] text-slate-400" title="현재 화면 버전">
        서버 · {CLIENT_REVISION.slice(0, 7)}
      </span>
      {tournamentState&&<>
        <div className="tournament-hud" aria-label="토너먼트 진행 시간과 블라인드">
          <span>{tournamentState.status==='countdown'?`시작까지 ${Math.max(0,Math.ceil(((tournamentState.startsAt??clock)-clock)/1000))}초`:tournamentState.status==='waiting'?'입장 대기':tournamentState.status==='finished'?'대회 종료':`진행시간: ${tournamentTime((clock-(tournamentState.startedAt??clock))/1000)}`}</span>
          <small>SB {tournamentState.smallBlind.toLocaleString()} / BB {bb.toLocaleString()}</small>
        </div>
      </>}
      {tournamentState?.winner&&<div className="tournament-finish" role="dialog" aria-modal="true" aria-label="토너먼트 우승"><section><span>TOURNAMENT CHAMPION</span><CharacterPortrait portrait={tournamentState.winner.portrait} name={tournamentState.winner.name}/><h1>{tournamentState.winner.name}</h1><h2>1위! 우승을 축하합니다!</h2><Button onClick={onMain}>로비로</Button></section></div>}
      {eliminated&&!watchEliminated&&!tournamentState?.winner&&<div className="tournament-finish" role="dialog" aria-modal="true" aria-label="토너먼트 탈락"><section><h2>토너먼트에서 탈락했습니다.</h2><p>리바인과 같은 이름의 재입장은 불가합니다.</p><Button onClick={()=>setWatchEliminated(true)}>계속 관전</Button><Button onClick={onMain}>로비로</Button></section></div>}
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
        <div className="poker-identity absolute top-1 left-2 z-30 bg-blue-950/90 border border-blue-500 rounded-full px-3 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-blue-300 text-[9px] font-bold">👤</span>
          <span className="text-blue-100 text-[10px] font-bold ml-1">{myName}</span>
          {myPlayerId && (
            <span className="hidden sm:inline text-blue-400/60 text-[8px] ml-1">({myPlayerId})</span>
          )}
        </div>
      )}

      {/* 상단 HUD */}
      <div className="poker-phase-hud absolute top-1 right-2 z-30" aria-label="현재 라운드">
        <div className="bg-amber-950/90 border border-amber-600 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-lg">
          <span className="text-amber-100 text-[11px] font-bold">{phaseLabel[phase] || phase}</span>
        </div>
      </div>

      <div className="absolute top-9 right-2 z-30 flex items-center gap-1 rounded bg-slate-950/90 px-1.5 py-1 text-[9px] text-amber-200">
        <span title="완료된 핸드를 브라우저에 자동 보관합니다. 서버와 브라우저 각각 최대 1,000핸드 / 16MB">기록 {historyCount}</span>
        <button disabled={historyBusy} onClick={()=>exportHistory('json')} className="px-1 underline disabled:opacity-40">JSON 저장</button>
        <button disabled={historyBusy} onClick={()=>exportHistory('csv')} className="px-1 underline disabled:opacity-40">CSV</button>
        <button disabled={historyBusy} onClick={()=>exportHistory('admin')} title="관리자 키 필요 · CPU 비공개 카드와 의사결정 분석 포함" className="px-1 text-slate-400 underline disabled:opacity-40">관리자 분석</button>
      </div>

      {/* 테이블 */}
      <div className="poker-arena relative min-h-0 flex items-center justify-center pt-20 pb-20 sm:pt-24 sm:pb-24">
      {tournamentState&&<div className="tournament-round" aria-label="토너먼트 라운드와 남은 시간"><span>Round {tournamentState.level}</span><span>Time left: {tournamentTime(nextSeconds)}</span></div>}

        <div className="poker-table-surface relative w-[min(98vw,1100px)] h-full max-h-[640px]">
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-2 sm:inset-3 rounded-[50%] bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] border-2 border-amber-700/40" />

          {/* 보드 카드 */}
          <div className="poker-board absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 z-10">
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
            <div className="poker-pot absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-slate-950/85 border-2 border-amber-500/70 rounded-full px-3 py-1 sm:px-5 sm:py-1.5 backdrop-blur-sm shadow-lg">
                <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold tracking-wider">◈ POT</span>
                <span className="text-amber-100 text-sm sm:text-base font-bold ml-1 sm:ml-2 tabular-nums">{money(livePot)}</span>
              </div>
            </div>
          )}

          {winnerInfo&&!showdownReveal&&<section className="poker-fold-result" aria-label="폴드 승리 결과"><HandAwards winnerInfo={winnerInfo} formatMoney={tournamentState?bbMoney:undefined} tournament={!!tournamentState}/></section>}

          {showdownReveal&&<ShowdownResults formatMoney={tournamentState?bbMoney:undefined} tournament={!!tournamentState} board={board} winnerInfo={winnerInfo} players={rotatedSeats.map(s=>({
            seatId:s.originalSeatId,name:s.name,portrait:s.isMe?4:s.portrait,
            holeCards:s.holeCards.filter(c=>c!=="??").map(c=>({rank:c[0] as Card["rank"],suit:c[1] as Card["suit"]})),
            inHand:s.inHand,folded:s.folded,
          }))}/>}

          {rotatedSeats.map(seat => (
            <TableBet key={`bet-${seat.seatId}`} amount={seat.currentBet} formatMoney={money} name={seat.name} position={seat.position} />
          ))}

          {/* 8개 좌석 (시점 회전 적용) */}
          {rotatedSeats.map((seat, i) => seat.eliminated?null:(
            <SocketPlayerSeat
              key={i}
              stackLabel={tournamentState?bbMoney(seat.stack):undefined}
              seat={seat}
              isActive={rotatedActiveSeatId === i}
              isDealer={rotatedButtonSeat === i}
              isSmallBlind={rotatedSmallBlindSeat === i}
              isBigBlind={rotatedBigBlindSeat === i}
              showCards={showdownReveal || bluffReveal === seat.originalSeatId}
              position={seat.position}
            />
          ))}
        </div>
      </div>

      {/* ★ 핸드 진행 중 입장 메시지 (뒤에 들어온 플레이어에게만) */}
      {handInProgress && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="poker-join-notice" role="status">⏳ 핸드 진행 중</div>
        </div>
      )}

      {/* 하단 액션 패널 */}
      <div className="poker-action-area relative z-20 p-1.5 sm:p-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          {isUserTurn ? (
            <div className="bg-slate-900/95 border-2 border-amber-600 rounded-xl p-2 sm:p-3 shadow-2xl backdrop-blur-md">
              <div className="h-1 rounded bg-slate-800 mb-2 overflow-hidden">
                <div className={userTimer <= 3 ? "h-full bg-red-500" : "h-full bg-amber-400"}
                  style={{ width: `${userTimer / LIVE_RULES.userSeconds * 100}%` }} />
              </div>
              <div className="text-amber-200 text-xs mb-1">결정 시간: {userTimer}초</div>
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
                  콜: <span className="font-bold tabular-nums">{money(callAmount)}</span>
                  {" / "}
                  잔고: <span className="font-bold tabular-nums">{tournamentState?bbMoney(userSeat?.stack??0):userSeat?.stack.toLocaleString()}</span>
                </div>
              </div>

              <PokerActionButtons key={tournamentState?bb:"cash"} currentBet={userSeat?.currentBet ?? 0} call={callAmount}
                stack={userSeat?.stack ?? 0} minRaise={minRaise} maxRaise={maxRaise}
                pot={livePot} formatMoney={money} bigBlind={tournamentState?bb:undefined} onSubmit={submitUserAction} />

              {/* 커스텀 레이즈 슬라이더 */}

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
                          {preAction.type === "fold" ? "FOLD" : preAction.type === "call" ? `CALL ${money(preAction.amount)}` : "CHECK"}
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
                          콜 예약 ({money(Math.min(callAmount, userSeat?.stack ?? 0))})
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

      {/* AI 학습 패널 - 싱글 모드와 동일하게 숨김 */}
      <div className="hidden">
      <TrainingPanel
        stats={trainingStats}
        onSetMode={(m) => getGlobalTrainer().setMode(m)}
        onToggle={() => {
          if (trainingStats.isRunning) getGlobalTrainer().stop();
          else getGlobalTrainer().start();
        }}
        onReset={() => getGlobalTrainer().resetTraining()}
      />
      </div>

      {/* 좌측 로그 패널 */}
      <div className="absolute top-28 left-2 w-56 max-h-[28vh] z-20 hidden md:block">
        <div className="bg-slate-950/90 border border-amber-800/60 rounded-lg p-2 backdrop-blur-sm">
          <div className="text-amber-400 text-[9px] font-bold tracking-wider mb-1 px-1 flex items-center justify-between">
            <span>◆ BATTLE LOG</span>
            <span className="text-amber-700/60 text-[8px]">{log.length}</span>
          </div>
          <div ref={logScrollRef} className="overflow-y-auto max-h-[24vh] custom-scroll text-[10px] font-mono leading-relaxed space-y-0.5">
            {log.length === 0 && <div className="text-slate-500 italic">대기 중...</div>}
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

      {playerBusted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-amber-600 rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-4xl mb-4">💔</div>
            <div className="text-amber-300 text-xl font-black mb-3">참여할 칩이 부족합니다</div>
            <p className="text-amber-200/70 text-sm mb-5">리바인하면 다음 핸드에 5,000칩으로 참여합니다.</p>
            <Button onClick={requestRebuy} disabled={rebuyPending}>
              {rebuyPending ? "다음 핸드 착석 대기 중…" : "💰 리바인하기 (5,000칩)"}
            </Button>
            <Button variant="outline" className="mt-3 w-full border-amber-700 text-amber-100" onClick={onMain}>메인으로</Button>
          </div>
        </div>
      )}

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
  stackLabel?:string;
  seat: {
    portrait?: number;
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
  seat,stackLabel,
  isActive,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCards,
  position,
}: SocketPlayerSeatProps) {
  // 문자열 홀카드를 Card 객체로 변환
  const holeCards: (Card|null)[] = seat.holeCards.map(s => s === "??" ? null : ({rank:s[0] as Card["rank"],suit:s[1] as Card["suit"]}));

  // ★ 카드 표시 로직:
  // - 본인(isMe): 폴드해도 카드 계속 보임 + 폴드 오버레이
  // - 다른 플레이어: 폴드 시 카드 숨김, 쇼다운 시 공개
  return <IslandSeat name={seat.name} stack={seat.stack} stackLabel={stackLabel} holeCards={holeCards}
    folded={seat.folded} isMe={seat.isMe} portrait={seat.isMe?4:seat.portrait}
    isActive={isActive} isDealer={isDealer} isSmallBlind={isSmallBlind} isBigBlind={isBigBlind}
    showCards={showCards} position={position}/>;
}
