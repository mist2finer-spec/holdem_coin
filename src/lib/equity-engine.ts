// ============================================================
// 에퀴티 엔진 (1단계 수학적 해결책) - Python 코드 포팅
// - _eval_preflop_169: 첸 공식 기반 169 핸드 티어 (0.05 ~ 0.99)
// - _eval_postflop_real_equity: 보드 페어 착시 제거한 실제 에퀴티
// - 다자간 승률 감쇠 (multiwayEquity)
// - 8차원 신경망 입력 벡터 추출 (extractStateVector)
// - 7단계 핸드 티어 분류 (AIR/OVERCARDS/DRAW/WEAK_PAIR/TOP_PAIR/TWO_PAIR_PLUS/MONSTER)
// ============================================================

import { Card } from "./poker-engine";

const RANKS = "23456789TJQKA";

// ============================================================
// 7단계 핸드 티어 (Python의 HandTier와 매칭)
// ============================================================
export const HandTier = {
  AIR: 0,            // 노히트 & 노드로우
  OVERCARDS: 1,      // 보드보다 높은 오버카드
  DRAW: 2,           // 4플러시/4스트레이트 드로우
  WEAK_PAIR: 3,      // 바텀/미들 페어, 언더 포켓
  TOP_PAIR: 4,       // 탑 페어
  TWO_PAIR_PLUS: 5,  // 오버페어(JJ~AA) 또는 진짜 투페어
  MONSTER: 6,        // 셋/스트레이트/플러시/풀하우스+
} as const;

export const HandTierNames: Record<number, string> = {
  0: "AIR(노히트)",
  1: "OVERCARDS(오버카드)",
  2: "DRAW(드로우)",
  3: "WEAK_PAIR(약페어)",
  4: "TOP_PAIR(탑페어)",
  5: "TWO_PAIR+(투페어/오버페어)",
  6: "MONSTER(몬스터)",
};

/**
 * 새로운 정밀 핸드 티어 분류 (Python evaluate_hand와 동일 로직)
 * - 드로우 감지 (플러시/스트레이트)
 * - 보드 페어 착시 완벽 제거 (rankCounts[r] >= 2 조건)
 * - 오버카드 감지
 * @returns {tier, rawEquity}
 */
