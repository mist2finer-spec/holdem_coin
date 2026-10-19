"use client";
import { TrainingStats } from "@/lib/self-play-trainer";
import { Button } from "@/components/ui/button";

interface Props {
  stats: TrainingStats;
  onSetMode: (mode: "HEURISTIC" | "NEURAL" | "HYBRID") => void;
  onToggle: () => void;
  onReset: () => void;
}

export function TrainingPanel({ stats, onSetMode, onToggle, onReset }: Props) {
  const foldPct = (stats.emaFoldRate * 100).toFixed(1);
  const allinPct = (stats.emaAllInRate * 100).toFixed(1);
  const avgPotK = (stats.emaAvgPot / 1000).toFixed(1);
  const loss = stats.emaLoss.toFixed(2);
  const baseline = stats.baselineValue.toFixed(3);
  const eps = stats.episodes.toLocaleString();

  // 학습 품질 등급 (fold/allin 비율 기반)
  const quality = stats.emaFoldRate > 0.4 && stats.emaAllInRate < 0.15
    ? { label: "EXPERT", color: "text-emerald-300", bg: "bg-emerald-900/60 border-emerald-500" }
    : stats.emaFoldRate > 0.3 && stats.emaAllInRate < 0.25
    ? { label: "STABLE", color: "text-amber-300", bg: "bg-amber-900/60 border-amber-500" }
    : stats.emaFoldRate > 0.2
    ? { label: "LEARNING", color: "text-orange-300", bg: "bg-orange-900/60 border-orange-500" }
    : { label: "CHAOTIC", color: "text-rose-300", bg: "bg-rose-900/60 border-rose-500" };

  return (
    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 w-[min(520px,80vw)]">
      <div className="bg-slate-950/95 border border-amber-700/60 rounded-lg shadow-2xl backdrop-blur-md p-1.5">
        {/* 헤더 행 */}
        <div className="flex items-center justify-between mb-1 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-300 text-[9px] font-bold tracking-wider">
              ◆ AI TRAINING
            </span>
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${quality.bg} ${quality.color}`}>
              {quality.label}
            </span>
            <span className={`text-[8px] px-1 py-0.5 rounded ${stats.isRunning ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
              {stats.isRunning ? "●" : "○"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="outline"
              className={`h-4 px-1 text-[8px] ${stats.mode === "HEURISTIC" ? "bg-amber-700 text-amber-50 border-amber-400" : "border-amber-700/50 text-amber-200 hover:bg-amber-900/30"}`}
              onClick={() => onSetMode("HEURISTIC")}
            >
              HEUR
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`h-4 px-1 text-[8px] ${stats.mode === "HYBRID" ? "bg-amber-700 text-amber-50 border-amber-400" : "border-amber-700/50 text-amber-200 hover:bg-amber-900/30"}`}
              onClick={() => onSetMode("HYBRID")}
            >
              HYBRID
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`h-4 px-1 text-[8px] ${stats.mode === "NEURAL" ? "bg-amber-700 text-amber-50 border-amber-400" : "border-amber-700/50 text-amber-200 hover:bg-amber-900/30"}`}
              onClick={() => onSetMode("NEURAL")}
            >
              NEURAL
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-4 px-1 text-[8px] text-amber-300 hover:bg-amber-900/30"
              onClick={onToggle}
            >
              {stats.isRunning ? "⏸" : "▶"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-4 px-1 text-[8px] text-rose-300 hover:bg-rose-900/30"
              onClick={onReset}
              title="학습 초기화"
            >
              ⟲
            </Button>
          </div>
        </div>

        {/* 통계 그리드 - 6 columns compact */}
        <div className="grid grid-cols-6 gap-0.5 text-center">
          <Stat label="EP" value={eps} tone="amber" />
          <Stat label="FOLD%" value={`${foldPct}%`} tone={stats.emaFoldRate > 0.3 ? "emerald" : "rose"} />
          <Stat label="ALLIN%" value={`${allinPct}%`} tone={stats.emaAllInRate < 0.2 ? "emerald" : "rose"} />
          <Stat label="POT" value={`${avgPotK}k`} tone="amber" />
          <Stat label="LOSS" value={loss} tone="purple" />
          <Stat label="BASE" value={baseline} tone="sky" />
        </div>

        {/* 학습 진행 바 */}
        <div className="mt-1 px-0.5">
          <div className="flex items-center justify-between text-[8px] text-amber-200/60 mb-0.5">
            <span className="truncate">FOLD RATE (목표 35~55%) · {stats.mode === "HEURISTIC" ? "수학 엔진" : stats.mode === "NEURAL" ? "신경망" : "신경망+에퀴티"}</span>
            <span className="tabular-nums ml-1">{foldPct}%</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, stats.emaFoldRate * 200)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneClass = {
    amber: "text-amber-200",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    purple: "text-purple-300",
    sky: "text-sky-300",
  }[tone] || "text-amber-200";

  return (
    <div className="bg-slate-900/60 rounded border border-amber-900/30 px-1 py-0.5">
      <div className="text-[8px] text-amber-200/60 font-bold tracking-wider">{label}</div>
      <div className={`text-[11px] font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
