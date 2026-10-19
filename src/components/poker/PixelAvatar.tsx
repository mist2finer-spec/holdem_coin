"use client";
import { BotPersona } from "@/lib/personas";

interface Props {
  persona?: BotPersona;
  isUser?: boolean;
  size?: number;
  isActive?: boolean;
}

// 픽셀아트 스타일 RPG 캐릭터 아바타 - 각 페르소나별 고유 SVG
export function PixelAvatar({ persona, isUser, size = 64, isActive }: Props) {
  const id = isUser ? "hero" : persona?.id ?? "";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className={isActive ? "drop-shadow-[0_0_6px_rgba(255,220,120,0.8)]" : ""}
      >
        {renderCharacter(id)}
      </svg>
    </div>
  );
}

function renderCharacter(id: string) {
  switch (id) {
    case "hero": return <HeroChar />;
    case "elf_archer": return <ElfChar />;
    case "orc_berserker": return <OrcChar />;
    case "dwarf_merchant": return <DwarfChar />;
    case "goblin_thief": return <GoblinChar />;
    case "paladin_commander": return <PaladinChar />;
    case "dark_mage": return <MageChar />;
    case "wandering_bard": return <BardChar />;
    case "dragon_slayer": return <SlayerChar />;
    case "alchemist_guild": return <AlchemistChar />;
    default: return <HeroChar />;
  }
}

function px(x: number, y: number, w: number, h: number, color: string) {
  return <rect x={x} y={y} width={w} height={h} fill={color} />;
}

function HeroChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#1e293b")}
      {px(5, 1, 6, 1, "#15803d")}
      {px(4, 2, 8, 1, "#22c55e")}
      {px(5, 3, 6, 1, "#16a34a")}
      {px(5, 4, 6, 4, "#fcd9b6")}
      {px(4, 3, 1, 2, "#fde047")}
      {px(11, 3, 1, 2, "#fde047")}
      {px(6, 5, 1, 1, "#1e3a8a")}
      {px(9, 5, 1, 1, "#1e3a8a")}
      {px(7, 6, 2, 1, "#9f1239")}
      {px(4, 8, 8, 1, "#dc2626")}
      {px(3, 9, 10, 1, "#b91c1c")}
      {px(4, 9, 8, 4, "#15803d")}
      {px(5, 10, 6, 2, "#166534")}
      {px(4, 12, 8, 1, "#92400e")}
      {px(7, 12, 2, 1, "#fbbf24")}
      {px(11, 8, 1, 6, "#e2e8f0")}
      {px(11, 7, 1, 1, "#fbbf24")}
      {px(10, 14, 3, 1, "#92400e")}
    </>
  );
}

function ElfChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#022c22")}
      {px(4, 1, 8, 1, "#065f46")}
      {px(3, 2, 10, 2, "#047857")}
      {px(4, 4, 8, 1, "#065f46")}
      {px(3, 4, 1, 1, "#fcd9b6")}
      {px(12, 4, 1, 1, "#fcd9b6")}
      {px(5, 4, 6, 3, "#fde2c0")}
      {px(5, 3, 6, 1, "#fde047")}
      {px(6, 5, 1, 1, "#3b82f6")}
      {px(9, 5, 1, 1, "#3b82f6")}
      {px(7, 6, 2, 1, "#0f766e")}
      {px(12, 5, 1, 6, "#92400e")}
      {px(11, 6, 1, 4, "#fbbf24")}
      {px(13, 6, 1, 4, "#92400e")}
      {px(4, 7, 8, 1, "#047857")}
      {px(3, 8, 10, 5, "#065f46")}
      {px(5, 9, 6, 3, "#047857")}
      {px(7, 10, 2, 1, "#fbbf24")}
    </>
  );
}

function OrcChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#450a0a")}
      {px(5, 2, 6, 4, "#6b7280")}
      {px(4, 3, 8, 3, "#4b5563")}
      {px(3, 1, 2, 2, "#fafaf9")}
      {px(11, 1, 2, 2, "#fafaf9")}
      {px(6, 4, 1, 1, "#dc2626")}
      {px(9, 4, 1, 1, "#dc2626")}
      {px(5, 6, 1, 1, "#fafaf9")}
      {px(10, 6, 1, 1, "#fafaf9")}
      {px(6, 5, 4, 1, "#7f1d1d")}
      {px(3, 7, 10, 5, "#451a03")}
      {px(4, 8, 8, 4, "#7c2d12")}
      {px(5, 9, 6, 2, "#9a3412")}
      {px(12, 5, 1, 8, "#78716c")}
      {px(11, 5, 3, 3, "#94a3b8")}
      {px(10, 6, 5, 1, "#cbd5e1")}
      {px(6, 10, 1, 1, "#dc2626")}
      {px(9, 11, 1, 1, "#dc2626")}
    </>
  );
}

function DwarfChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#451a03")}
      {px(4, 1, 8, 2, "#a16207")}
      {px(5, 0, 6, 1, "#ca8a04")}
      {px(4, 3, 8, 1, "#854d0e")}
      {px(5, 3, 6, 3, "#fcd9b6")}
      {px(4, 5, 8, 3, "#78350f")}
      {px(5, 5, 6, 4, "#92400e")}
      {px(6, 8, 4, 2, "#78350f")}
      {px(6, 4, 1, 1, "#1c1917")}
      {px(9, 4, 1, 1, "#1c1917")}
      {px(3, 8, 10, 4, "#7c2d12")}
      {px(4, 9, 8, 3, "#9a3412")}
      {px(7, 9, 2, 2, "#22d3ee")}
      {px(7, 9, 1, 1, "#a5f3fc")}
      {px(11, 12, 1, 1, "#fbbf24")}
      {px(4, 12, 1, 1, "#fbbf24")}
      {px(12, 11, 1, 1, "#fbbf24")}
    </>
  );
}

function GoblinChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#1a2e05")}
      {px(4, 1, 8, 1, "#365314")}
      {px(3, 2, 10, 1, "#4d7c0f")}
      {px(2, 4, 2, 1, "#84cc16")}
      {px(12, 4, 2, 1, "#84cc16")}
      {px(5, 3, 6, 4, "#a3e635")}
      {px(4, 4, 8, 3, "#84cc16")}
      {px(6, 5, 1, 1, "#facc15")}
      {px(9, 5, 1, 1, "#facc15")}
      {px(6, 6, 4, 1, "#1a2e05")}
      {px(7, 7, 1, 1, "#fafaf9")}
      {px(9, 7, 1, 1, "#fafaf9")}
      {px(3, 7, 10, 5, "#365314")}
      {px(4, 8, 8, 4, "#4d7c0f")}
      {px(5, 9, 6, 3, "#3f6212")}
      {px(12, 8, 1, 5, "#e2e8f0")}
      {px(11, 12, 3, 1, "#92400e")}
    </>
  );
}

function PaladinChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#422006")}
      {px(5, 0, 6, 1, "#fef08a")}
      {px(4, 1, 8, 1, "#fde047")}
      {px(4, 2, 8, 3, "#ca8a04")}
      {px(5, 2, 6, 1, "#facc15")}
      {px(4, 4, 8, 1, "#a16207")}
      {px(5, 4, 6, 2, "#fcd9b6")}
      {px(6, 5, 1, 1, "#1e40af")}
      {px(9, 5, 1, 1, "#1e40af")}
      {px(3, 6, 10, 1, "#a16207")}
      {px(3, 7, 10, 5, "#ca8a04")}
      {px(4, 8, 8, 4, "#eab308")}
      {px(5, 9, 6, 3, "#facc15")}
      {px(7, 8, 2, 4, "#fef3c7")}
      {px(5, 9, 6, 2, "#fef3c7")}
      {px(7, 9, 2, 2, "#fffbeb")}
    </>
  );
}

function MageChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#2e1065")}
      {px(7, 0, 2, 1, "#1e1b4b")}
      {px(6, 1, 4, 1, "#4c1d95")}
      {px(5, 2, 6, 1, "#5b21b6")}
      {px(4, 3, 8, 2, "#6d28d9")}
      {px(7, 0, 1, 1, "#fde047")}
      {px(5, 5, 6, 3, "#e9d5ff")}
      {px(6, 6, 1, 1, "#a855f7")}
      {px(9, 6, 1, 1, "#a855f7")}
      {px(7, 7, 2, 1, "#1e1b4b")}
      {px(3, 8, 10, 6, "#4c1d95")}
      {px(4, 9, 8, 5, "#5b21b6")}
      {px(5, 10, 6, 4, "#6d28d9")}
      {px(12, 4, 1, 10, "#78350f")}
      {px(11, 3, 3, 2, "#c084fc")}
      {px(12, 3, 1, 1, "#fef3c7")}
      {px(6, 11, 1, 1, "#fde047")}
      {px(9, 12, 1, 1, "#fde047")}
    </>
  );
}

function BardChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#0c4a6e")}
      {px(5, 1, 6, 1, "#0369a1")}
      {px(4, 2, 8, 2, "#0284c7")}
      {px(5, 3, 6, 1, "#0ea5e9")}
      {px(10, 0, 1, 2, "#fef08a")}
      {px(5, 3, 6, 3, "#fcd9b6")}
      {px(4, 4, 1, 2, "#7c2d12")}
      {px(11, 4, 1, 2, "#7c2d12")}
      {px(6, 5, 1, 1, "#0c4a6e")}
      {px(9, 5, 1, 1, "#0c4a6e")}
      {px(7, 6, 2, 1, "#7c2d12")}
      {px(6, 6, 1, 1, "#7c2d12")}
      {px(9, 6, 1, 1, "#7c2d12")}
      {px(3, 7, 10, 1, "#0284c7")}
      {px(3, 8, 10, 5, "#0369a1")}
      {px(4, 9, 8, 4, "#0284c7")}
      {px(11, 8, 2, 4, "#92400e")}
      {px(11, 8, 2, 1, "#fbbf24")}
      {px(11, 11, 1, 1, "#fbbf24")}
      {px(12, 11, 1, 1, "#fbbf24")}
      {px(6, 9, 1, 2, "#fef08a")}
      {px(6, 9, 2, 1, "#fef08a")}
    </>
  );
}

function SlayerChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#431407")}
      {px(5, 2, 6, 3, "#9a3412")}
      {px(4, 3, 8, 2, "#c2410c")}
      {px(4, 1, 8, 1, "#7c2d12")}
      {px(3, 0, 2, 2, "#1c1917")}
      {px(11, 0, 2, 2, "#1c1917")}
      {px(5, 4, 6, 2, "#fcd9b6")}
      {px(6, 5, 1, 1, "#dc2626")}
      {px(9, 5, 1, 1, "#dc2626")}
      {px(7, 6, 2, 1, "#431407")}
      {px(8, 4, 1, 3, "#dc2626")}
      {px(3, 7, 10, 1, "#7c2d12")}
      {px(3, 8, 10, 5, "#9a3412")}
      {px(4, 9, 8, 4, "#c2410c")}
      {px(5, 10, 6, 3, "#ea580c")}
      {px(6, 10, 1, 1, "#fbbf24")}
      {px(9, 10, 1, 1, "#fbbf24")}
      {px(7, 11, 2, 1, "#fbbf24")}
      {px(11, 6, 1, 8, "#94a3b8")}
      {px(11, 6, 1, 1, "#fef3c7")}
      {px(10, 13, 3, 1, "#1c1917")}
    </>
  );
}

function AlchemistChar() {
  return (
    <>
      {px(0, 0, 16, 16, "#042f2e")}
      {px(4, 1, 8, 2, "#0f766e")}
      {px(5, 0, 6, 1, "#14b8a6")}
      {px(4, 3, 8, 1, "#115e59")}
      {px(5, 3, 6, 4, "#fcd9b6")}
      {px(5, 6, 6, 2, "#fafaf9")}
      {px(6, 7, 4, 1, "#e5e5e5")}
      {px(6, 5, 1, 1, "#0f766e")}
      {px(9, 5, 1, 1, "#0f766e")}
      {px(5, 4, 2, 1, "#94a3b8")}
      {px(9, 4, 2, 1, "#94a3b8")}
      {px(7, 4, 2, 1, "#94a3b8")}
      {px(3, 7, 10, 1, "#0f766e")}
      {px(3, 8, 10, 6, "#115e59")}
      {px(4, 9, 8, 5, "#0f766e")}
      {px(5, 10, 6, 4, "#14b8a6")}
      {px(11, 8, 2, 1, "#94a3b8")}
      {px(11, 9, 2, 4, "#67e8f9")}
      {px(10, 10, 4, 3, "#22d3ee")}
      {px(11, 11, 2, 1, "#fef3c7")}
      {px(3, 11, 2, 2, "#a3e635")}
      {px(3, 10, 2, 1, "#94a3b8")}
    </>
  );
}
