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

// 전략 적용 시 persona 값이 변경되는지 확인
test("전략 적용: persona의 vpip/aggression/bluffFreq가 전략에 맞게 override", () => {
  const basePersona = RPG_BOT_POOL[0]; // 엘프 궁수
  console.log(`  원본: vpip=${basePersona.vpip}, aggression=${basePersona.aggression}, bluffFreq=${basePersona.bluffFreq}`);

  const aggressive = applyStrategyToPersona(basePersona, "AGGRESSIVE");
  assertEqual(aggressive.vpip, STRATEGY_PROFILES.AGGRESSIVE.vpip, "AGGRESSIVE vpip");
  assertEqual(aggressive.aggression, STRATEGY_PROFILES.AGGRESSIVE.aggression, "AGGRESSIVE aggression");
  assertEqual(aggressive.bluffFreq, STRATEGY_PROFILES.AGGRESSIVE.bluffFreq, "AGGRESSIVE bluffFreq");
  console.log(`  AGGRESSIVE: vpip=${aggressive.vpip}, aggression=${aggressive.aggression}, bluffFreq=${aggressive.bluffFreq}`);

  const tight = applyStrategyToPersona(basePersona, "TIGHT");
  assertEqual(tight.vpip, STRATEGY_PROFILES.TIGHT.vpip, "TIGHT vpip");
  assertEqual(tight.aggression, STRATEGY_PROFILES.TIGHT.aggression, "TIGHT aggression");
  assertEqual(tight.bluffFreq, STRATEGY_PROFILES.TIGHT.bluffFreq, "TIGHT bluffFreq");
  console.log(`  TIGHT: vpip=${tight.vpip}, aggression=${tight.aggression}, bluffFreq=${tight.bluffFreq}`);

  const loose = applyStrategyToPersona(basePersona, "LOOSE");
  assertEqual(loose.vpip, STRATEGY_PROFILES.LOOSE.vpip, "LOOSE vpip");
  assertEqual(loose.aggression, STRATEGY_PROFILES.LOOSE.aggression, "LOOSE aggression");
  assertEqual(loose.bluffFreq, STRATEGY_PROFILES.LOOSE.bluffFreq, "LOOSE bluffFreq");
  console.log(`  LOOSE: vpip=${loose.vpip}, aggression=${loose.aggression}, bluffFreq=${loose.bluffFreq}`);
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

// 9 NPC가 모두 존재하는지 확인
test("9 NPC가 모두 존재", () => {
  assertEqual(RPG_BOT_POOL.length, 9, "NPC는 9명이어야 함");
  console.log(`  NPC 수: ${RPG_BOT_POOL.length}`);
  RPG_BOT_POOL.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.title})`);
  });
});

console.log("\n=== 모든 전략 로테이션 테스트 통과! ===");
console.log(`\n요약: ${HANDS_PER_STRATEGY}핸드마다 AGGRESSIVE → TIGHT → LOOSE 순환`);
