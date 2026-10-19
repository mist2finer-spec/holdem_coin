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
];

// 실제 유저(용사) 페르소나
export const USER_PERSONA = {
  id: "hero",
  name: "용사",
  title: "미래의 전설",
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
