"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeDeck,
  Card,
  SeatState,
  Phase,
  ActionType,
  handRankName,
  estimateStrength,
} from "@/lib/poker-engine";
import { RPG_BOT_POOL, BotPersona } from "@/lib/personas";
import { SelfPlayTrainer, TrainingStats } from "@/lib/self-play-trainer";

const NUM_SEATS = 8;
const SMALL_BLIND = 100;
const BIG_BLIND = 200;
const DEFAULT_BUYIN = 20000;

export interface LogEntry {
  id: number;
  text: string;
  tone: "system" | "action" | "win" | "taunt";
}

// 내부 전체 게임 상태 (ref로 관리, 동기적 접근)
interface GameState {
  seats: SeatState[];
  board: Card[];
  pot: number;
  phase: Phase;
  handNumber: number;
  buttonSeat: number;
  activeSeatId: number;
  lastActions: Record<number, string>;
  showdownReveal: boolean;
  winnerInfo: { seatId: number; name: string; amount: number; hand: string } | null;
  isDealing: boolean;
  awaitingUser: boolean;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  deck: Card[];
  raiseLevel: number; // 현재 라운드 레이즈 횟수 (3-bet, 4-bet 추적)
}

interface UseTableOpts {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

export function usePokerTable({ userName, onToast }: UseTableOpts) {
  // 싱글톤 트레이너 (외부에서 주입)
  const trainerRef = useRef<SelfPlayTrainer | null>(null);
  if (!trainerRef.current) {
    trainerRef.current = getGlobalTrainer();
  }
  const trainer = trainerRef.current;

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

  const stateRef = useRef<GameState>({
    seats: initSeats(userName),
    board: [],
    pot: 0,
    phase: "PREFLOP",
    handNumber: 1,
    buttonSeat: 0,
    activeSeatId: -1,
    lastActions: {},
    showdownReveal: false,
    winnerInfo: null,
    isDealing: false,
    awaitingUser: false,
    callAmount: 0,
    minRaise: BIG_BLIND,
    maxRaise: 0,
    deck: [],
    raiseLevel: 0,
  });

  const [, forceTick] = useState(0);
  const tick = useCallback(() => forceTick((n) => n + 1), []);

  const [log, setLog] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const pushLog = useCallback((text: string, tone: LogEntry["tone"] = "system") => {
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog((prev) => [...prev.slice(-50), { id, text, tone }]);
  }, []);

  const pendingUserAction = useRef<((d: { action: ActionType; amount: number }) => void) | null>(null);

  const userSeatId = stateRef.current.seats.find((s) => s.isUser)?.seatId ?? 0;

  // =====================
  // 핸드 시작
  // =====================
  const startHand = useCallback(async () => {
    const st = stateRef.current;
    st.isDealing = true;
    st.showdownReveal = false;
    st.winnerInfo = null;
    st.board = [];
    st.pot = 0;
    st.phase = "PREFLOP";
    st.lastActions = {};
    st.deck = makeDeck();
    st.buttonSeat = (st.buttonSeat + 1) % NUM_SEATS;
    st.handNumber = st.handNumber; // 핸드 번호는 아래에서 증가
    tick();

    // 좌석 리셋 (파산 봇 리필, 홀카드 비움)
    const usedNames = new Set<string>();
    st.seats.forEach((s) => {
      if (!s.isUser) usedNames.add(s.name);
    });
    st.seats = st.seats.map((s) => {
      let persona = s.persona;
      let name = s.name;
      if (s.isBot && s.stack < BIG_BLIND * 2) {
        usedNames.delete(name);
        const avail = RPG_BOT_POOL.filter(p => !usedNames.has(p.name));
        const newP = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : RPG_BOT_POOL[Math.floor(Math.random() * RPG_BOT_POOL.length)];
        persona = newP;
        name = newP.name;
        usedNames.add(name);
      }
      const newStack = s.stack < BIG_BLIND * 2 ? DEFAULT_BUYIN : s.stack;
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

    const btnSeat = st.buttonSeat;
    const sbSeat = (btnSeat + 1) % NUM_SEATS;
    const bbSeat = (btnSeat + 2) % NUM_SEATS;

    pushLog(`─── 핸드 #${st.handNumber} 시작 (BTN: ${st.seats[btnSeat]?.name}) ───`, "system");

    // 블라인드
    st.seats[sbSeat].currentBet = SMALL_BLIND;
    st.seats[sbSeat].totalBet = SMALL_BLIND;
    st.seats[sbSeat].stack -= SMALL_BLIND;
    st.seats[bbSeat].currentBet = BIG_BLIND;
    st.seats[bbSeat].totalBet = BIG_BLIND;
    st.seats[bbSeat].stack -= BIG_BLIND;
    pushLog(`${st.seats[sbSeat].name}: SB ${SMALL_BLIND}`, "system");
    pushLog(`${st.seats[bbSeat].name}: BB ${BIG_BLIND}`, "system");
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
    await runBettingRound("PREFLOP", btnSeat, 3);

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
    // hasActed 리셋
    st.seats = st.seats.map(s => ({ ...s, hasActed: false }));
    st.lastActions = {};
    tick();
    await sleep(300);

    let safetyCounter = 0;
    while (safetyCounter < 100) {
      safetyCounter++;
      const aliveInHand = st.seats.filter(s => s.inHand && !s.folded);
      if (aliveInHand.length <= 1) break;

      const notAllIn = aliveInHand.filter(s => !s.allIn);
      if (notAllIn.length === 0) break;

      const maxBet = Math.max(...aliveInHand.map(s => s.currentBet));
      const needsAction = notAllIn.filter(s => !s.hasActed || s.currentBet < maxBet);
      if (needsAction.length === 0) break;

      // 다음 액터 (startOffset 부터)
      let actorIdx = -1;
      for (let i = 0; i < NUM_SEATS; i++) {
        const idx = (btnSeat + startOffset + i) % NUM_SEATS;
        const s = st.seats[idx];
        if (s && s.inHand && !s.folded && !s.allIn && (!s.hasActed || s.currentBet < maxBet)) {
          actorIdx = idx;
          break;
        }
      }
      if (actorIdx === -1) break;

      const actor = st.seats[actorIdx];
      st.activeSeatId = actorIdx;
      const callAmt = Math.max(0, maxBet - actor.currentBet);
      st.callAmount = callAmt;
      const minR = maxBet === 0 ? BIG_BLIND : maxBet + BIG_BLIND;
      const maxR = actor.stack + actor.currentBet;
      st.minRaise = minR;
      st.maxRaise = maxR;
      tick();

      let decision: { action: ActionType; amount: number; isBluff?: boolean };

      if (actor.isUser) {
        st.awaitingUser = true;
        tick();
        decision = await waitForUserAction();
        st.awaitingUser = false;
      } else {
        await sleep(700 + Math.random() * 900);
        // 신경망 기반 의사결정 (트레이너 사용)
        const activeOpp = aliveInHand.length - 1;
        const persona = actor.persona || RPG_BOT_POOL[0];
        const livePot = st.pot + st.seats.reduce((a, s) => a + s.currentBet, 0);
        const nnDecision = trainer.decideActionForLive(
          st.seats[actorIdx].holeCards,
          st.board,
          callAmt,
          minR,
          maxR,
          livePot,
          actor.stack,
          actor.currentBet,
          activeOpp,
          actorIdx,
          NUM_SEATS,
          st.raiseLevel,
          { vpip: persona.vpip, aggression: persona.aggression, bluffFreq: persona.bluffFreq }
        );
        decision = mapNNActionToEngine(nnDecision, callAmt, actor.stack);
      }

      // raiseLevel 추적
      if (decision.action === "raise" || decision.action === "allin") {
        st.raiseLevel += 1;
      }

      // 액션 적용 (직접 ref 수정)
      applyActionToState(st, actorIdx, decision);
      const actionLabel = labelAction(decision.action, decision.amount, callAmt);
      st.lastActions = { ...st.lastActions, [actorIdx]: actionLabel };
      pushLog(`${actor.name}: ${actionLabel}${decision.isBluff ? "  ◆블러프!" : ""}`, "action");

      if (decision.isBluff && actor.persona) {
        onToast?.(`${actor.persona.emoji} ${actor.name}: "${actor.persona.taunt}"`, "info");
      }
      tick();
      await sleep(800);

      const stillAlive = st.seats.filter(s => s.inHand && !s.folded);
      if (stillAlive.length <= 1) break;
    }

    st.activeSeatId = -1;
    st.lastActions = {};
    tick();

    // 베팅 팟으로 합산
    let potAdd = 0;
    st.seats = st.seats.map(s => {
      potAdd += s.currentBet;
      return { ...s, currentBet: 0, hasActed: false };
    });
    st.pot += potAdd;
    tick();
    await sleep(400);
  }, [pushLog, tick, onToast, trainer]);

  // =====================
  // 페이즈 진행
  // =====================
  const advancePhase = useCallback(async (btnSeat: number) => {
    const st = stateRef.current;
    const alive = st.seats.filter(s => s.inHand && !s.folded);

    if (alive.length <= 1) {
      // 한 명 남아서 승리
      await finishHand([alive[0].seatId], false);
      return;
    }

    if (st.phase === "PREFLOP") {
      const flop = [st.deck.pop()!, st.deck.pop()!, st.deck.pop()!];
      st.board = [...st.board, ...flop];
      pushLog(`◆ FLOP: ${flop.map(cardLabel).join("  ")}`, "system");
      tick();
      await runBettingRound("FLOP", btnSeat, 1);
      await advancePhase(btnSeat);
    } else if (st.phase === "FLOP") {
      const turn = st.deck.pop()!;
      st.board = [...st.board, turn];
      pushLog(`◆ TURN: ${cardLabel(turn)}`, "system");
      tick();
      await runBettingRound("TURN", btnSeat, 1);
      await advancePhase(btnSeat);
    } else if (st.phase === "TURN") {
      const river = st.deck.pop()!;
      st.board = [...st.board, river];
      pushLog(`◆ RIVER: ${cardLabel(river)}`, "system");
      tick();
      await runBettingRound("RIVER", btnSeat, 1);
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
    await sleep(1200);

    const contenders = st.seats.filter(s => s.inHand && !s.folded);
    let bestStrength = -1;
    let winners: SeatState[] = [];
    for (const c of contenders) {
      const strength = estimateStrength(c.holeCards, st.board);
      if (strength > bestStrength + 0.001) {
        bestStrength = strength;
        winners = [c];
      } else if (Math.abs(strength - bestStrength) < 0.001) {
        winners.push(c);
      }
    }

    await finishHand(winners.map(w => w.seatId), true);
  }, [tick]);

  const finishHand = useCallback(async (winnerSeatIds: number[], isShowdown: boolean) => {
    const st = stateRef.current;
    const currentPot = st.pot;
    const winners = st.seats.filter(s => winnerSeatIds.includes(s.seatId));
    const share = Math.floor(currentPot / winners.length);
    const remainder = currentPot - share * winners.length;

    const winnerNames = winners.map(w => w.name).join(", ");
    const handName = isShowdown && winners[0] && winners[0].holeCards.length === 2
      ? handRankName(winners[0].holeCards, st.board)
      : (winners.length === 1 && !isShowdown ? "기본 승 (모두 폴드)" : "");

    pushLog(`★ ${winnerNames} 님이 ${currentPot.toLocaleString()} 칩 획득!${handName ? `  [${handName}]` : ""}`, "win");

    st.seats = st.seats.map((s, i) => {
      const idx = winnerSeatIds.indexOf(s.seatId);
      if (idx >= 0) {
        const bonus = idx === 0 ? remainder : 0;
        return { ...s, stack: s.stack + share + bonus };
      }
      return s;
    });
    st.pot = 0;

    if (winners.length === 1) {
      const w = winners[0];
      st.winnerInfo = { seatId: w.seatId, name: w.name, amount: currentPot, hand: handName };
      if (w.isUser) {
        onToast?.(`🎉 승리! +${currentPot.toLocaleString()} 칩`, "win");
      } else if (w.persona) {
        onToast?.(`${w.persona.emoji} ${w.name}: "${w.persona.catchphrase}"`, "info");
      }
    }
    tick();

    await sleep(4000);
    st.winnerInfo = null;
    st.showdownReveal = false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = stateRef.current;
  return {
    seats: st.seats,
    board: st.board,
    pot: st.pot,
    phase: st.phase,
    handNumber: st.handNumber,
    buttonSeat: st.buttonSeat,
    activeSeatId: st.activeSeatId,
    lastActions: st.lastActions,
    showdownReveal: st.showdownReveal,
    winnerInfo: st.winnerInfo,
    log,
    isDealing: st.isDealing,
    awaitingUser: st.awaitingUser,
    callAmount: st.callAmount,
    minRaise: st.minRaise,
    maxRaise: st.maxRaise,
    userSeatId,
    submitUserAction,
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

/**
 * 신경망 액션(0-3)을 엔진 액션(fold/check/call/raise/allin)으로 변환
 */
function mapNNActionToEngine(
  nn: { action: number; amount: number; isBluff?: boolean },
  callAmt: number,
  myStack: number
): { action: ActionType; amount: number; isBluff?: boolean } {
  switch (nn.action) {
    case 0:
      return { action: "fold", amount: 0, isBluff: nn.isBluff };
    case 1:
      // check or call
      if (callAmt === 0) return { action: "check", amount: 0 };
      if (nn.amount >= myStack) return { action: "allin", amount: myStack };
      return { action: "call", amount: nn.amount };
    case 2:
    case 3:
      // raise or allin
      if (nn.amount >= myStack + (callAmt > 0 ? callAmt : 0)) {
        return { action: "allin", amount: myStack, isBluff: nn.isBluff };
      }
      return { action: "raise", amount: nn.amount, isBluff: nn.isBluff };
    default:
      return { action: "fold", amount: 0 };
  }
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
  const s = st.seats[seatId];
  if (!s) return;
  let stack = s.stack;
  let currentBet = s.currentBet;
  let totalBet = s.totalBet;
  let folded = s.folded;
  let allIn = s.allIn;
  let inHand = s.inHand;

  if (decision.action === "fold") {
    folded = true;
    inHand = false;
  } else if (decision.action === "check") {
    // no-op
  } else if (decision.action === "call") {
    const cost = Math.min(decision.amount, stack);
    stack -= cost;
    currentBet += cost;
    totalBet += cost;
    if (stack === 0) allIn = true;
  } else if (decision.action === "raise") {
    const target = decision.amount;
    const cost = Math.min(target - currentBet, stack);
    stack -= cost;
    currentBet += cost;
    totalBet += cost;
    if (stack === 0) allIn = true;
  } else if (decision.action === "allin") {
    const cost = stack;
    stack = 0;
    currentBet += cost;
    totalBet += cost;
    allIn = true;
  }

  st.seats[seatId] = {
    ...s,
    stack,
    currentBet,
    totalBet,
    folded,
    allIn,
    inHand,
    hasActed: true,
  };
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
