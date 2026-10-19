// 사이드팟 계산 로직 단위 테스트
// poker-server의 calculateSidePots와 동일한 로직

interface TestSeat {
  seatId: number;
  name: string;
  totalBet: number;
  folded: boolean;
  holeCards: any[];
}

function calculateSidePots(alive: TestSeat[], allSeats: TestSeat[]) {
  const contributions = alive.map(s => ({
    seatId: s.seatId,
    totalBet: s.totalBet,
    seat: s,
  }));

  contributions.sort((a, b) => a.totalBet - b.totalBet);
  const betLevels = [...new Set(contributions.map(c => c.totalBet))].sort((a, b) => a - b);

  const pots: { amount: number; eligibleSeats: TestSeat[] }[] = [];
  let prevLevel = 0;

  for (const level of betLevels) {
    if (level <= prevLevel) continue;
    const eligibleSeats = contributions.filter(c => c.totalBet >= level).map(c => c.seat);
    const layerAmount = (level - prevLevel) * eligibleSeats.length;
    if (layerAmount > 0) {
      pots.push({ amount: layerAmount, eligibleSeats });
    }
    prevLevel = level;
  }

  // 폴드한 플레이어의 칩 추가
  const foldedSeats = allSeats.filter(s => s.folded && s.totalBet > 0);
  if (foldedSeats.length > 0 && pots.length > 0) {
    const foldedChips = foldedSeats.reduce((a, s) => a + s.totalBet, 0);
    pots[0].amount += foldedChips;
  }

  if (pots.length === 0) {
    const totalChips = contributions.reduce((a, c) => a + c.totalBet, 0);
    if (totalChips > 0) {
      pots.push({ amount: totalChips, eligibleSeats: alive });
    }
  }

  return pots;
}

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}: ${(e as Error).message}`); process.exit(1); }
}
function assertEqual(a: number, b: number, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

console.log("=== 사이드팟 계산 테스트 ===\n");

// 시나리오 1: A 올인 15000, B 콜 15000, C 콜 15000 (전부 같은 금액)
// → 단일 팟 45000, A/B/C 모두 참여
test("동일 금액 올인: 단일 팟", () => {
  const alive = [
    { seatId: 0, name: "A", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 1, name: "B", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 2, name: "C", totalBet: 15000, folded: false, holeCards: [] },
  ];
  const pots = calculateSidePots(alive, alive);
  console.log(`  pots: ${pots.length}개, 총액: ${pots.reduce((a, p) => a + p.amount, 0)}`);
  assertEqual(pots.length, 1, "팟은 1개");
  assertEqual(pots[0].amount, 45000, "팟 금액은 45000");
  assertEqual(pots[0].eligibleSeats.length, 3, "참여자 3명");
});

// 시나리오 2: A 올인 15000, B 올인 20000, C 콜 20000
// → 메인팟: 15000 × 3 = 45000 (A, B, C 참여)
// → 사이드팟: 5000 × 2 = 10000 (B, C만 참여)
test("A 올인 15000, B 올인 20000, C 콜 20000", () => {
  const alive = [
    { seatId: 0, name: "A", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 1, name: "B", totalBet: 20000, folded: false, holeCards: [] },
    { seatId: 2, name: "C", totalBet: 20000, folded: false, holeCards: [] },
  ];
  const pots = calculateSidePots(alive, alive);
  console.log(`  pots: ${pots.length}개`);
  for (let i = 0; i < pots.length; i++) {
    console.log(`  pot ${i}: ${pots[i].amount} (참여: ${pots[i].eligibleSeats.map(s => s.name).join(",")})`);
  }
  assertEqual(pots.length, 2, "팟은 2개");
  assertEqual(pots[0].amount, 45000, "메인팟 45000");
  assertEqual(pots[0].eligibleSeats.length, 3, "메인팟 참여자 3명 (A,B,C)");
  assertEqual(pots[1].amount, 10000, "사이드팟 10000");
  assertEqual(pots[1].eligibleSeats.length, 2, "사이드팟 참여자 2명 (B,C)");
});

// 시나리오 3: A 올인 5000, B 올인 10000, C 올인 15000, D 콜 15000
// → 메인팟: 5000 × 4 = 20000 (A,B,C,D)
// → 사이드팟1: 5000 × 3 = 15000 (B,C,D)
// → 사이드팟2: 5000 × 2 = 10000 (C,D)
test("4인 다중 올인: A 5000, B 10000, C 15000, D 15000", () => {
  const alive = [
    { seatId: 0, name: "A", totalBet: 5000, folded: false, holeCards: [] },
    { seatId: 1, name: "B", totalBet: 10000, folded: false, holeCards: [] },
    { seatId: 2, name: "C", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 3, name: "D", totalBet: 15000, folded: false, holeCards: [] },
  ];
  const pots = calculateSidePots(alive, alive);
  console.log(`  pots: ${pots.length}개`);
  for (let i = 0; i < pots.length; i++) {
    console.log(`  pot ${i}: ${pots[i].amount} (참여: ${pots[i].eligibleSeats.map(s => s.name).join(",")})`);
  }
  assertEqual(pots.length, 3, "팟은 3개");
  assertEqual(pots[0].amount, 20000, "메인팟 20000");
  assertEqual(pots[1].amount, 15000, "사이드팟1 15000");
  assertEqual(pots[2].amount, 10000, "사이드팟2 10000");
  assertEqual(pots[0].eligibleSeats.length, 4, "메인팟 참여자 4명");
  assertEqual(pots[1].eligibleSeats.length, 3, "사이드팟1 참여자 3명");
  assertEqual(pots[2].eligibleSeats.length, 2, "사이드팟2 참여자 2명");
});

// 시나리오 4: A 올인 15000, B 폴드(5000 베팅), C 콜 15000
// → 메인팟: 15000 × 2 + 5000(폴드한 B) = 35000 (A, C 참여)
test("폴드한 플레이어의 칩 포함: A 올인 15000, B 폴드(5000), C 콜 15000", () => {
  const all = [
    { seatId: 0, name: "A", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 1, name: "B", totalBet: 5000, folded: true, holeCards: [] },
    { seatId: 2, name: "C", totalBet: 15000, folded: false, holeCards: [] },
  ];
  const alive = all.filter(s => !s.folded);
  const pots = calculateSidePots(alive, all);
  console.log(`  pots: ${pots.length}개`);
  for (let i = 0; i < pots.length; i++) {
    console.log(`  pot ${i}: ${pots[i].amount} (참여: ${pots[i].eligibleSeats.map(s => s.name).join(",")})`);
  }
  assertEqual(pots.length, 1, "팟은 1개");
  assertEqual(pots[0].amount, 35000, "메인팟 35000 (15000+5000+15000)");
  assertEqual(pots[0].eligibleSeats.length, 2, "참여자 2명 (A,C만)");
});

// 시나리오 5: A 올인 15000, B 올인 20000, C 폴드(3000)
// → 메인팟: 15000 × 2 + 3000(폴드 C) = 33000 (A, B 참여)
// → 사이드팟: 5000 × 1 = 5000 (B만 참여)
test("폴드 + 사이드팟: A 15000, B 20000, C 폴드(3000)", () => {
  const all = [
    { seatId: 0, name: "A", totalBet: 15000, folded: false, holeCards: [] },
    { seatId: 1, name: "B", totalBet: 20000, folded: false, holeCards: [] },
    { seatId: 2, name: "C", totalBet: 3000, folded: true, holeCards: [] },
  ];
  const alive = all.filter(s => !s.folded);
  const pots = calculateSidePots(alive, all);
  console.log(`  pots: ${pots.length}개`);
  for (let i = 0; i < pots.length; i++) {
    console.log(`  pot ${i}: ${pots[i].amount} (참여: ${pots[i].eligibleSeats.map(s => s.name).join(",")})`);
  }
  assertEqual(pots.length, 2, "팟은 2개");
  assertEqual(pots[0].amount, 33000, "메인팟 33000 (15000×2 + 3000)");
  assertEqual(pots[1].amount, 5000, "사이드팟 5000");
  assertEqual(pots[1].eligibleSeats.length, 1, "사이드팟 참여자 1명 (B만)");
});

console.log("\n=== 모든 사이드팟 테스트 통과! ===");
