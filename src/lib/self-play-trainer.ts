// ============================================================
// 자가대국(Self-Play) 학습 트레이너
// - 백그라운드에서 8인 테이블 시뮬레이션 반복
// - 매 핸드 종료 후 REINFORCE + EV-Shaping 으로 정책신경망 업데이트
// - UI는 stats를 폴링하여 학습 진행률 표시
// ============================================================

import { PolicyNetwork, PolicyAction, SerializedWeights } from "./policy-net";
import {
  evalPreflop169,
  evalPostflopRealEquity,
  multiwayEquity,
  extractStateVector,
} from "./equity-engine";
import { makeDeck, Card } from "./poker-engine";

const NUM_SEATS = 8;
const SB = 100;
const BB = 200;
const START_STACK = 20000;
const MAX_BETTING_ACTIONS = 80; // 무한루프 방지

interface SimPlayer {
  stack: number;
  currentBet: number;
  totalBet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  hasActed: boolean;
  seatIndex: number;
}

interface TrajectoryStep {
  stateVec: number[];
  action: PolicyAction;
  logProb: number;
  evPenalty: number;
  baseline: number; // 상태 가치 추정 (이동평균)
}

export interface TrainingStats {
  episodes: number;
  emaLoss: number;
  emaFoldRate: number;
  emaAllInRate: number;
  emaAvgPot: number;
  emaHandsToConclusion: number; // 평균 결착 시점 (preflop/flop/turn/river)
  lastUpdate: number;
  isRunning: boolean;
  mode: "HEURISTIC" | "NEURAL" | "HYBRID";
  baselineValue: number; // 학습된 상태 가치
}

export class SelfPlayTrainer {
  policyNet: PolicyNetwork;
  stats: TrainingStats;
  isRunning: boolean = false;
  onStatsUpdate?: (stats: TrainingStats) => void;

  private baselineEMA = 0; // reward baseline (이동평균)
  private lossEMA = 0;
  private foldRateEMA = 0;
  private allInRateEMA = 0;
  private avgPotEMA = 0;
  private conclusionEMA = 0;

  // localStorage 저장용
  private static STORAGE_KEY = "rpg_poker_policy_v1";
  private static STATS_KEY = "rpg_poker_stats_v1";

