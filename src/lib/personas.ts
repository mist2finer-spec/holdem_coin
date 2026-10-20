import { applyStackTraits } from './poker-stack';
// RPG AI 페르소나 정의 (Python 코드의 BotPersona와 매칭)

export interface BotPersona {
  id: string;
  name: string;
  title: string;          // 칭호
  vpip: number;           // 프리플랍 참여율 (높을수록 루즈)
  aggression: number;     // 레이즈 선호도
  bluffFreq: number;      // 블러핑 빈도
  style: string;          // 플레이 스타일 설명
  color: string;          // 테마 색상 (tailwind 클래스)
  accent: string;
  emoji: string;
  catchphrase: string;    // 승리/행동 시 대사
  taunt: string;          // 도발 대사
}

export const RPG_BOT_POOL: BotPersona[] = [
  {
    id: "elf_archer",
    name: "엘프 궁수",
    title: "숲의 정찰자",
    vpip: 0.22,
    aggression: 0.30,
    bluffFreq: 0.05,
    style: "타이트-패시브",
    color: "from-emerald-700 to-emerald-900",
    accent: "text-emerald-300",
    emoji: "🏹",
    catchphrase: "한 발의 적중이면 충분합니다.",
    taunt: "너무 성급하시군.",
  },
  {
    id: "orc_berserker",
    name: "오크 광전사",
    title: "피의 전사",
    vpip: 0.65,
    aggression: 0.75,
    bluffFreq: 0.35,
    style: "루즈-어그레시브 (매니악)",
    color: "from-red-800 to-red-950",
    accent: "text-red-300",
    emoji: "🪓",
    catchphrase: "부숴주마! 올인이닷!",
    taunt: " 겁쟁이 같으니!",
  },
  {
    id: "dwarf_merchant",
    name: "드워프 상인",
    title: "보석길드 원로",
    vpip: 0.28,
    aggression: 0.50,
    bluffFreq: 0.10,
    style: "정석 밸런스형",
    color: "from-amber-700 to-amber-900",
    accent: "text-amber-300",
    emoji: "💎",
    catchphrase: "계산은 끝났다, 손님.",
    taunt: "장사수완이 아쉽군.",
  },
  {
    id: "goblin_thief",
    name: "고블린 도적",
    title: "그림자 손",
    vpip: 0.45,
    aggression: 0.60,
    bluffFreq: 0.40,
    style: "블러퍼",
    color: "from-lime-700 to-lime-900",
    accent: "text-lime-300",
    emoji: "🗡️",
    catchphrase: "속았지? 킥킥!",
    taunt: "쉬운 상대였어, 킥킥.",
  },
  {
    id: "paladin_commander",
    name: "성기사 단장",
    title: "빛의 수호자",
    vpip: 0.18,
    aggression: 0.20,
    bluffFreq: 0.01,
    style: "극단적 안전주의 (Nit)",
    color: "from-yellow-600 to-yellow-800",
    accent: "text-yellow-200",
    emoji: "🛡️",
    catchphrase: "정의의 편에서 승리를.",
    taunt: "무모한 패였소.",
  },
  {
    id: "dark_mage",
    name: "암흑 마법사",
    title: "금단의 탐구자",
    vpip: 0.35,
    aggression: 0.65,
    bluffFreq: 0.20,
    style: "공격적 정석",
    color: "from-purple-800 to-purple-950",
    accent: "text-purple-300",
    emoji: "🔮",
    catchphrase: "운명은 이미 계산되었다.",
    taunt: "눈치가 느리군.",
  },
  {
    id: "wandering_bard",
    name: "방랑 음유시인",
    title: "별의 노래꾼",
    vpip: 0.50,
    aggression: 0.25,
    bluffFreq: 0.15,
    style: "콜링 스테이션",
    color: "from-sky-700 to-sky-900",
    accent: "text-sky-300",
    emoji: "🎵",
    catchphrase: "♪ 한 판 더 하시지~ ♪",
    taunt: "♪ 그 패로는 노래가 안 나오네요 ♪",
  },
  {
    id: "dragon_slayer",
    name: "드래곤 슬레이어",
    title: "용왕 사냥꾼",
    vpip: 0.30,
    aggression: 0.55,
    bluffFreq: 0.12,
    style: "공격적 정석",
    color: "from-orange-700 to-orange-900",
    accent: "text-orange-300",
    emoji: "🐉",
    catchphrase: "용도 쓰러뜨린 주먹이다.",
    taunt: "전투 감각이 녹슬었군.",
  },
  {
    id: "alchemist_guild",
    name: "연금술사 길드장",
    title: "현자의 돌",
    vpip: 0.26,
    aggression: 0.45,
    bluffFreq: 0.08,
    style: "계산적 정석",
    color: "from-teal-700 to-teal-900",
    accent: "text-teal-300",
    emoji: "⚗️",
    catchphrase: "황금비율은 내 손에.",
    taunt: "비율이 틀렸소.",
  },
  // ★ 새 캐릭터 추가 (15종 → 더 다양한 게임)
  {
    id: "necromancer",
    name: "사령술사",
    title: "죽음의 인도자",
    vpip: 0.30,
    aggression: 0.60,
    bluffFreq: 0.18,
    style: "공격적 정석",
    color: "from-violet-800 to-violet-950",
    accent: "text-violet-300",
    emoji: "💀",
    catchphrase: "너의 패도 내 것이 될 것이다.",
    taunt: "죽은 패는 돌아오지 않지.",
  },
  {
    id: "pirate_captain",
    name: "해적 선장",
    title: "침몰선의 왕",
    vpip: 0.48,
    aggression: 0.72,
    bluffFreq: 0.22,
    style: "루즈-어그레시브",
    color: "from-slate-600 to-slate-900",
    accent: "text-slate-300",
    emoji: "🏴‍☠️",
    catchphrase: "보물은 전부 내 것이다!",
    taunt: "바다에 수장되어라!",
  },
  {
    id: "ninja_shadow",
    name: "그림자 닌자",
    title: "암살자",
    vpip: 0.25,
    aggression: 0.55,
    bluffFreq: 0.28,
    style: "타이트-어그레시브",
    color: "from-gray-700 to-gray-950",
    accent: "text-gray-300",
    emoji: "🥷",
    catchphrase: "그림자 속에서 승리를.",
    taunt: "보이지 않는 칼날.",
  },
  {
    id: "barbarian_chief",
    name: "야만족 족장",
    title: "피의 지배자",
    vpip: 0.58,
    aggression: 0.82,
    bluffFreq: 0.15,
    style: "루즈-어그레시브",
    color: "from-orange-800 to-red-950",
    accent: "text-orange-300",
    emoji: "🪓",
    catchphrase: "약자는 살아남지 못한다!",
    taunt: "부수어주마!",
  },
  {
    id: "ice_queen",
    name: "얼음 여왕",
    title: "영겨의 지배자",
    vpip: 0.20,
    aggression: 0.40,
    bluffFreq: 0.08,
    style: "타이트-패시브",
    color: "from-cyan-600 to-cyan-900",
    accent: "text-cyan-300",
    emoji: "❄️",
    catchphrase: "모든 것을 얼려버리겠어.",
    taunt: "얼어붙은 패로는 못 이기지.",
  },
  {
    id: "fire_mage",
    name: "화염술사",
    title: "불꽃의 지배자",
    vpip: 0.42,
    aggression: 0.78,
    bluffFreq: 0.20,
    style: "루즈-어그레시브",
    color: "from-red-600 to-orange-900",
    accent: "text-red-300",
    emoji: "🔥",
    catchphrase: "불꽃 속에서 타올라라!",
    taunt: "재로 변해버려!",
  },
];

