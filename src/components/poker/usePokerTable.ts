"use client";
import {humanHitHint} from '@/lib/poker-postflop-support';
import {OpponentModel} from "@/lib/poker-opponent-model";
import {minimumRaiseTo} from "@/lib/poker-sizing";
/* eslint-disable react-hooks/immutability -- The imperative game loop and trainer expose mutable objects; callbacks run after render. */
import { LIVE_RULES, handPositions, postBlind, normalizeLiveAction, applyLiveAction, decideLiveBot } from "@/lib/poker-live";
import {allowHumanDefense} from '@/lib/poker-human-defense';
import { BluffAggression, successfulBluff, bluffTaunt } from "@/lib/poker-bluff";
import { settleHand, bettingLocked, hasBettingOpponent, dealNextStreet, WinnerInfo } from "@/lib/poker-rules";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeDeck,
  Card,
  SeatState,
  Phase,
  ActionType,
  evaluateBestHand,
  scoreToCategoryName,
} from "@/lib/poker-engine";
import { RPG_BOT_POOL, BotPersona, getStrategyForHand, applyStrategyToPersona, STRATEGY_PROFILES, StrategyType, getExitMessage } from "@/lib/personas";
import { SelfPlayTrainer, TrainingStats } from "@/lib/self-play-trainer";

const NUM_SEATS = LIVE_RULES.seats;
const SMALL_BLIND = LIVE_RULES.smallBlind;
const BIG_BLIND = LIVE_RULES.bigBlind;
const DEFAULT_BUYIN = LIVE_RULES.buyIn;

export interface LogEntry {
  id: number;
  text: string;
  tone: "system" | "action" | "win" | "taunt";
}

// 내부 전체 게임 상태 (ref로 관리, 동기적 접근)
interface ShowdownHandInfo {
  seatId: number;
  name: string;
  handCategory: string;
  isWinner: boolean;
  isUser: boolean;
}

interface GameState {
  seats: SeatState[];
  board: Card[];
  pot: number;
  phase: Phase;
  handNumber: number;
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  preflopStart: number;
  postflopStart: number;
  rebuyPending: boolean;
  activeSeatId: number;
  lastActions: Record<number, string>;
  showdownReveal: boolean;
  lastAggression: BluffAggression | null;
  lastStreetAggressor: number | null;
  bluffReveal: number | null;
  showdownHands: ShowdownHandInfo[];
  winnerInfo: WinnerInfo | null;
  isDealing: boolean;
  awaitingUser: boolean;
  handAborted: boolean;
  playerBusted: boolean; // ★ 플레이어 파산 시 퇴장 모달
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  deck: Card[];
  raiseLevel: number; // 현재 라운드 레이즈 횟수 (3-bet, 4-bet 추적)
  lastRaiseSize: number; // ★ 마지막 레이즈 크기 (표준 NLHE min-raise 계산용)
  userTimer: number; // 유저 결정 타이머 (남은 초, 0=시간 없음)
}