export function classifyHandTier(hole: Card[], board: Card[]): { tier: number; rawEquity: number } {
  if (hole.length < 2) return { tier: HandTier.AIR, rawEquity: 0.10 };

  const h = hole.map(c => ({ rankIdx: RANKS.indexOf(c.rank), suit: c.suit }));
  const hRanks = h.map(x => x.rankIdx).sort((a, b) => b - a);
  const suited = h[0].suit === h[1].suit;

  // [A] 프리플랍 평가
  if (board.length === 0) {
    const high = hRanks[0];
    const low = hRanks[1];
    const gap = high - low;
    if (high === low) {
      // 포켓 페어
      if (high >= RANKS.indexOf("J")) return { tier: HandTier.MONSTER, rawEquity: 0.82 };       // JJ~AA
      if (high >= RANKS.indexOf("8")) return { tier: HandTier.TWO_PAIR_PLUS, rawEquity: 0.70 }; // 88~TT
      if (high >= RANKS.indexOf("5")) return { tier: HandTier.TOP_PAIR, rawEquity: 0.60 };      // 55~77
      return { tier: HandTier.WEAK_PAIR, rawEquity: 0.52 };                                     // 22~44
    }
    if (high === RANKS.indexOf("A") && low >= RANKS.indexOf("Q")) {
      return { tier: HandTier.TWO_PAIR_PLUS, rawEquity: suited ? 0.68 : 0.65 }; // AQ+
    }
    if (high >= RANKS.indexOf("K") && low >= RANKS.indexOf("T")) {
      return { tier: HandTier.TOP_PAIR, rawEquity: suited ? 0.60 : 0.56 }; // KT+
    }
    if (suited && (high === RANKS.indexOf("A") || (gap <= 2 && low >= RANKS.indexOf("6")))) {
      return { tier: HandTier.DRAW, rawEquity: 0.50 }; // suited connectors/Axs
    }
    if (suited || (gap === 1 && low >= RANKS.indexOf("8"))) {
      return { tier: HandTier.OVERCARDS, rawEquity: 0.42 };
    }
    return { tier: HandTier.AIR, rawEquity: 0.22 };
  }

  // [B] 포스트플랍 평가
  const b = board.map(c => ({ rankIdx: RANKS.indexOf(c.rank), suit: c.suit }));
  const bRanks = b.map(x => x.rankIdx).sort((a, b) => b - a);
  const allRanks = [...hRanks, ...bRanks];

  // 1) 플러시 및 플러시 드로우
  const suitCnt: Record<string, number> = {};
  const holeSuits = new Set(h.map(x => x.suit));
  for (const x of [...h, ...b]) {
    suitCnt[x.suit] = (suitCnt[x.suit] || 0) + 1;
  }
  const hasFlush = Object.entries(suitCnt).some(([s, cnt]) => cnt >= 5 && holeSuits.has(s));
  const hasFlushDraw = board.length < 5 && Object.entries(suitCnt).some(([s, cnt]) => cnt === 4 && holeSuits.has(s));

  // 2) 스트레이트 및 스트레이트 드로우
  const uRanks = new Set(allRanks);
  if (uRanks.has(12)) uRanks.add(-1); // A-2-3-4-5 wheel
  let maxSeq = 0;
  for (let start = -1; start <= 9; start++) {
    const win = new Set([start, start + 1, start + 2, start + 3, start + 4]);
    const overlap = [...uRanks].filter(r => win.has(r));
    if (overlap.some(r => hRanks.includes(r) || (r === -1 && hRanks.includes(12)))) {
      maxSeq = Math.max(maxSeq, overlap.length);
    }
  }
  const hasStraight = maxSeq === 5;
  const hasStraightDraw = board.length < 5 && maxSeq === 4;

  // 3) 페어/트립스 히트 판별 (★버그 수정된 로직)
  const totRc: Record<number, number> = {};
  const brdRc: Record<number, number> = {};
  for (const r of allRanks) totRc[r] = (totRc[r] || 0) + 1;
  for (const r of bRanks) brdRc[r] = (brdRc[r] || 0) + 1;

  // 내 홀카드가 개입하여 최소 2장 이상(페어 이상)이 된 랭크만 추출
  const myPairedRanks = [...new Set(hRanks)].filter(
    r => totRc[r] >= 2 && totRc[r] > (brdRc[r] || 0)
  );

  // 몬스터: 플러시, 스트레이트, 셋/트립스/포카드
  if (hasFlush || hasStraight || myPairedRanks.some(r => totRc[r] >= 3)) {
    return { tier: HandTier.MONSTER, rawEquity: 0.92 };
  }

  // 투페어(내 손패 2장이 모두 페어 형성) 또는 오버페어
  if (myPairedRanks.length >= 2) {
    return { tier: HandTier.TWO_PAIR_PLUS, rawEquity: 0.84 };
  }
  if (hRanks[0] === hRanks[1] && hRanks[0] > bRanks[0]) {
    return { tier: HandTier.TWO_PAIR_PLUS, rawEquity: 0.80 }; // 오버페어
  }

  // 원페어 히트
  if (myPairedRanks.length === 1) {
    const hitR = myPairedRanks[0];
    if (hitR >= bRanks[0]) {
      // 탑페어 (킥커 보정)
      const kicker = hRanks[1] === hitR ? hRanks[0] : hRanks[1];
      return { tier: HandTier.TOP_PAIR, rawEquity: 0.68 + (kicker / 12.0) * 0.08 };
    }
    // 미들/바텀페어지만 드로우 겹치면 DRAW 등급
    if (hasFlushDraw || hasStraightDraw) {
      return { tier: HandTier.DRAW, rawEquity: 0.56 };
    }
    return { tier: HandTier.WEAK_PAIR, rawEquity: 0.36 };
  }

  // 보드보다 낮은 언더 포켓페어
  if (hRanks[0] === hRanks[1]) {
    return { tier: HandTier.WEAK_PAIR, rawEquity: 0.34 };
  }

  // 노페어지만 드로우 보유
  if (hasFlushDraw || hasStraightDraw) {
    return { tier: HandTier.DRAW, rawEquity: 0.52 };
  }

  // 노페어지만 보드 최고 카드보다 높은 오버카드 2장
  if (board.length < 5 && hRanks[1] > bRanks[0] && hRanks[0] >= RANKS.indexOf("Q")) {
    return { tier: HandTier.OVERCARDS, rawEquity: 0.28 };
  }

  // ★ 순수 에어 (승률 0.08)
  return { tier: HandTier.AIR, rawEquity: 0.08 };
}