// 캐릭터 퇴장 멘트 (100k 달성 시 또는 파산 시)
export function getExitMessage(persona: BotPersona, isCashOut: boolean): string {
  if (isCashOut) {
    // 100k 달성 - 잘 놀고 떠남
    const cashOutMessages = [
      `${persona.emoji} ${persona.name}: "잘 놀았네! 100k 달성이야."`,
      `${persona.emoji} ${persona.name}: "오늘 운이 좋구만. 이만 가보겠어."`,
      `${persona.emoji} ${persona.name}: "${persona.catchphrase}"`,
      `${persona.emoji} ${persona.name}: "충분히 벌었어. 다음에 보자고."`,
    ];
    return cashOutMessages[Math.floor(Math.random() * cashOutMessages.length)];
  } else {
    // 파산 - 도발하며 떠남
    const bustMessages = [
      `${persona.emoji} ${persona.name}: "${persona.taunt}"`,
      `${persona.emoji} ${persona.name}: "오늘은 날이 아니군..."`,
      `${persona.emoji} ${persona.name}: "다음엔 꼭 복수하겠어!"`,
      `${persona.emoji} ${persona.name}: "운이 따르지 않는군."`,
    ];
    return bustMessages[Math.floor(Math.random() * bustMessages.length)];
  }
}
export const USER_PERSONA = {
  id: "hero",
  name: "용사",
  title: "미래의 전략가",
  emoji: "⚔️",
  color: "from-blue-700 to-indigo-900",
  accent: "text-blue-200",
  style: "당신의 플레이",
  vpip: 0,
  aggression: 0,
  bluffFreq: 0,
  catchphrase: "승리는 내 것이다!",
  taunt: "",
};

