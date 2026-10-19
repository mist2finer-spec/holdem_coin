// 경량 텍사스 홀덤 엔진 (프로토타입용 - 클라이언트 사이드 시뮬레이션)
import { BotPersona } from "./personas";

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type ActionType = "fold" | "check" | "call" | "raise" | "allin";

export interface PlayerAction {
  seatId: number;
  name: string;
  action: ActionType;
  amount: number;
  isBluff?: boolean;
}

export interface SeatState {
  seatId: number;
  name: string;
  isBot: boolean;
  isUser: boolean;
  persona?: BotPersona;
  stack: number;
  currentBet: number;
  totalBet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  lastAction?: PlayerAction;
  hasActed: boolean;
}

export type Phase = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  // Fisher-Yates 셔플
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardLabel(c: Card): string {
  const r = c.rank === "T" ? "10" : c.rank;
  return `${r}${c.suit}`;
}

export function cardColor(c: Card): string {
  return c.suit === "♥" || c.suit === "♦" ? "text-rose-500" : "text-slate-900";
}

// ==========================================
// 핸드 강도 평가 (간단 휴리스틱)
// ==========================================
const RANK_VAL: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

export function estimateStrength(hole: Card[], board: Card[]): number {
  if (hole.length < 2) return 0.3;
  const r1 = RANK_VAL[hole[0].rank];
  const r2 = RANK_VAL[hole[1].rank];
  const suited = hole[0].suit === hole[1].suit;

  if (board.length === 0) {
    let base = (Math.max(r1, r2) + Math.min(r1, r2) * 0.5) / 18.0;
    if (r1 === r2) base = Math.max(0.55, base + 0.35);
    if (suited) base += 0.06;
    return Math.min(1.0, base);
  }

  // 포스트플랍: 족보 추산
  const allCards = [...hole, ...board];
  const ranks = allCards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
  const suits = allCards.map(c => c.suit);
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCounts));

  const rankCounts: Record<number, number> = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  // 스트레이트 검사
  const uniqueRanks = [...new Set(ranks)];
  let isStraight = false;
  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
        isStraight = true;
        break;
      }
    }
    // A-2-3-4-5 (wheel)
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
      isStraight = true;
    }
  }

  if (isStraight && maxSuit >= 5) return 0.99; // 스트레이트 플러시
  if (counts[0] === 4) return 0.98;             // 포카드
  if (counts[0] === 3 && counts[1] >= 2) return 0.92; // 풀하우스
  if (maxSuit >= 5) return 0.88;                // 플러시
  if (isStraight) return 0.82;                   // 스트레이트
  if (counts[0] === 3) return 0.72;              // 트리플
  if (counts[0] === 2 && counts[1] === 2) return 0.62; // 투페어
  if (counts[0] === 2) {
    // 페어 강도 - 높은 페어일수록 강함
    const pairRank = Number(Object.keys(rankCounts).find(k => rankCounts[Number(k)] === 2));
    if (pairRank >= 11) return 0.58;
    return 0.45;
  }
  // 하이카드
  if (ranks[0] >= 13) return 0.30;
  return 0.20;
}

// ==========================================
// 봇 의사결정 (Python 코드와 동일한 로직)
// ==========================================
export function botDecide(
  seat: SeatState,
  callAmount: number,
  minRaise: number,
  maxRaise: number,
  pot: number,
  board: Card[]
): { action: ActionType; amount: number; isBluff?: boolean } {
  const persona = seat.persona!;
  const strength = estimateStrength(seat.holeCards, board);
  let effectiveStrength = strength;
  const isBluff = Math.random() < persona.bluffFreq;
  if (isBluff) effectiveStrength = Math.min(1.0, strength + 0.45);

  // 1) 체크 가능
  if (callAmount === 0) {
    if (effectiveStrength > (1.0 - persona.aggression) && maxRaise > minRaise) {
      let betSize = Math.floor(minRaise + (pot * 0.5 * persona.aggression));
      betSize = Math.max(minRaise, Math.min(betSize, maxRaise));
      if (betSize >= seat.stack) {
        return { action: "allin", amount: seat.stack };
      }
      return { action: "raise", amount: betSize, isBluff };
    }
    return { action: "check", amount: 0 };
  }

  // 2) 콜 비용 있음: 팟 오즈와 성향 비교
  const potOdds = callAmount / (pot + callAmount);
  const threshold = potOdds * (1.1 - persona.vpip * 0.5);

  if (effectiveStrength < threshold) {
    return { action: "fold", amount: 0 };
  }

  if (effectiveStrength > 0.75 && Math.random() < persona.aggression && maxRaise > minRaise) {
    let raiseTo = Math.floor(minRaise + (pot * 0.75));
    raiseTo = Math.max(minRaise, Math.min(raiseTo, maxRaise));
    if (raiseTo >= seat.stack) {
      return { action: "allin", amount: seat.stack };
    }
    return { action: "raise", amount: raiseTo, isBluff };
  }

  // 콜
  const callCost = Math.min(callAmount, seat.stack);
  if (callCost >= seat.stack) {
    return { action: "allin", amount: seat.stack };
  }
  return { action: "call", amount: callCost };
}

// ==========================================
// 핸드 랭크 이름 (쇼다운용)
// ==========================================
export function handRankName(hole: Card[], board: Card[]): string {
  if (hole.length < 2 || board.length < 3) return "";
  const allCards = [...hole, ...board];
  const ranks = allCards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
  const suits = allCards.map(c => c.suit);
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCounts));

  const rankCounts: Record<number, number> = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  const uniqueRanks = [...new Set(ranks)];
  let isStraight = false;
  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
        isStraight = true;
        break;
      }
    }
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
      isStraight = true;
    }
  }

  if (isStraight && maxSuit >= 5) return "스트레이트 플러시";
  if (counts[0] === 4) return "포카드";
  if (counts[0] === 3 && counts[1] >= 2) return "풀하우스";
  if (maxSuit >= 5) return "플러시";
  if (isStraight) return "스트레이트";
  if (counts[0] === 3) return "트리플";
  if (counts[0] === 2 && counts[1] === 2) return "투페어";
  if (counts[0] === 2) return "원페어";
  return "하이카드";
}