/**
 * 프리플랍 169 핸드 평가 (Chen Formula 변형)
 * 포켓 페어: 22(0.58) ~ AA(0.99)
 * 비페어: 스원트/커넥터 가산, 갭 페널티
 */
export function evalPreflop169(hole: Card[]): number {
  if (hole.length < 2) return 0.2;
  const r1 = RANKS.indexOf(hole[0].rank);
  const r2 = RANKS.indexOf(hole[1].rank);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = hole[0].suit === hole[1].suit;
  const gap = high - low;

  // 포켓 페어
  if (high === low) {
    return 0.58 + (high / 12.0) * 0.41;
  }

  // 비페어
  let score = (high * 0.045) + (low * 0.018);
  if (suited) score += 0.08;
  if (gap === 1) score += 0.05;
  else if (gap === 2) score += 0.02;
  else if (gap >= 4) score -= 0.06;

  return Math.max(0.05, Math.min(0.92, score));
}

/**
 * 포스트플랍 실제 에퀴티 추산 (보드 페어 착시 제거)
 * 핵심: 내 손팠가 기여한 족보만 인정 (board_only_counts와 비교)
 */
export function evalPostflopRealEquity(hole: Card[], board: Card[]): number {
  if (hole.length < 2 || board.length === 0) return 0.2;

  const holeRanks = hole.map(c => RANKS.indexOf(c.rank)).sort((a, b) => b - a);
  const boardRanks = board.map(c => RANKS.indexOf(c.rank)).sort((a, b) => b - a);
  const allCards = [...hole, ...board];

  // 수트 카운트 (플러시 드로우/메이드 플러시)
  const suitCounts: Record<string, number> = {};
  for (const c of allCards) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  const holeSuits = new Set(hole.map(c => c.suit));
  const hasFlushDraw = Object.entries(suitCounts).some(
    ([s, cnt]) => cnt === 4 && holeSuits.has(s)
  );
  const hasMadeFlush = Object.entries(suitCounts).some(
    ([s, cnt]) => cnt >= 5 && holeSuits.has(s)
  );

  // 랭크 카운트 (내 패 + 보드)
  const rankCounts: Record<number, number> = {};
  for (const r of [...holeRanks, ...boardRanks]) {
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  // 보드 전용 카운트 (착시 방지용)
  const boardOnlyCounts: Record<number, number> = {};
  for (const r of boardRanks) {
    boardOnlyCounts[r] = (boardOnlyCounts[r] || 0) + 1;
  }

  // 내가 기여한 매치 (보드 자체 페어 제거)
  // ★ 핵심 버그 수정: rankCounts[r] >= 2 조건 필수!
  // 이전 코드는 rankCounts[r] > boardOnlyCounts[r] 만 검사해서
  // 내 홀카드 7♣(1장) vs 보드에 7 없음(0장) → 1 > 0 = TRUE 가 되어
  // 노히트 AIR 패도 투페어로 둔갑하는 치명적 버그가 있었음.
  // 수정: 내 홀카드가 실제로 페어(2장 이상)를 완성한 랭크만 매치로 인정
  const myMatches = [...new Set(holeRanks)].filter(
    r => rankCounts[r] >= 2 && rankCounts[r] > (boardOnlyCounts[r] || 0)
  );

  let baseEq: number;

  // 1) 포카드
  if (holeRanks.some(r => rankCounts[r] === 4)) {
    baseEq = 0.98;
  } else if (hasMadeFlush) {
    baseEq = 0.90;
  } else if (holeRanks.some(r => rankCounts[r] === 3)) {
    // 트립스/셋
    baseEq = 0.86;
  } else if (myMatches.length >= 2 || (holeRanks[0] === holeRanks[1] && holeRanks[0] > boardRanks[0])) {
    // 진짜 투페어 or 오버페어
    baseEq = myMatches.length >= 2 ? 0.78 : 0.74;
  } else if (myMatches.length === 1) {
    const matchedRank = myMatches[0];
    if (matchedRank >= boardRanks[0]) {
      // 탑페어 (킥커 보정)
      const kicker = holeRanks[1] === matchedRank ? holeRanks[0] : holeRanks[1];
      baseEq = 0.62 + (kicker / 12.0) * 0.10;
    } else if (matchedRank >= boardRanks[Math.floor(boardRanks.length / 2)]) {
      baseEq = 0.44; // 미들페어
    } else {
      baseEq = 0.30; // 바텀페어
    }
  } else if (holeRanks[0] === holeRanks[1]) {
    baseEq = 0.34; // 언더페어
  } else {
    baseEq = 0.12 + (holeRanks[0] / 12.0) * 0.08; // 하이카드 (Air)
  }

  // 플러시 드로우 보너스 (플랍/턴에서만)
  if (board.length < 5 && hasFlushDraw && baseEq < 0.80) {
    baseEq += 0.18;
  }

  return Math.min(0.99, baseEq);
}

/**
 * 다자간 승률 감쇠: 생존 적이 많을수록 원페어 가치 폭락
 * Equity_multi = Equity_1v1 ^ (1 + (N-1) * 0.35)
 */
export function multiwayEquity(rawEquity: number, activeOpponents: number): number {
  const n = Math.max(1, activeOpponents);
  return Math.pow(rawEquity, 1.0 + (n - 1) * 0.35);
}

/**
 * 8차원 신경망 입력 벡터 추출
 * 0: multiwayEq   - 다자간 보정 승률
 * 1: potOdds      - 콜에 필요한 최소 승률
 * 2: eqMargin     - multiwayEq - potOdds (핵심 피처)
 * 3: spr          - Stack-to-Pot Ratio (정규화)
 * 4: activeOppRatio - 생존 적 비율
 * 5: streetProgress - 프리플랍(0) ~ 리버(1)
 * 6: positionScore - 포지션 (SB=0 ~ BTN=1)
 * 7: facingRaiseLevel - 현재 라운드 레이즈 과열도
 */
export interface StateVector {
  multiwayEq: number;
  potOdds: number;
  eqMargin: number;
  spr: number;
  activeOppRatio: number;
  streetProgress: number;
  positionScore: number;
  facingRaiseLevel: number;
}

export function extractStateVector(
  equity: number,
  callAmount: number,
  pot: number,
  myStack: number,
  activeOpponents: number,
  boardLength: number,
  seatIndex: number,
  numSeats: number,
  raiseLevel: number
): number[] {
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0.0;
  const multiwayEq = multiwayEquity(equity, activeOpponents);
  const eqMargin = multiwayEq - potOdds;
  const spr = Math.min(1.0, (myStack / Math.max(pot, 1)) / 20.0);
  const activeOppRatio = Math.min(1.0, activeOpponents / 7.0);
  const streetProgress =
    boardLength === 0 ? 0.0 :
    boardLength === 3 ? 0.33 :
    boardLength === 4 ? 0.66 : 1.0;
  const positionScore = seatIndex / Math.max(1, numSeats - 1);
  const facingRaiseLevel = Math.min(1.0, raiseLevel / 4.0);

  return [
    multiwayEq,
    potOdds,
    eqMargin,
    spr,
    activeOppRatio,
    streetProgress,
    positionScore,
    facingRaiseLevel,
  ];
}

/**
 * 휴리스틱 결정 (1단계 폴백용) - Python의 RPGBotDecisionMaker와 동일 로직
 * 신경망이 학습되기 전 초기 상태에서 사용
 */
export function heuristicDecide(
  hole: Card[],
  board: Card[],
  callAmount: number,
  minRaise: number,
  maxRaise: number,
  pot: number,
  myStack: number,
  myCurrentBet: number,
  activeOpponents: number,
  vpip: number,
  aggression: number,
  bluffFreq: number
): { action: number; amount: number; isBluff?: boolean } {
  const equity = board.length === 0
    ? evalPreflop169(hole)
    : evalPostflopRealEquity(hole, board);

  // === 프리플랍 ===
  if (board.length === 0) {
    const preflopScore = equity;

    if (callAmount === 0) {
      if (preflopScore > (0.85 - aggression * 0.25) && maxRaise > minRaise) {
        const raiseTo = Math.min(maxRaise, Math.max(minRaise, Math.floor(pot * 2.5)));
        return { action: 2, amount: raiseTo };
      }
      return { action: 1, amount: 0 }; // check
    }

    const betPressure = Math.min(0.40, (callAmount / (myStack + callAmount)) * 0.65);
    let requiredScore = (1.0 - vpip) + betPressure;

    if (myCurrentBet > 200) {
      requiredScore = Math.max(requiredScore, 0.78 - (aggression * 0.1));
    }

    if (preflopScore < requiredScore) {
      return { action: 0, amount: 0 }; // fold
    }

    const isHeavyAction = callAmount > myStack * 0.25;
    const raiseThreshold = isHeavyAction ? 0.92 : (0.82 - aggression * 0.15);

    if (preflopScore >= raiseThreshold && maxRaise > minRaise && Math.random() < aggression) {
      const raiseTo = Math.floor(minRaise + pot * 0.8);
      const clamped = Math.max(minRaise, Math.min(raiseTo, maxRaise));
      return { action: 2, amount: clamped };
    }

    return { action: 1, amount: Math.min(callAmount, myStack) }; // call
  }

  // === 포스트플랍 ===
  const rawEquity = equity;
  const multiEq = multiwayEquity(rawEquity, activeOpponents);

  const canTryBluff = (myCurrentBet === 0 && callAmount <= pot * 0.35 && activeOpponents <= 2);
  const isBluffing = canTryBluff && (Math.random() < bluffFreq * 0.4);

  if (callAmount === 0) {
    if ((multiEq > 0.62 || isBluffing) && maxRaise > minRaise && Math.random() < aggression) {
      const betSize = Math.floor(pot * (0.45 + 0.3 * aggression));
      const clamped = Math.max(minRaise, Math.min(betSize, maxRaise));
      return { action: 2, amount: clamped, isBluff };
    }
    return { action: 1, amount: 0 }; // check
  }

  const potOdds = callAmount / (pot + callAmount);
  const stackCommitment = callAmount / (myStack + callAmount);
  let safetyMargin = stackCommitment * 0.22 * (1.2 - vpip);

  if (myCurrentBet > 0) safetyMargin += 0.15;

  const requiredEquity = potOdds + safetyMargin;

  if (multiEq < requiredEquity) {
    return { action: 0, amount: 0 }; // fold
  }

  const raiseEqNeeded = stackCommitment > 0.3 ? 0.82 : (0.74 - aggression * 0.1);
  if (multiEq >= raiseEqNeeded && maxRaise > minRaise && Math.random() < (aggression * 0.7)) {
    const raiseTo = Math.floor(minRaise + pot * 0.65);
    const clamped = Math.max(minRaise, Math.min(raiseTo, maxRaise));
    return { action: 2, amount: clamped };
  }

  return { action: 1, amount: Math.min(callAmount, myStack) }; // call
}
