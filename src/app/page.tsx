"use client";
import { useState } from "react";
import { PokerTable } from "@/components/poker/PokerTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RPG_BOT_POOL } from "@/lib/personas";
import { PixelAvatar } from "@/components/poker/PixelAvatar";
import { toast } from "sonner";

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [userName, setUserName] = useState("용사");

  const handleToast = (msg: string, tone?: "info" | "win" | "lose") => {
    if (tone === "win") {
      toast.success(msg);
    } else if (tone === "lose") {
      toast.error(msg);
    } else {
      toast(msg, {
        style: {
          background: "rgba(20, 10, 5, 0.95)",
          color: "#fde68a",
          border: "1px solid rgba(217, 119, 6, 0.6)",
        },
      });
    }
  };

  if (entered) {
    return <PokerTable userName={userName} onToast={handleToast} />;
  }

  return <LobbyScreen
    userName={userName}
    setUserName={setUserName}
    onEnter={() => {
      if (!userName.trim()) {
        setUserName("용사");
      }
      setEntered(true);
    }}
  />;
}

function LobbyScreen({
  userName,
  setUserName,
  onEnter,
}: {
  userName: string;
  setUserName: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 relative overflow-hidden">
      {/* 배경 횃불 효과 */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 10% 30%, rgba(255,140,40,0.4) 0%, transparent 12%),
                            radial-gradient(circle at 90% 30%, rgba(255,140,40,0.4) 0%, transparent 12%),
                            radial-gradient(circle at 50% 100%, rgba(60,40,20,0.5) 0%, transparent 40%)`
        }}
      />
      {/* 별빛 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(2px 2px at 20% 20%, #fde047, transparent),
                            radial-gradient(1px 1px at 80% 15%, #fef3c7, transparent),
                            radial-gradient(1.5px 1.5px at 60% 25%, #fbbf24, transparent),
                            radial-gradient(1px 1px at 30% 40%, #fef08a, transparent),
                            radial-gradient(2px 2px at 70% 50%, #fde047, transparent)`,
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 px-6 py-1 rounded-full mb-3 border-2 border-amber-300 shadow-lg">
            <span className="text-amber-950 text-[11px] font-bold tracking-[0.3em]">◆ TAVERN POKER ◆</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-3 tracking-tight"
            style={{
              background: "linear-gradient(180deg, #fde68a 0%, #d97706 60%, #78350f 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}
          >
            RPG 홀덤 여관
          </h1>
          <p className="text-amber-200/80 text-sm md:text-base italic">
            ♪ 여덟 영웅이 모인 테이블, 패 한 장에 운명이 갈린다 ♪
          </p>
        </div>

        {/* 캐릭터 라인업 */}
        <div className="bg-slate-950/70 border-2 border-amber-800/60 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="text-amber-300 text-[10px] font-bold tracking-wider mb-3 text-center">
            ◆ 오늘 밤 여관에 모인 영웅들 ◆
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {RPG_BOT_POOL.slice(0, 5).map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1 p-2 bg-slate-900/50 rounded-lg border border-amber-900/40">
                <div className={`bg-gradient-to-br ${p.color} p-[2px] rounded-md`}>
                  <div className="bg-slate-950/70 p-1 rounded">
                    <PixelAvatar persona={p} size={48} />
                  </div>
                </div>
                <div className={`text-[10px] font-bold ${p.accent}`}>{p.name}</div>
                <div className="text-[8px] text-slate-400 text-center">{p.title}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {RPG_BOT_POOL.slice(5).map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1 p-2 bg-slate-900/50 rounded-lg border border-amber-900/40">
                <div className={`bg-gradient-to-br ${p.color} p-[2px] rounded-md`}>
                  <div className="bg-slate-950/70 p-1 rounded">
                    <PixelAvatar persona={p} size={40} />
                  </div>
                </div>
                <div className={`text-[9px] font-bold ${p.accent}`}>{p.name}</div>
                <div className="text-[8px] text-slate-400 text-center">{p.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 입장 폼 */}
        <div className="bg-slate-950/85 border-2 border-amber-700 rounded-xl p-6 backdrop-blur-md shadow-2xl max-w-md mx-auto">
          <div className="text-amber-300 text-xs font-bold tracking-wider mb-3 text-center">
            ⚔️ 용사의 이름을 알려주세요
          </div>
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
            placeholder="용사"
            maxLength={12}
            className="bg-slate-900 border-amber-700 text-amber-100 text-center font-bold text-lg mb-4"
          />

          <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
            <div className="bg-slate-900/70 rounded p-2 border border-amber-800/40">
              <div className="text-amber-400 font-bold mb-1">◆ 시스템</div>
              <div className="text-slate-300">
                8인 NL 텍사스 홀덤<br/>
                SB 100 / BB 200<br/>
                시작 스택: 20,000
              </div>
            </div>
            <div className="bg-slate-900/70 rounded p-2 border border-amber-800/40">
              <div className="text-amber-400 font-bold mb-1">◆ 봇 AI</div>
              <div className="text-slate-300">
                9종 RPG 페르소나<br/>
                VPIP / 어그로 / 블러프<br/>
                팟 오즈 기반 의사결정
              </div>
            </div>
          </div>

          <Button
            onClick={onEnter}
            className="w-full bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black text-lg py-5 border-2 border-amber-300 shadow-lg"
          >
            🎲 테이블 착석하기
          </Button>
          <div className="text-amber-200/40 text-[10px] text-center mt-2">
            착석하면 AI가 자리를 비켜줍니다
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="text-center mt-6 text-amber-200/60 text-[10px]">
          프로토타입 비주얼 데모 · Python WebSocket 서버 코드 기반 시뮬레이션
        </div>
      </div>
    </div>
  );
}
