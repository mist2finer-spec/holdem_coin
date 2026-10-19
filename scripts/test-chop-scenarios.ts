// 핸드 평가기 단위 테스트 v2 - 챱(split pot) 시나리오 검증
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

console.log("=== 챱(Split Pot) 시나리오 테스트 ===\n");

// 유저가 말한 시나리오: A9 vs J9 on Q-J-10-8-x 보드
// A9: A, 9 + Q, J, 10, 8, x → 8-9-10-J-Q 스트레이트 (Q high)
// J9: J, 9 + Q, J, 10, 8, x → 8-9-10-J-Q 스트레이트 (Q high, J는 페어지만 스트레이트가 더 강함)
// 둘 다 보드의 8-9-10-J-Q 스트레이트를 사용 → 챱
test("A9 vs J9 on Q-J-10-8-2 보드: 둘 다 Q-하이 스트레이트 → 챱", () => {
  const board = [c("Q", "♠"), c("J", "♥"), c("T", "♦"), c("8", "♣"), c("2", "♠")];
  const a9 = [c("A", "♥"), c("9", "♦")];
  const j9 = [c("J", "♣"), c("9", "♠")];

  const a9Score = evaluateBestHand(a9, board);
  const j9Score = evaluateBestHand(j9, board);

  console.log(`  A9 점수: ${a9Score} (${scoreToCategoryName(a9Score)})`);
  console.log(`  J9 점수: ${j9Score} (${scoreToCategoryName(j9Score)})`);

  assertEqual(a9Score, j9Score, "A9와 J9의 점수가 같아야 함 (챱)");
  assertEqual(scoreToCategoryName(a9Score), "스트레이트", "A9는 스트레이트");
  assertEqual(scoreToCategoryName(j9Score), "스트레이트", "J9는 스트레이트");

  const winners = determineWinners(
    [{ holeCards: a9 }, { holeCards: j9 }],
    board
  );
  console.log(`  승자 인덱스: ${winners.join(", ")}`);
  assertEqual(winners.length, 2, "두 명 모두 승자 (챱)");
  console.log(`  → 챱(Split Pot) 확인 ✓`);
});

// 추가: A9 vs J9 on Q-J-10-8-7 보드 (7이 있으면 7-8-9-10-J도 가능하지만 Q-하이가 더 강함)
test("A9 vs J9 on Q-J-10-8-7 보드: 여전히 Q-하이 스트레이트로 챱", () => {
  const board = [c("Q", "♠"), c("J", "♥"), c("T", "♦"), c("8", "♣"), c("7", "♠")];
  const a9 = [c("A", "♥"), c("9", "♦")];
  const j9 = [c("J", "♣"), c("9", "♠")];

  const a9Score = evaluateBestHand(a9, board);
  const j9Score = evaluateBestHand(j9, board);

  console.log(`  A9 점수: ${a9Score} (${scoreToCategoryName(a9Score)})`);
  console.log(`  J9 점수: ${j9Score} (${scoreToCategoryName(j9Score)})`);

  assertEqual(a9Score, j9Score, "챱이어야 함");
  assertEqual(scoreToCategoryName(a9Score), "스트레이트", "스트레이트");
});

// 한 명이 더 강한 핸드 만들면 그쪽이 이겨야 함
// A9 on Q-J-10-8-2 → Q-하이 스트레이트
// K9 on Q-J-10-8-2 → K-Q-J-10-9 = K-하이 스트레이트 (더 강함!)
test("A9 vs K9 on Q-J-10-8-2: K9가 K-하이 스트레이트로 승", () => {
  const board = [c("Q", "♠"), c("J", "♥"), c("T", "♦"), c("8", "♣"), c("2", "♠")];
  const a9 = [c("A", "♥"), c("9", "♦")];
  const k9 = [c("K", "♣"), c("9", "♠")];

  const a9Score = evaluateBestHand(a9, board);
  const k9Score = evaluateBestHand(k9, board);

  console.log(`  A9 점수: ${a9Score} (${scoreToCategoryName(a9Score)}) — Q-하이 스트레이트`);
  console.log(`  K9 점수: ${k9Score} (${scoreToCategoryName(k9Score)}) — K-하이 스트레이트`);

  assertGreaterThan(k9Score, a9Score, "K9이 A9보다 강해야 함");
});

// 보드에 로얄 플러시가 있으면 무조건 챱
test("보드 로얄 플러시: 모든 플레이어 챱", () => {
  const board = [c("A", "♥"), c("K", "♥"), c("Q", "♥"), c("J", "♥"), c("T", "♥")];
  const p1 = [c("2", "♣"), c("3", "♦")];
  const p2 = [c("9", "♣"), c("5", "♠")];

  const p1Score = evaluateBestHand(p1, board);
  const p2Score = evaluateBestHand(p2, board);

  console.log(`  P1 점수: ${p1Score} (${scoreToCategoryName(p1Score)})`);
  console.log(`  P2 점수: ${p2Score} (${scoreToCategoryName(p2Score)})`);

  assertEqual(p1Score, p2Score, "챱이어야 함");
  assertEqual(scoreToCategoryName(p1Score), "스트레이트 플러시", "스트레이트 플러시");

  const winners = determineWinners(
    [{ holeCards: p1 }, { holeCards: p2 }],
    board
  );
  assertEqual(winners.length, 2, "두 명 모두 승자");
});

// 보드에 풀하우스가 있으면 모두 같은 풀하우스로 챱
test("보드 풀하우스: 모든 플레이어 챱", () => {
  const board = [c("K", "♠"), c("K", "♥"), c("K", "♦"), c("Q", "♣"), c("Q", "♠")];
  const p1 = [c("A", "♥"), c("2", "♦")];
  const p2 = [c("9", "♣"), c("5", "♠")];

  const p1Score = evaluateBestHand(p1, board);
  const p2Score = evaluateBestHand(p2, board);

  console.log(`  P1 점수: ${p1Score} (${scoreToCategoryName(p1Score)})`);
  console.log(`  P2 점수: ${p2Score} (${scoreToCategoryName(p2Score)})`);

  assertEqual(p1Score, p2Score, "챱이어야 함");
  assertEqual(scoreToCategoryName(p1Score), "풀하우스", "풀하우스");
});

// 킥커 비교: 둘 다 같은 페어지만 킥커가 다른 경우
test("A2 vs K2 on Q-9-5-3-7: 둘 다 하이카드, A 킥커가 승", () => {
  const board = [c("Q", "♠"), c("9", "♥"), c("5", "♦"), c("3", "♣"), c("7", "♠")];
  const a2 = [c("A", "♥"), c("2", "♦")];
  const k2 = [c("K", "♣"), c("2", "♠")];

  const a2Score = evaluateBestHand(a2, board);
  const k2Score = evaluateBestHand(k2, board);

  console.log(`  A2 점수: ${a2Score} (${scoreToCategoryName(a2Score)})`);
  console.log(`  K2 점수: ${k2Score} (${scoreToCategoryName(k2Score)})`);

  assertGreaterThan(a2Score, k2Score, "A2가 A 킥커로 승");
});

console.log("\n=== 모든 챱 시나리오 테스트 통과! ===");