interface UseTableOpts {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

export function usePokerTable({ userName, onToast }: UseTableOpts) {
  const trainer = getGlobalTrainer();
  const opponentModel=useRef(new OpponentModel());
  const opponentKey=(s:SeatState)=>s.isUser?'human:user':`cpu:${s.seatId}:${s.persona?.id||s.name}`;

  const [trainingStats, setTrainingStats] = useState<TrainingStats>(trainer.stats);

  useEffect(() => {
    trainer.onStatsUpdate = (s) => {
      setTrainingStats({ ...s });
    };
    // 마운트 시 학습 자동 시작
    trainer.start();
    return () => {
      trainer.onStatsUpdate = undefined;
    };
  }, [trainer]);

  const [renderState, setRenderState] = useState<GameState>(() => ({
    seats: initSeats(userName),
    board: [],
    pot: 0,
    phase: "PREFLOP",
    handNumber: 1,
    buttonSeat: 0,
    smallBlindSeat: 1,
    bigBlindSeat: 2,
    preflopStart: 3,
    postflopStart: 1,
    rebuyPending: false,
    activeSeatId: -1,
    lastActions: {},
    showdownReveal: false,
    lastAggression: null,
    lastStreetAggressor: null,
    bluffReveal: null,
    winnerInfo: null,
    isDealing: false,
    awaitingUser: false,
    handAborted: false,
    playerBusted: false,
    callAmount: 0,
    minRaise: BIG_BLIND,
    maxRaise: 0,
    deck: [],
    raiseLevel: 0,
    lastRaiseSize: BIG_BLIND, // ★ 초기값은 BB 크기
    userTimer: 0,
    showdownHands: [],
  }));
  const stateRef = useRef(renderState);
  // Publish a snapshot; rendering never reads a mutable ref directly.
  const tick = useCallback(() => {
    const st=stateRef.current;
    setRenderState({...st, seats:st.seats.map(seat=>({...seat})), board:[...st.board], lastActions:{...st.lastActions}});
  }, []);

  // ★ 사전 액션 큐 (Pre-action queue)
  // - 내 차례가 오기 전에 폴드/콜을 미리 선택 가능
  // - 취소 가능
  // - 레이즈 발생 시 '콜'은 자동 취소 (다시 선택해야 함)
  // - '폴드'는 레이즈가 와도 그대로 유지 (폴드는 폴드니까)
  const [preAction, setPreAction] = useState<{
    type: "fold" | "call" | "check";
    amount: number;
  } | null>(null);
  // ref로도 관리 (베팅 라운드에서 접근하기 위함)
  const preActionRef = useRef<typeof preAction>(null);
  useEffect(() => { preActionRef.current = preAction; }, [preAction]);

  // 사전 액션 설정/취소
  const setPreActionQ = useCallback((action: {
    type: "fold" | "call" | "check";
    amount: number;
  } | null) => {
    setPreAction(action);
  }, []);

  // ★ 레이즈 발생 시 '콜/체크' 사전 액션 자동 취소 (폴드는 유지)
  const cancelCallPreActionOnRaise = useCallback(() => {
    const pa = preActionRef.current;
    if (pa && (pa.type === "call" || pa.type === "check")) {
      setPreAction(null);
    }
  }, []);

  // 사전 액션 자동 실행 (내 차례가 되었을 때)
  useEffect(() => {
    const st = stateRef.current;
    // 내 차례이고 사전 액션이 있고 아직 처리 안 된 경우
    if (st.awaitingUser
        && st.activeSeatId === userSeatId
        && preAction
        && pendingUserAction.current) {
      // 사전 액션이 유효한지 검증
      const callAmt = st.callAmount;
      let validAction: { action: ActionType; amount: number } | null = null;

      if (preAction.type === "fold" && callAmt > 0) {
        // 폴드는 콜 비용이 있을 때만 의미
        validAction = { action: "fold", amount: 0 };
      } else if (preAction.type === "call" && callAmt > 0) {
        // 콜은 콜 비용이 있을 때
        validAction = { action: "call", amount: Math.min(callAmt, st.seats[userSeatId]?.stack ?? 0) };
      } else if (preAction.type === "check" && callAmt === 0) {
        // 체크는 콜 비용이 없을 때
        validAction = { action: "check", amount: 0 };
      }

      if (validAction) {
        const actionToSubmit = validAction;
        setPreAction(null); // 실행 후 큐에서 제거
        // 약간의 딜레이 후 실행 (UI 반영을 위해)
        setTimeout(() => {
          if (pendingUserAction.current) {
            pendingUserAction.current(actionToSubmit);
            pendingUserAction.current = null;
          }
        }, 200);
      } else {
        // 유효하지 않으면 사전 액션 취소
        setPreAction(null);
      }
    }
  }, [renderState.awaitingUser, renderState.activeSeatId, preAction]);

  const [log, setLog] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const pushLog = useCallback((text: string, tone: LogEntry["tone"] = "system") => {
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog((prev) => [...prev.slice(-50), { id, text, tone }]);
  }, []);

  const pendingUserAction = useRef<((d: { action: ActionType; amount: number }) => void) | null>(null);

  const userSeatId = renderState.seats.find((s) => s.isUser)?.seatId ?? 0;

  // =====================
  // 핸드 시작
  // =====================
  const startHand = useCallback(async () => {
    const st = stateRef.current;
    st.isDealing = true;
    st.handAborted = false;
    st.showdownReveal = false;
    st.lastAggression = null; st.lastStreetAggressor = null;
    st.bluffReveal = null;
    st.winnerInfo = null;
    st.board = [];
    st.pot = 0;
    st.phase = "PREFLOP";
    st.lastActions = {};
    st.deck = makeDeck();
    if (st.rebuyPending) {
      const mine = st.seats.find(s => s.isUser)!;
      mine.stack = DEFAULT_BUYIN;
      st.rebuyPending = false;
      st.playerBusted = false;
    }
    st.handNumber = st.handNumber; // 핸드 번호는 아래에서 증가
    tick();

    // 좌석 리셋 (파산 봇 리필, 100k 달성 봇 퇴장, 홀카드 비움)
    const usedNames = new Set<string>();
    st.seats.forEach((s) => {
      if (!s.isUser) usedNames.add(s.name);
    });
    st.seats = st.seats.map((s) => {
      let persona = s.persona;
      let name = s.name;
      // ★ AI가 100k 달성 시 퇴장 + 새 AI 입장
      if (s.isBot && s.stack >= LIVE_RULES.botCashOut) {
        const exitMsg = getExitMessage(s.persona!, true);
        pushLog(exitMsg, "system");
        onToast?.(exitMsg, "info");
        usedNames.delete(name);
        const avail = RPG_BOT_POOL.filter(p => !usedNames.has(p.name));
        const newP = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : RPG_BOT_POOL[Math.floor(Math.random() * RPG_BOT_POOL.length)];
        persona = newP;
        name = newP.name;
        usedNames.add(name);
        pushLog(`🔄 [${newP.name}]님이 새로 입장했습니다! (${DEFAULT_BUYIN.toLocaleString()} 칩)`, "system");
      }
      // ★ AI 파산 시 새 AI 입장 (기존 로직)
      else if (s.isBot && s.stack < BIG_BLIND * 2) {
        const exitMsg = getExitMessage(s.persona!, false);
        pushLog(exitMsg, "system");
        usedNames.delete(name);
        const avail = RPG_BOT_POOL.filter(p => !usedNames.has(p.name));
        const newP = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : RPG_BOT_POOL[Math.floor(Math.random() * RPG_BOT_POOL.length)];
        persona = newP;
        name = newP.name;
        usedNames.add(name);
        pushLog(`🔄 [${newP.name}]님이 새로 입장했습니다! (${DEFAULT_BUYIN.toLocaleString()} 칩)`, "system");
      }
      const newStack = (s.isBot && (s.stack < BIG_BLIND * 2 || s.stack >= LIVE_RULES.botCashOut)) ? DEFAULT_BUYIN : s.stack;
      // ★ 플레이어 파산 체크
      if (s.isUser && s.stack < BIG_BLIND) {
        st.playerBusted = true;
      }
      return {
        ...s,
        persona,
        name,
        stack: newStack,
        currentBet: 0,
        totalBet: 0,
        inHand: newStack >= BIG_BLIND,
        folded: false,
        allIn: false,
        holeCards: [],
        hasActed: false,
        lastAction: undefined,
      };
    });

    const positions = handPositions(st.seats, st.buttonSeat);
    st.buttonSeat = positions.button;
    st.smallBlindSeat = positions.smallBlind;
    st.bigBlindSeat = positions.bigBlind;
    st.preflopStart = positions.preflopStart;
    st.postflopStart = positions.postflopStart;
    const btnSeat = st.buttonSeat;
    pushLog(`─── 핸드 #${st.handNumber} 시작 (BTN: ${st.seats[btnSeat]?.name}) ───`, "system");
    st.seats[positions.smallBlind] = postBlind(st.seats[positions.smallBlind], SMALL_BLIND);
    st.seats[positions.bigBlind] = postBlind(st.seats[positions.bigBlind], BIG_BLIND);
    pushLog(`${st.seats[positions.smallBlind].name}: SB ${SMALL_BLIND}`, "system");
    pushLog(`${st.seats[positions.bigBlind].name}: BB ${BIG_BLIND}`, "system");
    tick();

    await sleep(500);

    // 홀카드
    st.seats = st.seats.map((s) => {
      if (!s.inHand) return s;
      const c1 = st.deck.pop()!;
      const c2 = st.deck.pop()!;
      return { ...s, holeCards: [c1, c2] };
    });
    tick();
    await sleep(400);

    st.isDealing = false;
    tick();

    // 프리플랍 베팅 (UTG부터)
    await runBettingRound("PREFLOP", btnSeat, (st.preflopStart - btnSeat + NUM_SEATS) % NUM_SEATS);

    // 다음 페이즈
    await advancePhase(btnSeat);

    st.handNumber += 1;
    tick();

    // 다음 핸드
    await sleep(1500);
    startHand();
  }, [pushLog, tick, onToast]);

  // =====================
  // 베팅 라운드
  // =====================
  const runBettingRound = useCallback(async (currentPhase: Phase, btnSeat: number, startOffset: number) => {
    const st = stateRef.current;
    st.phase = currentPhase;
    st.raiseLevel = 0; // 라운드 시작마다 리셋
    st.lastRaiseSize = BIG_BLIND; // ★ 라운드 시작마다 BB로 리셋 (표준 NLHE)
    // hasActed 리셋
    st.seats = st.seats.map(s => ({ ...s, hasActed: false }));
    st.lastActions = {};
    tick();
    await sleep(300);

    let safetyCounter = 0;
    const checkedThisStreet = new Set<number>();
    const limpedPreflop = new Set<number>();
    const openedPreflop = new Set<number>();
    const previousStreetAggressor = st.lastStreetAggressor;
    let currentStreetAggressor: number | null = null;
    let lastActorIdx = -1; // 직전 액터 (턴 순서 추적용)
    while (safetyCounter < LIVE_RULES.maxActions) {
      safetyCounter++;
      const aliveInHand = st.seats.filter(s => s.inHand && !s.folded);
      if (aliveInHand.length <= 1 || bettingLocked(st.seats)) break;

      const notAllIn = aliveInHand.filter(s => !s.allIn);
      if (notAllIn.length === 0) break;

      const maxBet = Math.max(...aliveInHand.map(s => s.currentBet));
      const needsAction = notAllIn.filter(s => !s.hasActed || s.currentBet < maxBet);
      if (needsAction.length === 0) break;

      // 다음 액터: 직전 액터의 다음 좌석부터 시계방향으로 검색
      // (레이즈 시 테이블을 한 바퀴 돌도록 보장)
      let actorIdx = -1;
      const startSearchFrom = lastActorIdx === -1
        ? (btnSeat + startOffset) % NUM_SEATS
        : (lastActorIdx + 1) % NUM_SEATS;

      for (let i = 0; i < NUM_SEATS; i++) {
        const idx = (startSearchFrom + i) % NUM_SEATS;
        const s = st.seats[idx];
        if (s && s.inHand && !s.folded && !s.allIn && (!s.hasActed || s.currentBet < maxBet)) {
          actorIdx = idx;
          break;
        }
      }
      if (actorIdx === -1) break;

      lastActorIdx = actorIdx;
      const actor = st.seats[actorIdx];
      st.activeSeatId = actorIdx;
      const callAmt = Math.max(0, maxBet - actor.currentBet);
      st.callAmount = callAmt;
      // Table house rule: every full raise is at least 2x the highest street total.
      const minR = minimumRaiseTo(maxBet,BIG_BLIND);
      const maxR = hasBettingOpponent(st.seats, actor.seatId) ? actor.stack + actor.currentBet : maxBet;
      st.minRaise = minR;
      st.maxRaise = maxR;
      tick();

      let decision: { action: ActionType; amount: number; isBluff?: boolean };

      if (actor.isUser) {
        st.awaitingUser = true;
        st.userTimer = LIVE_RULES.userSeconds; // 10초 타이머
        tick();
        decision = await waitForUserActionWithTimer(st, tick);
        st.awaitingUser = false;
        st.userTimer = 0;
        tick();
      } else {
        await sleep(LIVE_RULES.botThinkMin + Math.random() * LIVE_RULES.botThinkJitter);
        decision = decideLiveBot(trainer, {
          actor, seats: st.seats, board: st.board, pot: st.pot,
          minRaise: minR, maxRaise: maxR, button: st.buttonSeat,
          smallBlind: st.smallBlindSeat, bigBlind: st.bigBlindSeat,
          hand: st.handNumber, raiseLevel: st.raiseLevel,
          checkedThisStreet: checkedThisStreet.has(actor.seatId),
        humanHitHint:()=>humanHitHint(st.seats,st.board,st.lastAggression?.seatId),
          allowHumanCall:()=>allowHumanDefense({seats:st.seats,actorId:actor.seatId,
            humanId:st.lastAggression?.seatId,board:st.board,raiseLevel:st.raiseLevel}),
          lastRaiserSeat:st.lastAggression?.seatId,
          threeBetRead:st.lastAggression ? opponentModel.current.read(opponentKey(st.seats[st.lastAggression.seatId])) : undefined,
          limpedPreflop: limpedPreflop.has(actor.seatId), previousStreetAggressor,
          openedPreflop: openedPreflop.has(actor.seatId),
        });
      }
      const raiseLevelBefore=st.raiseLevel;
      const intendedBluff = !actor.isUser && decision.isBluff === true;
      decision = normalizeLiveAction(st.seats, actor.seatId, decision, st.lastRaiseSize)
        ?? { action: callAmt === 0 ? "check" : "fold", amount: 0 };

      // raiseLevel 추적 + 다른 플레이어 hasActed 리셋 (올바른 포커 룰)
      const raisesBet=decision.action === "raise" || (decision.action === "allin" && actor.currentBet + actor.stack > maxBet);
      if (raisesBet) {
        st.raiseLevel += 1;
        // ★ lastRaiseSize 업데이트 (표준 NLHE min-raise 계산용)
        // 레이즈 크기 = 새 베팅 총액 - 이전 최대 베팅
        const oldMaxBet = maxBet;
        const newBetTotal = decision.action === "allin"
          ? actor.currentBet + actor.stack  // 올인이면 현재 베팅 + 스택
          : decision.amount;                // 레이즈면 목표 금액
        const raiseSize = newBetTotal - oldMaxBet;
        if (raiseSize > st.lastRaiseSize) {
          st.lastRaiseSize = raiseSize; // 더 큰 레이즈가 오면 업데이트 (작은 레이즈는 무시)
        }
        // 레이즈가 발생하면 다른 모든 생존 플레이어가 다시 행동해야 함
        // (단, 레이즈한 본인은 hasActed=true 유지)
        for (let i = 0; i < st.seats.length; i++) {
          if (i !== actorIdx && st.seats[i].inHand && !st.seats[i].folded && !st.seats[i].allIn) {
            st.seats[i].hasActed = false;
          }
        }
        // ★ 레이즈 발생 시 유저의 '콜/체크' 사전 액션 자동 취소 (폴드는 유지)
        cancelCallPreActionOnRaise();
      }

      // 액션 적용 (직접 ref 수정)
      applyActionToState(st, actorIdx, decision);
      if(st.board.length===0)opponentModel.current.observe(opponentKey(actor),st.handNumber,raiseLevelBefore,callAmt,raisesBet);
      if(st.board.length===0&&decision.action==="call"&&maxBet<=BIG_BLIND&&st.raiseLevel===0)limpedPreflop.add(actor.seatId);
      if (decision.action === "check") checkedThisStreet.add(actor.seatId);
      else checkedThisStreet.delete(actor.seatId);
      if (st.seats[actorIdx].currentBet > maxBet && (decision.action === "raise" || decision.action === "allin")) {
        st.lastAggression = { seatId: actor.seatId, isBluff: intendedBluff };
        currentStreetAggressor = actor.seatId;
        if(st.board.length===0&&st.raiseLevel===1)openedPreflop.add(actor.seatId);
      }
      const actionLabel = labelAction(decision.action, decision.amount, callAmt);
      st.lastActions = { ...st.lastActions, [actorIdx]: actionLabel };
      pushLog(`${actor.name}: ${actionLabel}`, "action");

      tick();
      await sleep(800);

      const stillAlive = st.seats.filter(s => s.inHand && !s.folded);
      if (stillAlive.length <= 1) break;
    }

    const remaining = st.seats.filter(seat => seat.inHand && !seat.folded);
    const highBet = Math.max(0, ...remaining.map(seat => seat.currentBet));
    if (remaining.length > 1 && !bettingLocked(st.seats) && remaining.some(seat => !seat.allIn && (!seat.hasActed || seat.currentBet < highBet))) {
      st.seats = st.seats.map(seat => ({ ...seat, stack: seat.stack + seat.totalBet, totalBet: 0, currentBet: 0 }));
      st.pot = 0; st.handAborted = true; st.activeSeatId = -1;
      st.lastAggression = null; st.lastStreetAggressor = null; st.bluffReveal = null;
      pushLog("핸드 오류로 베팅을 반환하고 새 핸드를 시작합니다.", "system");
      tick(); return;
    }

    st.activeSeatId = -1;
    st.lastActions = {};
    tick();

    st.lastStreetAggressor = currentStreetAggressor;

    // 베팅 팟으로 합산
    let potAdd = 0;
    st.seats = st.seats.map(s => {
      potAdd += s.currentBet;
      return { ...s, currentBet: 0, hasActed: false };
    });
    st.pot += potAdd;
    tick();
    await sleep(400);
  }, [pushLog, tick, onToast, trainer, cancelCallPreActionOnRaise]);

  // =====================
  // 페이즈 진행
  // =====================
  const advancePhase = useCallback(async (btnSeat: number) => {
    const st = stateRef.current;
    if (st.handAborted) return;
    const alive = st.seats.filter(s => s.inHand && !s.folded);

    if (alive.length <= 1) {
      // 한 명 남아서 승리
      await finishHand(false);
      return;
    }

    if (bettingLocked(st.seats)) {
      st.activeSeatId = -1; st.awaitingUser = false; st.userTimer = 0;
      st.callAmount = st.minRaise = st.maxRaise = 0;
      while (st.board.length < 5) {
        const next = dealNextStreet(st.board, st.deck);
        st.board = next.board; st.phase = next.phase;
        pushLog(`◆ ${next.phase}: ${st.board.map(cardLabel).join(" ")}`, "system");
        tick(); await sleep(800);
      }
      await doShowdown(btnSeat);
      return;
    }

    if (st.phase === "PREFLOP") {
      const next = dealNextStreet(st.board, st.deck);
      const flop = next.board;
      st.board = next.board;
      pushLog(`◆ FLOP: ${flop.map(cardLabel).join("  ")}`, "system");
      tick();
      await runBettingRound("FLOP", btnSeat, (st.postflopStart - btnSeat + NUM_SEATS) % NUM_SEATS);
      await advancePhase(btnSeat);
    } else if (st.phase === "FLOP") {
      const next = dealNextStreet(st.board, st.deck);
      const turn = next.board[3];
      st.board = next.board;
      pushLog(`◆ TURN: ${cardLabel(turn)}`, "system");
      tick();
      await runBettingRound("TURN", btnSeat, (st.postflopStart - btnSeat + NUM_SEATS) % NUM_SEATS);
      await advancePhase(btnSeat);
    } else if (st.phase === "TURN") {
      const next = dealNextStreet(st.board, st.deck);
      const river = next.board[4];
      st.board = next.board;
      pushLog(`◆ RIVER: ${cardLabel(river)}`, "system");
      tick();
      await runBettingRound("RIVER", btnSeat, (st.postflopStart - btnSeat + NUM_SEATS) % NUM_SEATS);
      await advancePhase(btnSeat);
    } else if (st.phase === "RIVER") {
      await doShowdown(btnSeat);
    }
  }, [pushLog, tick, runBettingRound]);

  // =====================
  // 쇼다운
  // =====================
  const doShowdown = useCallback(async (btnSeat: number) => {
    const st = stateRef.current;
    st.showdownReveal = true;
    st.phase = "SHOWDOWN";
    tick();
    await sleep(1500); // 카드 공개 후 1.5초 대기 (유저가 카드 보게)

    // 정확한 7카드 평가기로 승자 결정
    const contenders = st.seats.filter(s => s.inHand && !s.folded);
    const winningSeatIds = new Set(settleHand(st.seats, st.board, st.buttonSeat).pots.flatMap(p=>p.winnerSeatIds));

    // 각 콘텐더의 족보 카테고리 추출 (UI 표시용)
    st.showdownHands = contenders.map((c, i) => {
      const score = evaluateBestHand(c.holeCards, st.board);
      return {
        seatId: c.seatId,
        name: c.name,
        handCategory: scoreToCategoryName(score),
        isWinner: winningSeatIds.has(c.seatId),
        isUser: c.isUser,
      };
    });
    tick();
    await sleep(500); // 족보 표시 후 잠시 대기

    await finishHand(true);
  }, [tick]);

  const finishHand = useCallback(async (isShowdown: boolean) => {
    const st = stateRef.current;
    st.bluffReveal = successfulBluff(st.seats, st.lastAggression, isShowdown);
    if (st.bluffReveal !== null) {
      const message = bluffTaunt(st.seats[st.bluffReveal].name);
      pushLog(message, "taunt");
      onToast?.(message, "info");
    }
    const settlement = settleHand(st.seats, st.board, st.buttonSeat);
    const winners = settlement.results.filter(r=>r.award>0);
    st.seats = st.seats.map(seat=>({...seat, stack:seat.stack+settlement.results.find(r=>r.seatId===seat.seatId)!.payout}));
    const hand = isShowdown && winners[0]
      ? scoreToCategoryName(evaluateBestHand(st.seats[winners[0].seatId].holeCards,st.board))
      : "기본 승 (모두 폴드)";
    st.winnerInfo = { name:winners.map(r=>r.name).join(", "), amount:settlement.totalAward, hand,
      rake:settlement.totalRake, results:settlement.results };
    for(const result of winners) pushLog(`★ ${result.name}: 순수익 ${result.netProfit>=0?"+":""}${result.netProfit.toLocaleString()} 칩`,"win");
    pushLog(`◆ 레이크 ${settlement.totalRake.toLocaleString()} 칩 (5%)`,"system");
    const mine=settlement.results.find(r=>r.seatId===userSeatId);
    if(mine && mine.award>0) onToast?.(`순수익 ${mine.netProfit>=0?"+":""}${mine.netProfit.toLocaleString()} 칩`,mine.netProfit>0?"win":"info");
    st.pot=0;
    st.seats=st.seats.map(seat=>({...seat,currentBet:0,totalBet:0}));

    tick();

    // 결과를 5초간 유지 (유저가 충분히 볼 수 있게)
    await sleep(LIVE_RULES.resultPause);
    st.winnerInfo = null;
    st.showdownReveal = false;
    st.lastAggression = null; st.lastStreetAggressor = null;
    st.bluffReveal = null;
    st.showdownHands = [];
    tick();
  }, [pushLog, tick, onToast]);

  // =====================
  // 유틸
  // =====================
  function waitForUserAction(): Promise<{ action: ActionType; amount: number }> {
    return new Promise((resolve) => {
      pendingUserAction.current = resolve;
    });
  }

  // 10초 타이머付き 유저 액션 대기
  // 시간 초과 시: 체크 가능하면 체크, 아니면 폴드
  function waitForUserActionWithTimer(
    st: GameState,
    tickFn: () => void
  ): Promise<{ action: ActionType; amount: number }> {
    return new Promise((resolve) => {
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      // 사용자가 직접 액션을 제출했을 때 호출될 래퍼
      const wrappedResolve = (action: { action: ActionType; amount: number }) => {
        cleanup();
        resolve(action);
      };
      pendingUserAction.current = wrappedResolve;

      // 1초마다 타이머 감소
      intervalId = setInterval(() => {
        st.userTimer = Math.max(0, st.userTimer - 1);
        tickFn();
        if (st.userTimer <= 0) {
          cleanup();
          // 타임아웃: 자동 액션
          if (pendingUserAction.current) {
            const callAmt = st.callAmount;
            const autoAction = callAmt === 0
              ? { action: "check" as ActionType, amount: 0 }
              : { action: "fold" as ActionType, amount: 0 };
            pushLog(`⏱ 시간 초과! 자동 ${autoAction.action.toUpperCase()}`, "system");
            pendingUserAction.current = null;
            resolve(autoAction);
          }
        }
      }, 1000);
    });
  }

  const submitUserAction = useCallback((action: ActionType, amount: number) => {
    if (pendingUserAction.current) {
      pendingUserAction.current({ action, amount });
      pendingUserAction.current = null;
    }
  }, []);

  // 시작
  useEffect(() => {
    const t = setTimeout(() => {
      startHand();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  const st = renderState;
  return {
    seats: st.seats,
    board: st.board,
    pot: st.pot,
    phase: st.phase,
    handNumber: st.handNumber,
    buttonSeat: st.buttonSeat,
    activeSeatId: st.activeSeatId,
    lastActions: st.lastActions,
    smallBlindSeat: st.smallBlindSeat,
    bigBlindSeat: st.bigBlindSeat,
    showdownReveal: st.showdownReveal,
    bluffReveal: st.bluffReveal,
    showdownHands: st.showdownHands,
    winnerInfo: st.winnerInfo,
    log,
    isDealing: st.isDealing,
    awaitingUser: st.awaitingUser,
    callAmount: st.callAmount,
    minRaise: st.minRaise,
    maxRaise: st.maxRaise,
    userSeatId,
    submitUserAction,
    userTimer: st.userTimer,
    playerBusted: st.playerBusted,
    dismissBust: () => {
      const st = stateRef.current;
      st.playerBusted = false;
      st.rebuyPending = true;
      pushLog(`💰 다음 핸드에 ${DEFAULT_BUYIN.toLocaleString()} 칩으로 리바인합니다.`, "system");
      tick();
    },
    preAction,
    setPreActionQ,
    currentStrategy: getStrategyForHand(st.handNumber),
    trainingStats,
    setTrainingMode: (mode: "HEURISTIC" | "NEURAL" | "HYBRID") => trainer.setMode(mode),
    resetTraining: () => trainer.resetTraining(),
    toggleTraining: () => {
      if (trainer.stats.isRunning) trainer.stop();
      else trainer.start();
    },
  };
}

// =====================
// 싱글톤 트레이너 (모든 훅 인스턴스가 공유)
// =====================
let _globalTrainer: SelfPlayTrainer | null = null;
function getGlobalTrainer(): SelfPlayTrainer {
  if (!_globalTrainer) {
    _globalTrainer = new SelfPlayTrainer();
  }
  return _globalTrainer;
}

// =====================
// 헬퍼 (모듈 레벨)
// =====================
function initSeats(userName: string): SeatState[] {
  const personas: BotPersona[] = [...RPG_BOT_POOL].sort(() => Math.random() - 0.5).slice(0, 7);
  const arr: SeatState[] = [];
  const userSeatId = 0; // 하단 중앙 (유저)
  for (let i = 0; i < NUM_SEATS; i++) {
    if (i === userSeatId) {
      arr.push({
        seatId: i,
        name: userName,
        isBot: false,
        isUser: true,
        stack: DEFAULT_BUYIN,
        currentBet: 0,
        totalBet: 0,
        inHand: true,
        folded: false,
        allIn: false,
        holeCards: [],
        hasActed: false,
      });
    } else {
      const pIdx = i < userSeatId ? i : i - 1;
      const p = personas[pIdx];
      arr.push({
        seatId: i,
        name: p.name,
        isBot: true,
        isUser: false,
        persona: p,
        stack: DEFAULT_BUYIN,
        currentBet: 0,
        totalBet: 0,
        inHand: true,
        folded: false,
        allIn: false,
        holeCards: [],
        hasActed: false,
      });
    }
  }
  return arr;
}

function applyActionToState(st: GameState, seatId: number, decision: { action: ActionType; amount: number }) {
  st.seats[seatId] = applyLiveAction(st.seats[seatId], decision);
}

function labelAction(action: ActionType, amount: number, callAmt: number): string {
  switch (action) {
    case "fold": return "FOLD";
    case "check": return "CHECK";
    case "call": return `CALL ${amount.toLocaleString()}`;
    case "raise": return `RAISE ${amount.toLocaleString()}`;
    case "allin": return `ALL-IN ${amount.toLocaleString()}`;
  }
}

function cardLabel(c: Card): string {
  const r = c.rank === "T" ? "10" : c.rank;
  return `${r}${c.suit}`;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
