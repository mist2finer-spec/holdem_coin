// 핸드 평가기 단위 테스트 - AK vs K5 시나리오 검증
import { evaluateBestHand, scoreToCategoryName, determineWinners } from "../src/lib/poker-engine";

interface Card {
  rank: string;
  suit: string;
}

function c(rank: string, suit: string): Card {
  return { rank, suit };
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${(e as Error).message}`);
    process.exit(1);
  }
}

function assertEqual(a: number, b: number, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

function assertGreaterThan(a: number, b: number, msg: string) {
  if (!(a > b)) throw new Error(`${msg}: expected ${a} > ${b}`);
}

console.log("=== 텍사스 홀덤 7카드 평가기 테스트 ===\n");

test("AK vs K5 on K-7-5-2-9: K5 투페어 > AK 원페어", () => {
  const board = [c("K", "♠"), c("7", "♥"), c("5", "♦"), c("2", "♣"), c("9", "♠")];
  const ak = [c("A", "♥"), c("K", "♦")];
  const k5 = [c("K", "♣"), c("5", "♠")];

  const akScore = evaluateBestHand(ak, board);
  const k5Score = evaluateBestHand(k5, board);

  console.log(`  AK 점수: ${akScore} (${scoreToCategoryName(akScore)})`);
  console.log(`  K5 점수: ${k5Score} (${scoreToCategoryName(k5Score)})`);

  assertGreaterThan(k5Score, akScore, "K5 투페어가 AK 원페어보다 강해야 함");
  console.log(`  → K5 승리 확인 ✓`);
});

test("AA vs KK on Q-7-3-9-2: AA > KK", () => {
  const board = [c("Q", "♠"), c("7", "♥"), c("3", "♦"), c("9", "♣"), c("2", "♠")];
  const aa = [c("A", "♥"), c("A", "♦")];
  const kk = [c("K", "♣"), c("K", "♠")];

  const aaScore = evaluateBestHand(aa, board);
  const kkScore = evaluateBestHand(kk, board);

  console.log(`  AA 점수: ${aaScore} (${scoreToCategoryName(aaScore)})`);
  console.log(`  KK 점수: ${kkScore} (${scoreToCategoryName(kkScore)})`);

  assertGreaterThan(aaScore, kkScore, "AA가 KK보다 강해야 함");
});

test("킥커 비교: AK vs KQ on K-7-3-2-9 (둘 다 K 페어)", () => {
  const board = [c("K", "♠"), c("7", "♥"), c("3", "♦"), c("2", "♣"), c("9", "♠")];
  const ak = [c("A", "♥"), c("K", "♦")];
  const kq = [c("K", "♣"), c("Q", "♠")];

  const akScore = evaluateBestHand(ak, board);
  const kqScore = evaluateBestHand(kq, board);

  console.log(`  AK 점수: ${akScore} (${scoreToCategoryName(akScore)})`);
  console.log(`  KQ 점수: ${kqScore} (${scoreToCategoryName(kqScore)})`);

  assertGreaterThan(akScore, kqScore, "AK가 KQ보다 A 킥커로 승해야 함");
});

test("동점 처리: AA vs AA", () => {
  const board = [c("K", "♠"), c("Q", "♥"), c("J", "♦"), c("9", "♣"), c("7", "♠")];
  const aa1 = [c("A", "♥"), c("A", "♦")];
  const aa2 = [c("A", "♣"), c("A", "♠")];

  const winners = determineWinners(
    [{ holeCards: aa1 }, { holeCards: aa2 }],
    board
  );
  console.log(`  승자 인덱스: ${winners.join(", ")}`);
  assertEqual(winners.length, 2, "두 명 모두 승자여야 함");
});

test("보드 페어: AK vs K5 on K-K-5-2-9 (K5 풀하우스 > AK 트리플)", () => {
  const board = [c("K", "♠"), c("K", "♥"), c("5", "♦"), c("2", "♣"), c("9", "♠")];
  const ak = [c("A", "♥"), c("K", "♦")];
  const k5 = [c("K", "♣"), c("5", "♠")];

  const akScore = evaluateBestHand(ak, board);
  const k5Score = evaluateBestHand(k5, board);

  console.log(`  AK 점수: ${akScore} (${scoreToCategoryName(akScore)})`);
  console.log(`  K5 점수: ${k5Score} (${scoreToCategoryName(k5Score)})`);

  assertGreaterThan(k5Score, akScore, "K5 풀하우스가 AK 트리플보다 강해야 함");
  assertEqual(scoreToCategoryName(k5Score).includes("풀하우스") ? 1 : 0, 1, "K5는 풀하우스");
  assertEqual(scoreToCategoryName(akScore).includes("트리플") ? 1 : 0, 1, "AK는 트리플");
});

test("AK vs K5 on A-K-5-2-9: AK 투페어(AA KK) > K5 투페어(KK 55)", () => {
  const board = [c("A", "♠"), c("K", "♥"), c("5", "♦"), c("2", "♣"), c("9", "♠")];
  const ak = [c("A", "♥"), c("K", "♦")];
  const k5 = [c("K", "♣"), c("5", "♠")];

  const akScore = evaluateBestHand(ak, board);
  const k5Score = evaluateBestHand(k5, board);

  console.log(`  AK 점수: ${akScore} (${scoreToCategoryName(akScore)})`);
  console.log(`  K5 점수: ${k5Score} (${scoreToCategoryName(k5Score)})`);

  assertGreaterThan(akScore, k5Score, "AK 투페어(AA KK)가 K5 투페어(KK 55)보다 강해야 함");
});

test("스트레이트 vs 플러시: 플러시 승리", () => {
  // 보드: 5하트 6하트 9하트 2클로버 7다이아
  const board = [c("5", "♥"), c("6", "♥"), c("9", "♥"), c("2", "♣"), c("7", "♦")];
  // 핸드 1: A하트 K하트 → A-K-9-6-5 하트 플러시
  const flush = [c("A", "♥"), c("K", "♥")];
  // 핸드 2: 8클로버 4스페이드 → 4-5-6-7-8 스트레이트
  const straight = [c("8", "♣"), c("4", "♠")];

  const flushScore = evaluateBestHand(flush, board);
  const straightScore = evaluateBestHand(straight, board);

  console.log(`  플러시 점수: ${flushScore} (${scoreToCategoryName(flushScore)})`);
  console.log(`  스트레이트 점수: ${straightScore} (${scoreToCategoryName(straightScore)})`);

  assertGreaterThan(flushScore, straightScore, "플러시가 스트레이트보다 강해야 함");
  assertEqual(scoreToCategoryName(flushScore), "플러시", "플러시여야 함");
  assertEqual(scoreToCategoryName(straightScore), "스트레이트", "스트레이트여야 함");
});

test("포카드 vs 풀하우스: 포카드 승리", () => {
  // 보드: 9-9-9-K-2
  const board = [c("9", "♠"), c("9", "♥"), c("9", "♦"), c("K", "♣"), c("2", "♠")];
  // 핸드 1: 9클로버 A → 9999 포카드
  const quads = [c("9", "♣"), c("A", "♥")];
  // 핸드 2: KK → 999 KK 풀하우스
  const fullHouse = [c("K", "♥"), c("K", "♦")];

  const quadsScore = evaluateBestHand(quads, board);
  const fhScore = evaluateBestHand(fullHouse, board);

  console.log(`  포카드 점수: ${quadsScore} (${scoreToCategoryName(quadsScore)})`);
  console.log(`  풀하우스 점수: ${fhScore} (${scoreToCategoryName(fhScore)})`);

  assertGreaterThan(quadsScore, fhScore, "포카드가 풀하우스보다 강해야 함");
});

test("로얄 플러시 인식", () => {
  // 보드: T-J-Q-K-A (모두 하트)
  const board = [c("T", "♥"), c("J", "♥"), c("Q", "♥"), c("K", "♥"), c("A", "♥")];
  // 핸드: 아무거나 (보드 자체가 로얄 플러시)
  const hand = [c("2", "♣"), c("3", "♦")];

  const score = evaluateBestHand(hand, board);
  console.log(`  점수: ${score} (${scoreToCategoryName(score)})`);
  assertEqual(scoreToCategoryName(score), "스트레이트 플러시", "스트레이트 플러시여야 함");
});

console.log("\n=== 모든 테스트 통과! ===");
