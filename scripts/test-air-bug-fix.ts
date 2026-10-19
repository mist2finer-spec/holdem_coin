// AIR → TWO_PAIR_PLUS 버그 수정 검증 테스트
import { evalPostflopRealEquity } from "../src/lib/equity-engine";

interface Card { rank: string; suit: string; }
function c(rank: string, suit: string): Card { return { rank, suit }; }

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}: ${(e as Error).message}`); process.exit(1); }
}
function assertLessThan(a: number, b: number, msg: string) {
  if (!(a < b)) throw new Error(`${msg}: expected ${a} < ${b}`);
}
function assertGreaterThan(a: number, b: number, msg: string) {
  if (!(a > b)) throw new Error(`${msg}: expected ${a} > ${b}`);
}

console.log("=== AIR → TWO_PAIR_PLUS 버그 수정 검증 ===\n");

// 핵심 시나리오: 7♣ 2♦ on A♠ K♥ 9♦ (노히트 AIR)
// 버그 전: 투페어(0.78)로 둔갑 → 모든 CPU가 콜 고착
// 버그 후: AIR(0.12)로 정확 판정 → 레이즈에 폴드
test("7♣ 2♦ on A-K-9: 노히트 AIR여야 함 (이전 버그: 투페어 0.78로 둔갑)", () => {
  const board = [c("A", "♠"), c("K", "♥"), c("9", "♦")];
  const hole = [c("7", "♣"), c("2", "♦")];

  const eq = evalPostflopRealEquity(hole, board);
  console.log(`  7♣2♦ on A-K-9 에퀴티: ${eq.toFixed(3)}`);

  // AIR는 0.20 이하여야 함 (이전 버그에서는 0.78로 잘못 계산됨)
  assertLessThan(eq, 0.30, "노히트 AIR는 0.30 미만이어야 함");
});

// 비교: 진짜 투페어는 여전히 강해야 함
test("A♣ K♦ on A-K-9: 진짜 투페어는 강해야 함 (0.70+)", () => {
  const board = [c("A", "♠"), c("K", "♥"), c("9", "♦")];
  const hole = [c("A", "♣"), c("K", "♦")];

  const eq = evalPostflopRealEquity(hole, board);
  console.log(`  A♣K♦ on A-K-9 에퀴티: ${eq.toFixed(3)}`);

  assertGreaterThan(eq, 0.70, "진짜 투페어는 0.70 이상이어야 함");
});

// 탑페어 vs AIR 비교
test("A♣ 5♦ on A-K-9: 탑페어(A)는 강해야 함 (0.60+)", () => {
  const board = [c("A", "♠"), c("K", "♥"), c("9", "♦")];
  const hole = [c("A", "♣"), c("5", "♦")];

  const eq = evalPostflopRealEquity(hole, board);
  console.log(`  A♣5♦ on A-K-9 에퀴티: ${eq.toFixed(3)}`);

  assertGreaterThan(eq, 0.55, "탑페어는 0.55 이상이어야 함");
});

// 보드 페어 착시 테스트: 보드에 K이 2장 있을 때 K을 들고 있으면 트리플
test("K♣ 7♦ on K-K-9: 보드 페어 + 내 K = 트리플 (0.80+)", () => {
  const board = [c("K", "♠"), c("K", "♥"), c("9", "♦")];
  const hole = [c("K", "♣"), c("7", "♦")];

  const eq = evalPostflopRealEquity(hole, board);
  console.log(`  K♣7♦ on K-K-9 에퀴티: ${eq.toFixed(3)}`);

  assertGreaterThan(eq, 0.80, "트리플은 0.80 이상이어야 함");
});

// 보드 페어 착시 테스트: 보드에 K이 2장 있을 때 7-2를 들면 노히트 AIR
test("7♣ 2♦ on K-K-9: 보드 페어지만 내 패는 AIR (0.30 미만)", () => {
  const board = [c("K", "♠"), c("K", "♥"), c("9", "♦")];
  const hole = [c("7", "♣"), c("2", "♦")];

  const eq = evalPostflopRealEquity(hole, board);
  console.log(`  7♣2♦ on K-K-9 에퀴티: ${eq.toFixed(3)}`);

  assertLessThan(eq, 0.30, "보드 페어여도 내 패가 없으면 AIR");
});

console.log("\n=== 모든 AIR 버그 수정 테스트 통과! ===");
