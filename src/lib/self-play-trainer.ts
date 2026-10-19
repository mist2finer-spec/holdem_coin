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
import { makeDeck, Card, determineWinners } from "./poker-engine";

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

    // 승자 결정 - 정확한 7카드 평가기 사용
    const alive = players.filter(p => p.inHand && !p.folded);
    let winnerIdx = -1;
    if (alive.length === 1) {
      winnerIdx = alive[0].seatIndex;
    } else {
      // 쇼다운: 정확한 핸드 평가로 승자 결정
      const winnerIndices = determineWinners(
        alive.map(p => ({ holeCards: p.holeCards })),
        board
      );
      if (winnerIndices.length > 0) {
        winnerIdx = alive[winnerIndices[0]].seatIndex;
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
    let lastActorIdx = -1;
    while (safety++ < MAX_BETTING_ACTIONS) {
      const alive = players.filter(p => p.inHand && !p.folded);
      if (alive.length <= 1) break;

      const notAllIn = alive.filter(p => !p.allIn);
      if (notAllIn.length === 0) break;

      const maxBet = Math.max(...alive.map(p => p.currentBet));
      const needsAction = notAllIn.filter(p => !p.hasActed || p.currentBet < maxBet);
      if (needsAction.length === 0) break;

      // 다음 액터: 직전 액터 다음 좌석부터 시계방향 (올바른 턴 순서)
      let actorIdx = -1;
      const startSearchFrom = lastActorIdx === -1
        ? (btnSeat + startOffset) % NUM_SEATS
        : (lastActorIdx + 1) % NUM_SEATS;

      for (let i = 0; i < NUM_SEATS; i++) {
        const idx = (startSearchFrom + i) % NUM_SEATS;
        const p = players[idx];
        if (p.inHand && !p.folded && !p.allIn && (!p.hasActed || p.currentBet < maxBet)) {
          actorIdx = idx;
          break;
        }
      }
      if (actorIdx === -1) break;

      lastActorIdx = actorIdx;
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
      // 레이즈 시 다른 생존 플레이어 모두 다시 행동해야 함 (올바른 포커 룰)
      if (action === 2 || action === 3) {
        for (let i = 0; i < players.length; i++) {
          if (i !== actorIdx && players[i].inHand && !players[i].folded && !players[i].allIn) {
            players[i].hasActed = false;
          }
        }
      }
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
   * GTO 스타일 핸드 강도 분류 + 포지션 기반 전략 + 신경망 보정
   * - Premium hands (top 5%): 레이즈/3-bet
   * - Strong hands (15%): 콜 위주, 가끔 레이즈
   * - Medium hands (30-50%): 콜 (팟 오즈 충족 시)
   * - Weak hands: 폴드 (가끔 블러프)
   * - 포지션별 오프닝 레인지: UTG 타이트, BTN 루즈
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
    buttonSeat: number,
    persona: { vpip: number; aggression: number; bluffFreq: number }
  ): { action: number; amount: number; isBluff?: boolean } {
    const eq = board.length === 0
      ? evalPreflop169(hole)
      : evalPostflopRealEquity(hole, board);

    const multiEq = multiwayEquity(eq, activeOpponents);
    const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;
    const evMargin = multiEq - potOdds;
    const stackCommitment = callAmount > 0 ? callAmount / (myStack + callAmount) : 0;

    // 포지션 계산 (UTG/MP/CO/BTN/SB/BB)
    const position = this._getPosition(seatIndex, buttonSeat, numSeats);
    const positionAdvantage = this._getPositionAdvantage(position);

    // GTO 핸드 강도 분류 (포지션 보정 적용)
    // 늦은 포지션(BTN/CO)일수록 같은 핸드라도 더 강하게 평가
    const adjustedEq = eq + positionAdvantage * 0.05;
    const handTier = this._classifyHandTier(adjustedEq, multiEq, board.length);

    // ========================================
    // GTO 결정 트리 (포지션 반영)
    // ========================================

    // === 1) 체크 가능한 상황 (callAmount === 0) ===
    if (callAmount === 0) {
      // Premium (AA, KK, QQ, AK, 넛): 밸류 베팅
      if (handTier === "premium" && raiseLevel < 2 && Math.random() < persona.aggression * 0.8) {
        const target = Math.max(minRaise, Math.floor(pot * (0.5 + persona.aggression * 0.3)));
        return { action: 2, amount: Math.min(target, maxRaise) };
      }
      // Strong (탑페어 좋은 킥커, 투페어): 가끔 베팅
      if (handTier === "strong" && raiseLevel === 0 && Math.random() < persona.aggression * 0.5) {
        const target = Math.max(minRaise, Math.floor(pot * 0.5));
        return { action: 2, amount: Math.min(target, maxRaise) };
      }
      // Bluff: 늦은 포지션에서 더 자주
      const bluffChance = persona.bluffFreq * 0.3 * (1 + positionAdvantage);
      if (handTier === "air" && activeOpponents <= 2 && raiseLevel === 0
          && Math.random() < bluffChance) {
        const target = Math.max(minRaise, Math.floor(pot * 0.5));
        return { action: 2, amount: Math.min(target, maxRaise), isBluff: true };
      }
      // 기본: 체크
      return { action: 1, amount: 0 };
    }

    // === 2) 콜 비용이 있는 상황 ===

    // (a) 명백한 -EV: 폴드 (포지션이 좋으면 조금 더 버팀)
    const foldThreshold = -0.08 + positionAdvantage * 0.03;
    if (evMargin < foldThreshold) {
      return { action: 0, amount: 0 };
    }

    // (b) Premium (넛, 셋, 풀하우스): 레이즈/리레이즈
    if (handTier === "premium" && raiseLevel < 3 && maxRaise > minRaise
        && Math.random() < persona.aggression * 0.85) {
      // 이미 3-bet 이상이면 콜 (캡 방지)
      if (raiseLevel >= 2 && stackCommitment < 0.4) {
        return { action: 1, amount: Math.min(callAmount, myStack) };
      }
      const target = Math.max(minRaise, maxRaise >= minRaise + pot
        ? Math.floor(minRaise + pot * 0.6)
        : minRaise);
      return { action: 2, amount: Math.min(target, maxRaise) };
    }

    // (c) Strong: 보통 콜, 가끔 레이즈 (밸류)
    // 늦은 포지션에서 더 공격적
    if (handTier === "strong") {
      const raiseChance = persona.aggression * 0.3 * (1 + positionAdvantage * 0.5);
      if (raiseLevel === 0 && Math.random() < raiseChance && maxRaise > minRaise) {
        const target = Math.max(minRaise, Math.floor(minRaise + pot * 0.5));
        return { action: 2, amount: Math.min(target, maxRaise) };
      }
      // 리레이즈가 있으면 콜 (조심)
      if (raiseLevel >= 2 && stackCommitment > 0.3) {
        // 큰 베팅에는 콜로 방어
        if (evMargin > 0.05) {
          return { action: 1, amount: Math.min(callAmount, myStack) };
        }
        return { action: 0, amount: 0 };
      }
      return { action: 1, amount: Math.min(callAmount, myStack) };
    }

    // (d) Medium: 팟 오즈 충족하면 콜
    // 포지션이 좋으면 더 넓게 콜
    if (handTier === "medium") {
      // 리레이즈(3-bet+) 상황이면 폴드 (포지션이 좋으면 조금 더 버팀)
      const threeBetFoldThreshold = 0.25 - positionAdvantage * 0.05;
      if (raiseLevel >= 2 && stackCommitment > threeBetFoldThreshold) {
        return { action: 0, amount: 0 };
      }
      // +EV 콜
      const callThreshold = 0.02 - positionAdvantage * 0.03;
      if (evMargin > callThreshold) {
        return { action: 1, amount: Math.min(callAmount, myStack) };
      }
      // 애매하면 작은 베팅만 콜 (포지션이 좋으면 더 콜)
      const smallBetThreshold = 0.15 + positionAdvantage * 0.05;
      if (stackCommitment < smallBetThreshold) {
        return { action: 1, amount: Math.min(callAmount, myStack) };
      }
      return { action: 0, amount: 0 };
    }

    // (e) Weak (원페어 낮은 킥커, 바텀페어): 작은 베팅만 콜
    // 포지션이 좋으면 더 넓게 콜
    if (handTier === "weak") {
      const weakCallRaiseLevel = 1; // 포지션 좋으면 1레이즈까지 콜
      if (raiseLevel >= weakCallRaiseLevel && positionAdvantage < 0.5) return { action: 0, amount: 0 };
      if (raiseLevel >= weakCallRaiseLevel + 1) return { action: 0, amount: 0 };
      const weakStackThreshold = 0.10 + positionAdvantage * 0.05;
      if (stackCommitment < weakStackThreshold && evMargin > -0.05) {
        return { action: 1, amount: Math.min(callAmount, myStack) };
      }
      return { action: 0, amount: 0 };
    }

    // (f) Air (하이카드): 거의 폴드, 가끔 블러프 콜
    // 늦은 포지션에서 가끔 스틸 시도
    if (handTier === "air") {
      const bluffCallChance = persona.bluffFreq * 0.2 * (1 + positionAdvantage);
      if (raiseLevel === 0 && stackCommitment < 0.05
          && Math.random() < bluffCallChance) {
        return { action: 1, amount: Math.min(callAmount, myStack), isBluff: true };
      }
      return { action: 0, amount: 0 };
    }

    // 기본: 콜 (이 경우는 거의 안 옴)
    return { action: 1, amount: Math.min(callAmount, myStack) };
  }

  /**
   * 좌석 인덱스로부터 포지션 계산
   * 8인 테이블 기준: BTN, SB, BB, UTG, UTG+1, MP, MP+1, CO
   * @returns 포지션 이름
   */
  private _getPosition(seatIndex: number, buttonSeat: number, numSeats: number): string {
    const offset = (seatIndex - buttonSeat + numSeats) % numSeats;
    // 8인 테이블: BTN=0, SB=1, BB=2, UTG=3, UTG+1=4, MP1=5, MP2=6, CO=7
    if (offset === 0) return "BTN";
    if (offset === 1) return "SB";
    if (offset === 2) return "BB";
    if (numSeats === 8) {
      if (offset === 3) return "UTG";
      if (offset === 4) return "UTG1";
      if (offset === 5) return "MP1";
      if (offset === 6) return "MP2";
      if (offset === 7) return "CO";
    } else {
      // 6인 테이블 등
      if (offset === 3) return "UTG";
      if (offset === 4) return "MP";
      if (offset === 5) return "CO";
    }
    return "MP";
  }

  /**
   * 포지션 이점 점수 (0.0 ~ 1.0)
   * BTN이 가장 유리(1.0), UTG가 가장 불리(0.0)
   * 빠른 포지션일수록 더 많은 상대가 뒤에 있어서 정보가 적음
   */
  private _getPositionAdvantage(position: string): number {
    switch (position) {
      case "BTN": return 1.0;  // 가장 유리
      case "CO":  return 0.8;
      case "MP2": return 0.6;
      case "MP1": return 0.5;
      case "MP":  return 0.4;
      case "UTG1": return 0.3;
      case "UTG": return 0.2;  // 가장 불리
      case "BB":  return 0.5;  // 이미 블라인드 걸었음
      case "SB":  return 0.3;  // 가장 불리한 위치
      default:    return 0.4;
    }
  }

  /**
   * GTO 핸드 강도 티어 분류
   * - premium: AA, KK, QQ, AKs / 넛, 셋, 풀하우스, 플러시, 스트레이트 (postflop)
   * - strong: 탑페어 좋은 킥커, 투페어, 오버페어 (postflop)
   * - medium: 미들페어, 좋은 드로우
   * - weak: 바텀페어, 약한 원페어
   * - air: 하이카드
   */
  private _classifyHandTier(
    rawEq: number,
    multiEq: number,
    boardLen: number
  ): "premium" | "strong" | "medium" | "weak" | "air" {
    if (boardLen === 0) {
      // 프리플랍: 첸 점수 기준
      if (rawEq >= 0.90) return "premium";   // AA, KK, QQ, AKs
      if (rawEq >= 0.78) return "strong";    // JJ, TT, AQ, KQs
      if (rawEq >= 0.55) return "medium";    // 99-22, AJ, AT, KJ
      if (rawEq >= 0.35) return "weak";      // 스펙
      return "air";                          // 쓰레기
    }
    // 포스트플랍: multiway 보정 승률 기준
    if (multiEq >= 0.85) return "premium";   // 넛, 셋, 풀하우스
    if (multiEq >= 0.65) return "strong";    // 탑페어 좋은 킥커, 투페어
    if (multiEq >= 0.45) return "medium";    // 미들페어, 드로우
    if (multiEq >= 0.25) return "weak";      // 바텀페어
    return "air";                            // 하이카드
  }

  // _heuristicDecide는 제거됨 - GTO 결정 트리가 decideActionForLive에서 직접 처리
}
