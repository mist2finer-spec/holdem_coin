// 표준 NLHE min-raise 규칙 테스트
// BB=200일 때:
// - 아무도 베팅 안 했으면 minRaise = BB = 200
// - A가 600으로 레이즈 (레이즈 크기 400) → B의 minRaise = 600 + 400 = 1000
// - B가 1000으로 리레이즈 (레이즈 크기 400) → C의 minRaise = 1000 + 400 = 1400

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}: ${(e as Error).message}`); process.exit(1); }
}

function assertEqual(a: number, b: number, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

const BIG_BLIND = 200;

console.log("=== 표준 NLHE min-raise 규칙 테스트 ===\n");

// minRaise 계산 로직 시뮬레이션
function calcMinRaise(maxBet: number, lastRaiseSize: number): number {
  return maxBet === 0 ? BIG_BLIND : maxBet + lastRaiseSize;
}

test("아무도 베팅 안 했을 때 minRaise = BB", () => {
  const maxBet = 0;
  const lastRaiseSize = BIG_BLIND; // 라운드 시작 시 BB로 리셋
  const minRaise = calcMinRaise(maxBet, lastRaiseSize);
  assertEqual(minRaise, BIG_BLIND, "minRaise는 BB여야 함");
  console.log(`  maxBet=0, lastRaiseSize=BB → minRaise = ${minRaise} (BB)`);
});

test("BB=200, A 레이즈 to 600 (레이즈 크기 400) → B의 minRaise = 1000", () => {
  // A가 600으로 레이즈
  const maxBet = 600;
  // 레이즈 크기 = 600 - 200(BB) = 400
  let lastRaiseSize = 400;
  const minRaise = calcMinRaise(maxBet, lastRaiseSize);
  assertEqual(minRaise, 1000, "B의 minRaise는 1000이어야 함 (600 + 400)");
  console.log(`  A 레이즈 to 600 (레이즈 크기 400) → B의 minRaise = ${minRaise}`);
});

test("B 리레이즈 to 1000 (레이즈 크기 400) → C의 minRaise = 1400", () => {
  // B가 1000으로 리레이즈
  const maxBet = 1000;
  // 레이즈 크기 = 1000 - 600 = 400 (이전과 동일)
  let lastRaiseSize = 400;
  const minRaise = calcMinRaise(maxBet, lastRaiseSize);
  assertEqual(minRaise, 1400, "C의 minRaise는 1400이어야 함 (1000 + 400)");
  console.log(`  B 리레이즈 to 1000 (레이즈 크기 400) → C의 minRaise = ${minRaise}`);
});

test("더 큰 레이즈가 오면 lastRaiseSize 업데이트", () => {
  // A가 600으로 레이즈 (레이즈 크기 400)
  let lastRaiseSize = 400;
  // B가 1500으로 리레이즈 (레이즈 크기 900)
  const newRaiseSize = 1500 - 600;
  if (newRaiseSize > lastRaiseSize) lastRaiseSize = newRaiseSize;
  assertEqual(lastRaiseSize, 900, "lastRaiseSize는 더 큰 900으로 업데이트");
  console.log(`  B 리레이즈 to 1500 (레이즈 크기 900) → lastRaiseSize = ${lastRaiseSize}`);

  // C의 minRaise = 1500 + 900 = 2400
  const minRaise = calcMinRaise(1500, lastRaiseSize);
  assertEqual(minRaise, 2400, "C의 minRaise는 2400이어야 함");
  console.log(`  C의 minRaise = ${minRaise} (1500 + 900)`);
});

test("작은 레이즈는 lastRaiseSize 유지 (포커 규칙: min-raise는 가장 최근 유효한 레이즈 크기)", () => {
  // 이전 lastRaiseSize = 900
  let lastRaiseSize = 900;
  // 누군가 1600으로 레이즈 (레이즈 크기 100) → 이것은 min-raise 위반!
  // 실제 코드에서는 minRaise 검증으로 인해 이런 레이즈는 불가능하지만
  // lastRaiseSize 로직은 더 큰 값만 업데이트
  const newRaiseSize = 1600 - 1500; // 100
  if (newRaiseSize > lastRaiseSize) lastRaiseSize = newRaiseSize;
  assertEqual(lastRaiseSize, 900, "작은 레이즈는 lastRaiseSize 유지");
  console.log(`  작은 레이즈(100)는 lastRaiseSize를 ${lastRaiseSize}로 유지`);
});

console.log("\n=== 모든 min-raise 규칙 테스트 통과! ===");
console.log("\n표준 NLHE 룰:");
console.log("- minRaise = 현재 베팅 + 마지막 레이즈 크기");
console.log("- 라운드 시작 시 lastRaiseSize = BB");
console.log("- 더 큰 레이즈가 오면 lastRaiseSize 업데이트");
