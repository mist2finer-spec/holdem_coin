import {StreetBetting} from './poker-betting';
import {minimumRaiseTo} from "./poker-sizing";
import { bluffFrequency } from "./poker-bluff";
import { oopCheckMix } from "./poker-position";
import { decideShortStack } from "./poker-shortstack";
import { continuationBetFrequency, checkCallEquityRequired } from "./poker-postflop";
import { settleHand, bettingLocked, dealNextStreet, hasBettingOpponent } from "./poker-rules";
import { estimateEquity, estimateCallEquity, afterRakeOdds, calledActionEV, modeledCallEV, DecisionContext } from "./poker-ai";
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
  classifyHandTier,
  HandTier,
  HandTierNames,
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
  peakStreetBet?: number;
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
  // New rules use a separate checkpoint; legacy weights/stats are preserved.
  private static STORAGE_KEY = "rpg_poker_policy_v6_gross_ev";
  private static STATS_KEY = "rpg_poker_stats_v6_gross_ev";

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
      totalBet: 0, peakStreetBet: 0,
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
    players[sbSeat].totalBet=players[sbSeat].currentBet;
    players[bbSeat].currentBet = Math.min(BB, players[bbSeat].stack);
    players[bbSeat].stack -= players[bbSeat].currentBet;
    players[bbSeat].totalBet=players[bbSeat].currentBet;

    // 홀카드
    for (const p of players) {
      if (p.inHand) {
        p.holeCards = [deck.pop()!, deck.pop()!];
      }
    }

    const trajectories: TrajectoryStep[][] = Array.from({ length: NUM_SEATS }, () => []);
    let pot = 0; // blinds are still in currentBet until collected
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
      if (board.length < phase.boardCount) {
        const next=dealNextStreet(board,deck);
        board.splice(0,board.length,...next.board);
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

    const settlement=settleHand(players.map(p=>({...p,seatId:p.seatIndex,name:`CPU${p.seatIndex}`})),board,btnSeat);
    for(const result of settlement.results)players[result.seatId].stack+=result.payout;

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
    const betting=new StreetBetting(BB);

    for (const p of players) p.hasActed = false;

    let safety = 0;
    let lastActorIdx = -1;
    while (safety++ < MAX_BETTING_ACTIONS) {
      const alive = players.filter(p => p.inHand && !p.folded);
      if (alive.length <= 1 || bettingLocked(players.map(p=>({...p,seatId:p.seatIndex})))) break;

      const notAllIn = alive.filter(p => !p.allIn);
      if (notAllIn.length === 0) break;

      const maxBet = Math.max(board.length===0?BB:0,...alive.map(p => p.currentBet));
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
      const minRaise = minimumRaiseTo(maxBet,BB,betting.lastFullRaise);
      const publicSeats=players.map(p=>({...p,seatId:p.seatIndex}));
      const maxRaise = betting.canRaise(actorIdx,maxBet)&&hasBettingOpponent(publicSeats,actorIdx) ? actor.stack + actor.currentBet : maxBet;
      const livePot=pot+players.reduce((sum,p)=>sum+p.currentBet,0);

      // 에퀴티 계산
      const eq = board.length === 0
        ? evalPreflop169(actor.holeCards)
        : evalPostflopRealEquity(actor.holeCards, board);

      const stateVec = extractStateVector(
        eq, callAmt, livePot, actor.stack, activeOpp,
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
      const potOdds = afterRakeOdds(livePot,Math.min(callAmt,actor.stack));
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

      const beforeStack=actor.stack;
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
        const target = Math.max(minRaise, maxBet + Math.floor(livePot * 0.5));
        const finalTarget = Math.min(target, maxRaise);
        const cost = finalTarget - actor.currentBet;
        actor.stack -= cost;
        actor.currentBet = finalTarget;

        if (actor.stack === 0) {
          actor.allIn = true;
          allInCount++;
        }
      } else {
        // pot raise
        const target = Math.max(minRaise, maxBet + livePot);
        const finalTarget = Math.min(target, maxRaise);
        const cost = finalTarget - actor.currentBet;
        actor.stack -= cost;
        actor.currentBet = finalTarget;

        if (actor.stack === 0) {
          actor.allIn = true;
          allInCount++;
        }
      }
      actor.totalBet+=beforeStack-actor.stack;
      actor.peakStreetBet=Math.max(actor.peakStreetBet||0,actor.currentBet);
      actor.hasActed = true;
      const fullRaise=betting.record(actorIdx,maxBet,Math.max(maxBet,actor.currentBet));
      if ((action === 2 || action === 3)&&fullRaise) {
        raiseLevel++;
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
   * 5가지 액션 인덱스 (Python AdaptiveCPUBrain과 매칭):
   *   0: FOLD
   *   1: CHECK_OR_CALL
   *   2: RAISE_STD (2x 스탠다드 리레이즈)
   *   3: RERAISE_POT (팟 리레이즈 / 3-Bet)
   *   4: ALL_IN
   *
   * Warm-Start: 처음부터 포커 정석 셋업된 로짓 앵커 사용
   * 핵심: 노히트(AIR)는 상대 베팅/레이즈에 절대 콜(CALL) 하지 않음!
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
    persona: { vpip: number; aggression: number; bluffFreq: number },
    context?: DecisionContext
  ): { action: number; amount: number; isBluff?: boolean; tier?: number; decisionPath?: string } {
    // 1) 새로운 정밀 핸드 티어 분류 (AIR 버그 수정 적용)
    const { tier } = classifyHandTier(hole, board);
    const multiEq = context&&board.length===0&&raiseLevel>0
      ? estimateCallEquity(hole,board,context,192,raiseLevel>=2?'three-bet':'open')
      : estimateEquity(hole,board,activeOpponents);
    const position = context?.position;
    const positionCost = board.length === 0 ? (position?.preflopEquityPremium || 0) * (1.2 - persona.aggression * 0.6) : 0;
    const stackCost = (context?.stack?.equityPremium || 0) * (board.length === 0 ? 1 : 0.5);
    const potOdds = Math.min(1, afterRakeOdds(pot,Math.min(callAmount,myStack)) + positionCost + stackCost);

    if(context) {
      const shortDecision=decideShortStack({hole,board,call:callAmount,minRaise,maxRaise,pot,
        stack:myStack,currentBet:myCurrentBet,raiseLevel,persona,context});
      if(shortDecision)return {...shortDecision,tier,decisionPath:raiseLevel===2&&context.openedPreflop ? "three-bet-ev" : "small-open-ev"};
    }

    // 2) 베팅 압박 수위 (0~3)
    let pressure: number;
    if (callAmount === 0) {
      pressure = 0;
    } else if (raiseLevel >= 2
               || (callAmount / (myStack + callAmount)) >= 0.28
               || (callAmount / pot) >= 0.80) {
      pressure = 3;
    } else if (raiseLevel === 1 || (callAmount / pot) >= 0.30) {
      pressure = 2;
    } else {
      pressure = 1;
    }

    // 3) Warm-Start 앵커 로짓 (5개 액션)
    const anchor = this._getWarmStartAnchor(pressure, tier, persona);
    const logits = [...anchor];
    if (context?.stack?.deepVsDeep) {
      // More chips can be contested against a deep opponent: prefer smaller
      // commitments while retaining strong value raises and check-raises.
      logits[3] -= 0.35;
      logits[4] -= 0.55;
    }

    // Protect the OOP checking range: strong hands must not always lead.
    // Draws/air also check, so checking does not disclose a trap. This mixture
    // only takes a FREE check; facing a bet still goes through equity/masks.
    if (board.length > 0 && callAmount === 0 && (position?.isOOP||context?.initiative)) {
      let checkMix=position?.isOOP?oopCheckMix(persona,tier,position.opponents,board):0;
      if(context?.initiative)checkMix=Math.max(checkMix,1-continuationBetFrequency(persona,board,tier,activeOpponents));
      if (Math.random() < checkMix) {
        return { action: 1, amount: 0, isBluff: false, tier };
      }
    }

    if (position?.isOOP) {
      const disadvantage = 1 - position.relativePosition;
      const caution = 1.2 - persona.aggression * 0.6;
      logits[0] += 0.45 * disadvantage * caution;
      logits[2] -= 0.30 * disadvantage * caution;
      logits[3] -= 0.45 * disadvantage * caution;
      // Check-raise with value, retaining check-call and fold alternatives.
      // Top pair remains cautious, especially multiway or against large bets.
      if (board.length > 0 && position.checkedThisStreet && callAmount > 0
          && pressure <= 2 && callAmount <= pot * 0.75 && tier >= HandTier.TOP_PAIR) {
        const boost = tier >= HandTier.TWO_PAIR_PLUS ? 0.9 + persona.aggression * 0.7 + (1 - persona.vpip) * 0.3
          : position.opponents === 1 ? 0.35 : 0;
        logits[2] += boost;
        logits[3] += boost * 0.65;
      }
    }

    // ★ 트랩 플레이: 강한 핸드(TOP_PAIR 이상)를 가진 타이트 캐릭터가
    // 10% 확률로 레이즈 대신 체크/콜로 트랩 (체크-레이즈 유도)
    // 주로 tightness가 높은 캐릭터에게 발동
    const tightness = 1 - persona.vpip; // vpip가 낮을수록 타이트
    const isStrongHand = tier >= HandTier.TOP_PAIR;
    const canTrap = !position?.isOOP && isStrongHand && tightness > 0.5 && Math.random() < 0.10;
    if (canTrap) {
      // 레이즈 액션(2,3,4)의 가중치를 낮추고 콜/체크(1)로 유도
      logits[2] -= 3.0;
      logits[3] -= 3.0;
      logits[4] -= 4.0;
      logits[1] += 2.0; // 콜/체크 부스트
    }

    // 4) 팟 오즈 실시간 대조: 승률이 팟 오즈보다 낮으면 Fold 가중치 대폭 상승
    if (callAmount > 0 && multiEq < potOdds) {
      const gap = (potOdds - multiEq) * 6.5;
      logits[0] += gap;     // FOLD 상승
      logits[1] -= gap;     // CALL 하락
    }

    // Evaluate called downside before rake before sampling larger bets/all-ins.
    // The anchor still supplies mixed bluffing; this is not a solver.
    if(context) {
      const targets=[0,Math.min(callAmount,myStack),
        Math.min(maxRaise,Math.max(minRaise,Math.floor(callAmount>0?(myCurrentBet+callAmount)*2:minRaise+pot*0.6))),
        Math.min(maxRaise,Math.max(minRaise,Math.floor(minRaise+pot))),maxRaise];
      for(let i=1;i<5;i++) {
        const cost=i===1?targets[i]:Math.max(0,targets[i]-myCurrentBet);
        const ev=i===1 ? modeledCallEV(hole,board,context,Math.min(cost,myStack))
          : calledActionEV(hole,board,context,Math.min(cost,myStack));
        logits[i]+=Math.max(-3,Math.min(1,ev/Math.max(pot,cost,1)*3));
        if(i===4 && cost>pot && ev<0)logits[i]-=3;
        if(i===4 && (context.stack?.ownStack ?? Infinity)<=5000 && tier>=HandTier.TOP_PAIR && ev>0) {
          logits[4]+=1.2;
          logits[1]-=0.5;
        }
      }
    }

    // 5) 하드 룰 마스킹 (콜 고착화 원천 차단!)
    const canRaise = maxRaise > myCurrentBet+callAmount && myStack>callAmount && raiseLevel < 4;
    const mask = [true, true, canRaise, canRaise, canRaise];
    if (callAmount === 0) {
      mask[0] = false; // 체크 가능하면 폴드 금지
    }
    // ★ 핵심: 베팅/레이즈 직면 시 노히트(AIR) 또는 레이즈 직면 노페어(OVERCARDS)는 단순 콜(1) 원천 금지!
    if (callAmount > 0 && (tier === HandTier.AIR || (tier === HandTier.OVERCARDS && pressure >= 2))) {
      mask[1] = false;
    }
    // Preflop "AIR" is not postflop air (e.g. AJo/QTo). Keep a priced flat
    // available to suitable broadways, pairs and suited aces. Connector and
    // rare-low entry caps remain owned by planPreflop, never bypassed here.
    if(board.length===0&&raiseLevel>0&&callAmount>0&&callAmount<myStack) {
      const ranks=hole.map(c=>'23456789TJQKA'.indexOf(c.rank)+2).sort((a,b)=>b-a);
      const [high,low]=ranks,suited=hole[0].suit===hole[1].suit;
      const flatHand=high===low||(high===14&&low>=10)||(suited&&high===14&&low>=5)
        ||(high>=12&&low>=10)||(suited&&high>=10&&low>=9);
      if(flatHand&&multiEq>=potOdds&&callAmount<=(context?.stack?.ownStack??myStack)*.20) {
        mask[1]=true;
        logits[1]=Math.max(logits[1],.10+persona.vpip*1.8-persona.aggression*.8);
      }
    }
    if(context?.forbidLimp&&board.length===0&&callAmount>0)mask[1]=false;
    if(board.length>0&&context?.position?.checkedThisStreet&&callAmount>0) {
      const defend=multiEq>=checkCallEquityRequired(persona,potOdds);
      if(defend&&callAmount<=pot*0.30&&persona.vpip>=0.45) {
        mask[1]=true;
        logits[1]=Math.max(logits[1],0.8+(persona.vpip-0.45)*2);
      } else if(!defend) {logits[0]+=0.5;logits[1]-=0.5;}
    }

    // Aggressive personas mix weak-hand raises explicitly. Large-pressure spots
    // and dry side pots are excluded; normal value decisions retain their EV policy.
    const weakHand = tier <= HandTier.OVERCARDS;
    const hasOpponent = !context || hasBettingOpponent(context.seats, context.actorId);
    const barrel=board.length===4&&context?.initiative===true;
    const bluffEligible = (persona.aggression > 0.7||barrel) && weakHand && canRaise && pressure < 3 && hasOpponent;
    let bluffRate=(context?.stack?.ownStack ?? Infinity)<=5000 ? persona.bluffFreq : bluffFrequency(persona);
    if(barrel)bluffRate=Math.min(bluffRate,persona.aggression>=0.70?0.35:persona.aggression>=0.40?0.15:0.02);
    const attemptBluff = bluffEligible && Math.random() < bluffRate * (position?.isOOP ? 0.4 + persona.aggression * 0.3 : 1);
    if (bluffEligible) {
      mask[2] = false;
      mask[3] = false;
      mask[4] = false;
    }

    // 6) Softmax 확률 추출
    const expVals = logits.map((v, i) => {
      if (!mask[i] || v < -50) return 0;
      return Math.exp(Math.max(-6, Math.min(6, v)));
    });
    const tot = expVals.reduce((s, v) => s + v, 0);

    let actIdx: number;
    if (tot <= 0) {
      actIdx = (callAmount > 0) ? 0 : 1;
    } else {
      // 가중치 기반 샘플링
      let r = Math.random() * tot;
      actIdx = 0;
      for (let i = 0; i < 5; i++) {
        r -= expVals[i];
        if (r <= 0) { actIdx = i; break; }
      }
    }

    if (attemptBluff) actIdx = 2; // Prefer a standard sized raise for the explicit bluff mix.

    // 7) 금액 계산
    let amount = 0;
    let isBluff = false;
    switch (actIdx) {
      case 0: // FOLD
        amount = 0;
        break;
      case 1: // CHECK_OR_CALL
        amount = Math.min(callAmount, myStack);
        break;
      case 2: { // RAISE_STD (2x)
        const baseTo = callAmount > 0
          ? (myCurrentBet + callAmount) * 2
          : (minRaise + pot * 0.6);
        amount = Math.min(maxRaise, Math.max(minRaise, Math.floor(baseTo)));
        if (tier <= HandTier.OVERCARDS) isBluff = true;
        break;
      }
      case 3: { // RERAISE_POT (3-Bet)
        const target = minRaise + pot * 1.0;
        amount = Math.min(maxRaise, Math.max(minRaise, Math.floor(target)));
        if (tier <= HandTier.DRAW) isBluff = true;
        break;
      }
      case 4: // ALL_IN
        amount = maxRaise;
        if (tier < HandTier.TOP_PAIR) isBluff = true;
        break;
    }

    return { action: actIdx, amount, isBluff, tier };
  }

  /**
   * Warm-Start 앵커 로짓 (Python _get_warm_start_anchor와 동일)
   * 5개 액션: [Fold, Call, Raise_Std, Reraise_Pot, All_In]
   * pressure: 0=체크가능, 1=블라인드/소액벳, 2=레이즈직면, 3=리레이즈(3Bet+)/큰압박 직면
   */
  private _getWarmStartAnchor(
    pressure: number,
    tier: number,
    persona: { vpip: number; aggression: number; bluffFreq: number }
  ): number[] {
    const t = (1 - persona.vpip); // tightness = 1 - vpip
    const a = persona.aggression;
    const b = persona.bluffFreq;

    // 1) 체크 가능한 무료 상황 (pressure === 0)
    if (pressure === 0) {
      if (tier === HandTier.AIR) {
        return [-99, 2.2, -0.4 + b * 2.0, -2.0 + b * 1.2, -99];
      }
      if (tier === HandTier.OVERCARDS || tier === HandTier.WEAK_PAIR) {
        return [-99, 2.0, 0.4 + a * 0.8, -1.5, -99];
      }
      if (tier === HandTier.DRAW) {
        return [-99, 1.1, 1.6 + a * 1.2, 0.5 + a * 1.0, -99];
      }
      if (tier === HandTier.TOP_PAIR) {
        return [-99, 0.5, 2.5 + a * 1.0, 1.1 + a * 0.8, -2.5];
      }
      // TWO_PAIR_PLUS, MONSTER
      return [-99, 0.2, 2.2 + a, 2.8 + a * 1.5, 0.8 + a];
    }

    // 2) 상대 베팅/레이즈에 직면한 상황 (pressure 1, 2, 3)
    if (tier === HandTier.AIR) {
      // ★ 핵심: 노히트(AIR)는 상대 베팅/레이즈에 절대 CALL(-99) 하지 않음!
      const bluffQ = (b * 2) - (pressure * 1.1) - (t * 0.9);
      return [3.2 + t * 2.0, -99, bluffQ, -99, -99];
    }
    if (tier === HandTier.OVERCARDS) {
      if (pressure === 1) {
        return [1.3 + t, 0.9 - t * 0.5, -0.6 + b, -99, -99];
      }
      // 레이즈(P2, P3) 직면 시 노페어 오버카드는 콜 금지 → 칼폴드!
      return [3.4 + t, -99, -1.0 + b, -99, -99];
    }
    if (tier === HandTier.WEAK_PAIR) {
      if (pressure === 1) {
        return [0.4 + t * 0.8, 1.7, -0.8, -99, -99];
      }
      if (pressure === 2) {
        // 상대 레이즈(P2)에 바텀/미들페어는 대부분 폴드!
        return [2.2 + t * 1.4, 0.1 - t * 0.6, -1.8, -99, -99];
      }
      return [3.8, -99, -99, -99, -99];
    }
    if (tier === HandTier.DRAW) {
      // 플러시/스트레이트 드로우: 콜 또는 공격적인 세미블러프 리레이즈!
      if (pressure <= 2) {
        return [0.3 + t * 0.5, 1.5, 1.4 + a * 1.4, 0.4 + a * 1.0, -2.0];
      }
      return [1.8 + t, 0.5, -0.4 + a * 0.5, -2.0, -2.0];
    }
    if (tier === HandTier.TOP_PAIR) {
      // 탑페어: 레이즈에 콜 또는 리레이즈(2, 3번 액션)로 맞불!
      if (pressure <= 2) {
        return [-0.4 + t * 0.5, 1.8, 1.5 + a * 1.2, 0.4 + a * 0.8, -1.8];
      }
      return [1.3 + t * 0.9, 0.9, -0.1 + a * 0.6, -1.0, -1.5];
    }
    if (tier === HandTier.TWO_PAIR_PLUS) {
      // 투페어 / 오버페어(JJ~AA): 적극적 리레이즈 주력!
      if (pressure <= 2) {
        return [-99, 1.0, 2.5 + a * 1.2, 1.9 + a * 1.2, -0.2 + a];
      }
      return [0.1 + t * 0.4, 1.3, 1.6 + a, 1.3 + a, 0.5 + a];
    }
    // MONSTER (셋, 스트레이트, 플러시 이상): 강력한 리레이즈 & 올인!
    return [-99, 0.7, 2.2 + a, 2.9 + a * 1.5, 2.0 + a * 1.5];
  }

  /**
   * 좌석 인덱스로부터 포지션 계산
   * 8인 테이블 기준: BTN, SB, BB, UTG, UTG+1, MP, MP+1, CO
   * @returns 포지션 이름
   */
  private _getPosition(seatIndex: number, buttonSeat: number, numSeats: number): string {
    const offset = (seatIndex - buttonSeat + numSeats) % numSeats;
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
      if (offset === 3) return "UTG";
      if (offset === 4) return "MP";
      if (offset === 5) return "CO";
    }
    return "MP";
  }

  /**
   * 포지션 이점 점수 (0.0 ~ 1.0)
   * BTN이 가장 유리(1.0), UTG가 가장 불리(0.0)
   */
  private _getPositionAdvantage(position: string): number {
    switch (position) {
      case "BTN": return 1.0;
      case "CO":  return 0.8;
      case "MP2": return 0.6;
      case "MP1": return 0.5;
      case "MP":  return 0.4;
      case "UTG1": return 0.3;
      case "UTG": return 0.2;
      case "BB":  return 0.5;
      case "SB":  return 0.3;
      default:    return 0.4;
    }
  }

  // _heuristicDecide, _classifyHandTier(구버전) 제거됨
  // 새로운 classifyHandTier (equity-engine.ts) 사용
}