  constructor() {
    // 저장된 가중치 로드 시도
    let initialWeights: SerializedWeights | undefined;
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(SelfPlayTrainer.STORAGE_KEY);
        if (saved) {
          initialWeights = JSON.parse(saved);
        }
      } catch (e) {
        // ignore
      }
    }
    this.policyNet = new PolicyNetwork({}, initialWeights);

    let savedStats: Partial<TrainingStats> = {};
    if (typeof window !== "undefined") {
      try {
        const s = window.localStorage.getItem(SelfPlayTrainer.STATS_KEY);
        if (s) savedStats = JSON.parse(s);
      } catch (e) {
        // ignore
      }
    }

    this.stats = {
      episodes: savedStats.episodes ?? 0,
      emaLoss: 0,
      emaFoldRate: 0,
      emaAllInRate: 0,
      emaAvgPot: 0,
      emaHandsToConclusion: 0,
      lastUpdate: Date.now(),
      isRunning: false,
      mode: "HYBRID",
      baselineValue: 0,
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stats.isRunning = true;
    this._trainLoop();
  }

  stop() {
    this.isRunning = false;
    this.stats.isRunning = false;
  }

  setMode(mode: "HEURISTIC" | "NEURAL" | "HYBRID") {
    this.stats.mode = mode;
  }

  resetTraining() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SelfPlayTrainer.STORAGE_KEY);
      window.localStorage.removeItem(SelfPlayTrainer.STATS_KEY);
    }
    this.policyNet = new PolicyNetwork();
    this.stats.episodes = 0;
    this.stats.emaLoss = 0;
    this.stats.emaFoldRate = 0;
    this.stats.emaAllInRate = 0;
    this.stats.emaAvgPot = 0;
    this.stats.baselineValue = 0;
    this.baselineEMA = 0;
    this.onStatsUpdate?.(this.stats);
  }

  private async _trainLoop() {
    // 초기 학습 부스트: 게임 시작 시 200핸드 빠르게 학습
    const bootstrapNeeded = this.stats.episodes < 200;
    const batchSize = bootstrapNeeded ? 30 : 8;
    const interval = bootstrapNeeded ? 20 : 80;

    while (this.isRunning) {
      let batchLoss = 0;
      let batchFolds = 0;
      let batchAllIns = 0;
      let batchActions = 0;
      let batchPot = 0;
      let batchConclusion = 0;

      for (let i = 0; i < batchSize; i++) {
        const result = this._playOneHand();
        batchLoss += result.loss;
        batchFolds += result.foldCount;
        batchAllIns += result.allInCount;
        batchActions += result.actionCount;
        batchPot += result.finalPot;
        batchConclusion += result.conclusionPhase;
      }

      // EMA 업데이트
      this.lossEMA = this.lossEMA * 0.9 + (batchLoss / batchSize) * 0.1;
      this.foldRateEMA = this.foldRateEMA * 0.95 + (batchActions > 0 ? batchFolds / batchActions : 0) * 0.05;
      this.allInRateEMA = this.allInRateEMA * 0.95 + (batchActions > 0 ? batchAllIns / batchActions : 0) * 0.05;
      this.avgPotEMA = this.avgPotEMA * 0.95 + (batchPot / batchSize) * 0.05;
      this.conclusionEMA = this.conclusionEMA * 0.95 + (batchConclusion / batchSize) * 0.05;

      this.stats.episodes += batchSize;
      this.stats.emaLoss = this.lossEMA;
      this.stats.emaFoldRate = this.foldRateEMA;
      this.stats.emaAllInRate = this.allInRateEMA;
      this.stats.emaAvgPot = this.avgPotEMA;
      this.stats.emaHandsToConclusion = this.conclusionEMA;
      this.stats.baselineValue = this.baselineEMA;
      this.stats.lastUpdate = Date.now();

      this.onStatsUpdate?.(this.stats);

      // 200핸드마다 가중치 저장
      if (this.stats.episodes % 200 < batchSize) {
        this._saveWeights();
      }

      await new Promise(r => setTimeout(r, interval));
    }
  }

  private _saveWeights() {
    if (typeof window === "undefined") return;
    try {
      const weights = this.policyNet.serialize();
      window.localStorage.setItem(SelfPlayTrainer.STORAGE_KEY, JSON.stringify(weights));
      window.localStorage.setItem(
        SelfPlayTrainer.STATS_KEY,
        JSON.stringify({ episodes: this.stats.episodes })
      );
    } catch (e) {
      // localStorage 용량 초과 시 무시
    }
  }

  /**
   * 한 핸드 시뮬레이션 + 정책신경망 업데이트
   */
  private _playOneHand(): {
    loss: number;
    foldCount: number;
    allInCount: number;
    actionCount: number;
    finalPot: number;
    conclusionPhase: number;
  } {
    const players: SimPlayer[] = Array.from({ length: NUM_SEATS }, (_, i) => ({
      stack: START_STACK,
      currentBet: 0,
      totalBet: 0,
      inHand: true,
      folded: false,
      allIn: false,
      holeCards: [],
      hasActed: false,
      seatIndex: i,
    }));

    const deck = makeDeck();
    const board: Card[] = [];
    const btnSeat = Math.floor(Math.random() * NUM_SEATS);

    // 블라인드
    const sbSeat = (btnSeat + 1) % NUM_SEATS;
    const bbSeat = (btnSeat + 2) % NUM_SEATS;
    players[sbSeat].currentBet = Math.min(SB, players[sbSeat].stack);
    players[sbSeat].stack -= players[sbSeat].currentBet;
    players[bbSeat].currentBet = Math.min(BB, players[bbSeat].stack);
    players[bbSeat].stack -= players[bbSeat].currentBet;

    // 홀카드
    for (const p of players) {
      if (p.inHand) {
        p.holeCards = [deck.pop()!, deck.pop()!];
      }
    }

    const trajectories: TrajectoryStep[][] = Array.from({ length: NUM_SEATS }, () => []);
    let pot = SB + BB;
    let totalFoldCount = 0;
    let totalAllInCount = 0;
    let totalActions = 0;
    let conclusionPhase = 0;

    const phases = [
      { name: "PREFLOP", boardCount: 0, startOffset: 3 },
      { name: "FLOP", boardCount: 3, startOffset: 1 },
      { name: "TURN", boardCount: 4, startOffset: 1 },
      { name: "RIVER", boardCount: 5, startOffset: 1 },
    ];

    let phaseIdx = 0;
    for (const phase of phases) {
      while (board.length < phase.boardCount) {
        deck.pop(); // burn
        board.push(deck.pop()!);
      }

      const result = this._runBettingRound(
        players, board, btnSeat, phase.startOffset, pot, trajectories
      );
      pot = result.pot;
      totalFoldCount += result.foldCount;
      totalAllInCount += result.allInCount;
      totalActions += result.actionCount;
      phaseIdx++;

      const alive = players.filter(p => p.inHand && !p.folded);
      if (alive.length <= 1) {
        conclusionPhase = phaseIdx;
        break;
      }
    }

    if (conclusionPhase === 0) conclusionPhase = 4; // 쇼다운까지 감

    // 승자 결정
    const alive = players.filter(p => p.inHand && !p.folded);
    let winnerIdx = -1;
    if (alive.length === 1) {
      winnerIdx = alive[0].seatIndex;
    } else {
      // 쇼다운: 에퀴티로 승자 결정
      let bestEq = -1;
      for (const p of alive) {
        const eq = evalPostflopRealEquity(p.holeCards, board);
        if (eq > bestEq) {
          bestEq = eq;
          winnerIdx = p.seatIndex;
        }
      }
    }

    if (winnerIdx >= 0) {
      players[winnerIdx].stack += pot;
    }

    // 정책신경망 가중치 업데이트 (REINFORCE + EV-shaping)
    let batchLoss = 0;
    const lr = this.policyNet.config.learningRate;
    const bb = BB;

    for (let i = 0; i < NUM_SEATS; i++) {
      const netBB = (players[i].stack - START_STACK) / bb;
      // baseline EMA 업데이트 (reward의 이동평균)
      this.baselineEMA = this.baselineEMA * 0.999 + netBB * 0.001;

      for (const step of trajectories[i]) {
        const shapedReward = netBB - step.evPenalty;
        const advantage = shapedReward - this.baselineEMA;

        // forward pass 다시 수행 (cache 복원)
        const { probs, cache } = this.policyNet.forward(step.stateVec);
        const logProb = Math.log(probs[step.action] + 1e-9);

        batchLoss -= logProb * advantage;

        // 가중치 업데이트
        this.policyNet.backward(cache, step.action, advantage);
      }
    }

    return {
      loss: Math.abs(batchLoss),
      foldCount: totalFoldCount,
      allInCount: totalAllInCount,
      actionCount: totalActions,
      finalPot: pot,
      conclusionPhase,
    };
  }

  private _runBettingRound(
    players: SimPlayer[],
    board: Card[],
    btnSeat: number,
    startOffset: number,
    initialPot: number,
    trajectories: TrajectoryStep[][]
  ): { pot: number; foldCount: number; allInCount: number; actionCount: number } {
    let pot = initialPot;
    let foldCount = 0;
    let allInCount = 0;
    let actionCount = 0;
    let raiseLevel = 0;

    for (const p of players) p.hasActed = false;

    let safety = 0;
    while (safety++ < MAX_BETTING_ACTIONS) {
      const alive = players.filter(p => p.inHand && !p.folded);
      if (alive.length <= 1) break;

      const notAllIn = alive.filter(p => !p.allIn);
      if (notAllIn.length === 0) break;

      const maxBet = Math.max(...alive.map(p => p.currentBet));
      const needsAction = notAllIn.filter(p => !p.hasActed || p.currentBet < maxBet);
      if (needsAction.length === 0) break;

      let actorIdx = -1;
      for (let i = 0; i < NUM_SEATS; i++) {
        const idx = (btnSeat + startOffset + i) % NUM_SEATS;
        const p = players[idx];
        if (p.inHand && !p.folded && !p.allIn && (!p.hasActed || p.currentBet < maxBet)) {
          actorIdx = idx;
          break;
        }
      }
      if (actorIdx === -1) break;

      const actor = players[actorIdx];
      const callAmt = Math.max(0, maxBet - actor.currentBet);
      const activeOpp = alive.length - 1;
      const minRaise = maxBet === 0 ? BB : maxBet + BB;
      const maxRaise = actor.stack + actor.currentBet;

      // 에퀴티 계산
      const eq = board.length === 0
        ? evalPreflop169(actor.holeCards)
        : evalPostflopRealEquity(actor.holeCards, board);

      const stateVec = extractStateVector(
        eq, callAmt, pot, actor.stack, activeOpp,
        board.length, actorIdx, NUM_SEATS, raiseLevel
      );

      // 정책신경망 forward
      const { probs, cache } = this.policyNet.forward(stateVec);

      // 액션 마스킹
      const mask = [1, 1, 1, 1];
      if (callAmt === 0) mask[0] = 0; // 체크 가능하면 폴드 금지
      if (raiseLevel >= 3 || maxRaise <= minRaise) {
        mask[2] = 0;
        mask[3] = 0;
      }

      const maskedProbs = probs.map((p, i) => p * mask[i]);
      const sumP = maskedProbs.reduce((s, v) => s + v, 0);
      const normalizedProbs = maskedProbs.map(p => p / (sumP + 1e-9));

      // EV veto (하이브리드 모드): 학습 초기에는 명백한 -EV 콜 금지
      const multiwayEq = multiwayEquity(eq, activeOpp);
      const potOdds = callAmt > 0 ? callAmt / (pot + callAmt) : 0;
      const stackCommitment = callAmt / (actor.stack + callAmt);
      let evPenalty = 0;
      if (callAmt > 0 && multiwayEq < potOdds) {
        // -EV 상황: 폴드 확률을 부스트 (초기 학습 안정용)
        const boost = (potOdds - multiwayEq) * 4;
        normalizedProbs[0] = Math.min(0.95, normalizedProbs[0] + boost);
        normalizedProbs[1] *= Math.max(0.05, 1 - boost);
        normalizedProbs[2] *= Math.max(0.05, 1 - boost * 1.5);
        normalizedProbs[3] *= Math.max(0.05, 1 - boost * 2);
        const newSum = normalizedProbs.reduce((s, v) => s + v, 0);
        for (let k = 0; k < 4; k++) normalizedProbs[k] /= newSum;

        evPenalty = (potOdds - multiwayEq) * (callAmt / BB) * 1.5;
      }

      // 샘플링
      let r = Math.random();
      let action: PolicyAction = 0;
      for (let i = 0; i < 4; i++) {
        r -= normalizedProbs[i];
        if (r <= 0) {
          action = i as PolicyAction;
          break;
        }
      }

      trajectories[actorIdx].push({
        stateVec,
        action,
        logProb: Math.log(probs[action] + 1e-9),
        evPenalty,
        baseline: this.baselineEMA,
      });

      // 액션 적용
      if (action === 0) {
        actor.folded = true;
        actor.inHand = false;
        foldCount++;
      } else if (action === 1) {
        // call/check
        const cost = Math.min(callAmt, actor.stack);
        actor.stack -= cost;
        actor.currentBet += cost;
        if (actor.stack === 0) {
          actor.allIn = true;
          allInCount++;
        }
      } else if (action === 2) {
        // half-pot raise
        const target = Math.max(minRaise, maxBet + Math.floor(pot * 0.5));
        const finalTarget = Math.min(target, maxRaise);
        const cost = finalTarget - actor.currentBet;
        actor.stack -= cost;
        actor.currentBet = finalTarget;
        raiseLevel++;
        if (actor.stack === 0) {
          actor.allIn = true;
          allInCount++;
        }
      } else {
        // pot raise
        const target = Math.max(minRaise, maxBet + pot);
        const finalTarget = Math.min(target, maxRaise);
        const cost = finalTarget - actor.currentBet;
        actor.stack -= cost;
        actor.currentBet = finalTarget;
        raiseLevel++;
        if (actor.stack === 0) {
          actor.allIn = true;
          allInCount++;
        }
      }
      actor.hasActed = true;
      actionCount++;
    }

    // 베팅 팟으로 합산
    for (const p of players) {
      pot += p.currentBet;
      p.currentBet = 0;
      p.hasActed = false;
    }

    return { pot, foldCount, allInCount, actionCount };
  }

  /**
   * 라이브 게임용 의사결정 (UI 훅에서 호출)
   * 모드에 따라 신경망/휴리스틱/하이브리드 사용
   */
  decideActionForLive(
    hole: Card[],
    board: Card[],
    callAmount: number,
    minRaise: number,
    maxRaise: number,
    pot: number,
    myStack: number,
    myCurrentBet: number,
    activeOpponents: number,
    seatIndex: number,
    numSeats: number,
    raiseLevel: number,
    persona: { vpip: number; aggression: number; bluffFreq: number }
  ): { action: number; amount: number; isBluff?: boolean } {
    const mode = this.stats.mode;

    // HEURISTIC 모드: 1단계 수학 엔진만 사용
    if (mode === "HEURISTIC") {
      return this._heuristicDecide(
        hole, board, callAmount, minRaise, maxRaise, pot,
        myStack, myCurrentBet, activeOpponents, persona
      );
    }

    // 신경망 추론
    const eq = board.length === 0
      ? evalPreflop169(hole)
      : evalPostflopRealEquity(hole, board);

    const stateVec = extractStateVector(
      eq, callAmount, pot, myStack, activeOpponents,
      board.length, seatIndex, numSeats, raiseLevel
    );

    const { probs } = this.policyNet.forward(stateVec);

    // 액션 마스킹
    const mask = [1, 1, 1, 1];
    if (callAmount === 0) mask[0] = 0;
    if (raiseLevel >= 3 || maxRaise <= minRaise) {
      mask[2] = 0;
      mask[3] = 0;
    }

    const maskedProbs = probs.map((p, i) => p * mask[i]);
    const sumP = maskedProbs.reduce((s, v) => s + v, 0);
    let normalizedProbs = maskedProbs.map(p => p / (sumP + 1e-9));

    // HYBRID 모드: -EV 콜은 휴리스틱으로 veto (안전장치)
    if (mode === "HYBRID") {
      const multiwayEq = multiwayEquity(eq, activeOpponents);
      const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;
      if (callAmount > 0 && multiwayEq < potOdds - 0.05) {
        // 명백한 -EV: 폴드 부스트
        const boost = Math.min(0.7, (potOdds - multiwayEq) * 3);
        normalizedProbs[0] = Math.min(0.9, normalizedProbs[0] + boost);
        normalizedProbs[1] *= Math.max(0.1, 1 - boost);
        normalizedProbs[2] *= Math.max(0.1, 1 - boost * 1.5);
        normalizedProbs[3] *= Math.max(0.1, 1 - boost * 2);
        const newSum = normalizedProbs.reduce((s, v) => s + v, 0);
        for (let k = 0; k < 4; k++) normalizedProbs[k] /= newSum;
      }
    }

    // 페르소나 성향 반영 (약간의 가중치 조정)
    const aggression = persona.aggression;
    const adjusted = [
      normalizedProbs[0] * (1.1 - aggression * 0.3),
      normalizedProbs[1],
      normalizedProbs[2] * (0.7 + aggression * 0.6),
      normalizedProbs[3] * (0.5 + aggression * 1.0),
    ];
    const sumA = adjusted.reduce((s, v) => s + v, 0);
    const finalProbs = adjusted.map(p => p / sumA);

    // 샘플링
    let r = Math.random();
    let action = 0;
    for (let i = 0; i < 4; i++) {
      r -= finalProbs[i];
      if (r <= 0) {
        action = i;
        break;
      }
    }

    // 금액 계산
    let amount = 0;
    let isBluff = false;
    if (action === 1) {
      amount = Math.min(callAmount, myStack);
    } else if (action === 2) {
      const target = Math.max(minRaise, callAmount + Math.floor(pot * 0.5));
      amount = Math.min(target, maxRaise);
      if (eq < 0.4) isBluff = true;
    } else if (action === 3) {
      const target = Math.max(minRaise, callAmount + pot);
      amount = Math.min(target, maxRaise);
      if (eq < 0.5) isBluff = true;
    }

    // 올인 상황 처리
    if (action >= 2 && amount >= myStack + myCurrentBet) {
      amount = myStack + myCurrentBet;
    }

    return { action, amount, isBluff };
  }

  private _heuristicDecide(
    hole: Card[],
    board: Card[],
    callAmount: number,
    minRaise: number,
    maxRaise: number,
    pot: number,
    myStack: number,
    myCurrentBet: number,
    activeOpponents: number,
    persona: { vpip: number; aggression: number; bluffFreq: number }
  ): { action: number; amount: number; isBluff?: boolean } {
    const equity = board.length === 0
      ? evalPreflop169(hole)
      : evalPostflopRealEquity(hole, board);

    // 프리플랍
    if (board.length === 0) {
      if (callAmount === 0) {
        if (equity > (0.85 - persona.aggression * 0.25) && maxRaise > minRaise) {
          const raiseTo = Math.min(maxRaise, Math.max(minRaise, Math.floor(pot * 2.5)));
          return { action: 2, amount: raiseTo };
        }
        return { action: 1, amount: 0 };
      }
      const betPressure = Math.min(0.40, (callAmount / (myStack + callAmount)) * 0.65);
      let requiredScore = (1.0 - persona.vpip) + betPressure;
      if (myCurrentBet > 200) {
        requiredScore = Math.max(requiredScore, 0.78 - (persona.aggression * 0.1));
      }
      if (equity < requiredScore) return { action: 0, amount: 0 };

      const isHeavyAction = callAmount > myStack * 0.25;
      const raiseThreshold = isHeavyAction ? 0.92 : (0.82 - persona.aggression * 0.15);
      if (equity >= raiseThreshold && maxRaise > minRaise && Math.random() < persona.aggression) {
        const raiseTo = Math.floor(minRaise + pot * 0.8);
        return { action: 2, amount: Math.max(minRaise, Math.min(raiseTo, maxRaise)) };
      }
      return { action: 1, amount: Math.min(callAmount, myStack) };
    }

    // 포스트플랍
    const multiEq = multiwayEquity(equity, activeOpponents);
    const canTryBluff = (myCurrentBet === 0 && callAmount <= pot * 0.35 && activeOpponents <= 2);
    const isBluff = canTryBluff && (Math.random() < persona.bluffFreq * 0.4);

    if (callAmount === 0) {
      if ((multiEq > 0.62 || isBluff) && maxRaise > minRaise && Math.random() < persona.aggression) {
        const betSize = Math.floor(pot * (0.45 + 0.3 * persona.aggression));
        return { action: 2, amount: Math.max(minRaise, Math.min(betSize, maxRaise)), isBluff };
      }
      return { action: 1, amount: 0 };
    }

    const potOdds = callAmount / (pot + callAmount);
    const stackCommitment = callAmount / (myStack + callAmount);
    let safetyMargin = stackCommitment * 0.22 * (1.2 - persona.vpip);
    if (myCurrentBet > 0) safetyMargin += 0.15;
    const requiredEquity = potOdds + safetyMargin;
    if (multiEq < requiredEquity) return { action: 0, amount: 0 };

    const raiseEqNeeded = stackCommitment > 0.3 ? 0.82 : (0.74 - persona.aggression * 0.1);
    if (multiEq >= raiseEqNeeded && maxRaise > minRaise && Math.random() < (persona.aggression * 0.7)) {
      const raiseTo = Math.floor(minRaise + pot * 0.65);
      return { action: 2, amount: Math.max(minRaise, Math.min(raiseTo, maxRaise)) };
    }
    return { action: 1, amount: Math.min(callAmount, myStack) };
  }
}
