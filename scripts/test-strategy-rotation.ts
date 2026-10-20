// AI 전략 로테이션 테스트
import {
  getStrategyForHand,
  applyStrategyToPersona,
  STRATEGY_PROFILES,
  RPG_BOT_POOL,
  StrategyType,
  HANDS_PER_STRATEGY,
} from "../src/lib/personas";

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}: ${(e as Error).message}`); process.exit(1); }
}
function assertEqual(a: any, b: any, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

console.log("=== AI 전략 로테이션 테스트 ===\n");

// 5핸드마다 전략이 로테이션되는지 확인
test("5핸드마다 전략 로테이션: AGGRESSIVE → TIGHT → LOOSE → AGGRESSIVE", () => {
  // 핸드 1-5: AGGRESSIVE
  for (let h = 1; h <= 5; h++) {
    assertEqual(getStrategyForHand(h), "AGGRESSIVE", `핸드 ${h}는 AGGRESSIVE`);
  }
  // 핸드 6-10: TIGHT
  for (let h = 6; h <= 10; h++) {
    assertEqual(getStrategyForHand(h), "TIGHT", `핸드 ${h}는 TIGHT`);
  }
  // 핸드 11-15: LOOSE
  for (let h = 11; h <= 15; h++) {
    assertEqual(getStrategyForHand(h), "LOOSE", `핸드 ${h}는 LOOSE`);
  }
  // 핸드 16-20: 다시 AGGRESSIVE
  for (let h = 16; h <= 20; h++) {
    assertEqual(getStrategyForHand(h), "AGGRESSIVE", `핸드 ${h}는 AGGRESSIVE (사이클 반복)`);
  }
  console.log(`  핸드 1-5: AGGRESSIVE`);
  console.log(`  핸드 6-10: TIGHT`);
  console.log(`  핸드 11-15: LOOSE`);
  console.log(`  핸드 16-20: AGGRESSIVE (사이클 반복)`);
});

test("테이블 전략은 개별 성향을 보존하고 소폭 보정", () => {
  const calm = RPG_BOT_POOL.find(p => p.id === "paladin_commander")!;
  const bold = RPG_BOT_POOL.find(p => p.id === "orc_berserker")!;
  for (const strategy of ["AGGRESSIVE", "TIGHT", "LOOSE"] as StrategyType[]) {
    const a = applyStrategyToPersona(calm, strategy);
    const b = applyStrategyToPersona(bold, strategy);
    if (a.vpip >= b.vpip || a.aggression >= b.aggression || a.bluffFreq >= b.bluffFreq)
      throw new Error("Individual personality lost");
    if (Math.abs(a.aggression - calm.aggression) > 0.08) throw new Error("Table adjustment too large");
  }
  assertEqual(calm.aggression, 0.20, "원본 불변");
});

// 3가지 전략이 서로 다른 값을 가지는지 확인
test("3가지 전략이 서로 다른 특성 가짐", () => {
  const strategies: StrategyType[] = ["AGGRESSIVE", "TIGHT", "LOOSE"];
  const vpips = strategies.map(s => STRATEGY_PROFILES[s].vpip);
  const aggressions = strategies.map(s => STRATEGY_PROFILES[s].aggression);

  // AGGRESSIVE가 TIGHT보다 높은 aggression
  if (STRATEGY_PROFILES.AGGRESSIVE.aggression <= STRATEGY_PROFILES.TIGHT.aggression) {
    throw new Error("AGGRESSIVE가 TIGHT보다 aggression이 높아야 함");
  }
  // LOOSE가 TIGHT보다 높은 vpip
  if (STRATEGY_PROFILES.LOOSE.vpip <= STRATEGY_PROFILES.TIGHT.vpip) {
    throw new Error("LOOSE가 TIGHT보다 vpip이 높아야 함");
  }
  console.log(`  AGGRESSIVE aggression (${STRATEGY_PROFILES.AGGRESSIVE.aggression}) > TIGHT aggression (${STRATEGY_PROFILES.TIGHT.aggression}) ✓`);
  console.log(`  LOOSE vpip (${STRATEGY_PROFILES.LOOSE.vpip}) > TIGHT vpip (${STRATEGY_PROFILES.TIGHT.vpip}) ✓`);
});

// 테이블을 채울 수 있고 캐릭터 ID가 중복되지 않는지 확인
test("캐릭터 풀은 8인 테이블을 채우고 고유 ID를 가짐", () => {
  if (RPG_BOT_POOL.length < 8) throw new Error("캐릭터 풀이 부족함");
  assertEqual(new Set(RPG_BOT_POOL.map(p => p.id)).size, RPG_BOT_POOL.length, "ID는 고유해야 함");
  console.log(`  NPC 수: ${RPG_BOT_POOL.length}`);
  RPG_BOT_POOL.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.title})`);
  });
});

console.log("\n=== 모든 전략 로테이션 테스트 통과! ===");
console.log(`\n요약: ${HANDS_PER_STRATEGY}핸드마다 AGGRESSIVE → TIGHT → LOOSE 순환`);