// ============================================================
// AI 전략 로테이션 시스템
// ============================================================
// 테이블 분위기(어그레시브/타이트/루즈)를 5핸드마다 소폭 보정
// 테이블 전략은 개별 성향에 작은 보정만 적용한다.

export type StrategyType = "AGGRESSIVE" | "TIGHT" | "LOOSE";

export interface StrategyProfile {
  type: StrategyType;
  name: string;
  description: string;
  vpip: number;        // 프리플랍 참여율
  aggression: number;  // 어그레시브 정도
  bluffFreq: number;   // 블러프 빈도
  color: string;       // UI 색상
  emoji: string;
}

export const STRATEGY_PROFILES: Record<StrategyType, StrategyProfile> = {
  AGGRESSIVE: {
    type: "AGGRESSIVE",
    name: "어그레시브",
    description: "강하게 레이즈, 잦은 블러프",
    vpip: 0.45,
    aggression: 0.85,
    bluffFreq: 0.25,
    color: "from-red-600 to-rose-900",
    emoji: "🔥",
  },
  TIGHT: {
    type: "TIGHT",
    name: "타이트",
    description: "강한 핸드만 플레이, 폴드 위주",
    vpip: 0.18,
    aggression: 0.35,
    bluffFreq: 0.05,
    color: "from-blue-600 to-indigo-900",
    emoji: "🛡️",
  },
  LOOSE: {
    type: "LOOSE",
    name: "루즈",
    description: "다양한 핸드 참여, 콜 위주",
    vpip: 0.55,
    aggression: 0.45,
    bluffFreq: 0.15,
    color: "from-amber-500 to-orange-800",
    emoji: "🎲",
  },
};

export const STRATEGY_CYCLE: StrategyType[] = ["AGGRESSIVE", "TIGHT", "LOOSE"];
export const HANDS_PER_STRATEGY = 5; // 5핸드마다 전략 로테이션

/**
 * 현재 핸드 번호에 따른 전략 결정
 * - 5핸드마다 AGGRESSIVE → TIGHT → LOOSE → AGGRESSIVE ... 순환
 * - 같은 테이블 보정이 적용되어도 각 NPC의 고유 성향은 유지
 */
export function getStrategyForHand(handNumber: number): StrategyType {
  const cycleIndex = Math.floor((Math.max(1, handNumber) - 1) / HANDS_PER_STRATEGY) % STRATEGY_CYCLE.length;
  return STRATEGY_CYCLE[cycleIndex];
}

/**
 * 개별 성향을 유지하면서 테이블 분위기만 가산
 */
export function applyStrategyToPersona(
  persona: BotPersona,
  strategy: StrategyType
): BotPersona {
  const profile = STRATEGY_PROFILES[strategy];
  return {
    ...persona,
    vpip: Math.max(0.05, Math.min(0.90, 0.30 + (persona.vpip - 0.18) * 0.80 + (profile.vpip - 0.35) * 0.25)),
    aggression: Math.max(0.05, Math.min(0.95, 0.35 + (persona.aggression - 0.20) * 0.85 + (profile.aggression - 0.55) * 0.25)),
    bluffFreq: Math.max(0.005, Math.min(0.55, persona.bluffFreq + (profile.bluffFreq - 0.15) * 0.20)),
    style: `${persona.style} [${profile.name}]`,
  };
}

// Stable pseudo-random mood for one character/seat/hand. Do not re-roll after
// every bet or use remaining stack: stack + totalBet reconstructs starting chips.
function moodRoll(key: string): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}

export function individualLivePersona(base: BotPersona, hand: number, seat: number, startingStack: number) {
  const normal = applyStrategyToPersona(base, getStrategyForHand(Math.max(1, hand)));
  const tight = base.vpip <= 0.30 && base.aggression <= 0.55;
  const aggressive = base.aggression > 0.70;
  const short = startingStack > 0 && startingStack <= 10000;
  const frequency = tight ? (short ? 0.40 : 0.12) : aggressive ? (short ? 0.08 : 0.03) : (short ? 0.18 : 0.07);
  const key = `${base.id}:${seat}:${hand}`;
  const surge = hand > 0 && moodRoll(key) < frequency;
  if (!surge) return applyStackTraits({ ...normal, surge: false }, startingStack);
  const intensity = moodRoll(`${key}:intensity`);
  return applyStackTraits({
    ...normal, surge: true,
    vpip: Math.min(0.85, Math.max(0.45, normal.vpip + 0.22 + intensity * 0.13)),
    aggression: Math.min(0.95, Math.max(0.78, normal.aggression + 0.28 + intensity * 0.12)),
    bluffFreq: Math.min(0.40, Math.max(normal.bluffFreq, 0.12 + intensity * 0.08)),
    style: `${normal.style} · 변속`,
  }, startingStack);
}
