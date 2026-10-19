"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Card } from "@/lib/poker-engine";
import { evaluateBestHand, scoreToCategoryName } from "@/lib/poker-engine";
import { STRATEGY_PROFILES, StrategyType, getStrategyForHand } from "@/lib/personas";
import { ActionType } from "@/lib/poker-engine";

// ============================================================
// 소켓 기반 홀덤 클라이언트 훅
// - poker-server (포트 3003)와 통신
// - TABLE_STATE 스냅샷 수신 → 렌더링
// - 시점 회전: 각 플레이어가 자신을 6시 방향(하단 중앙)으로 보게 함
// - 사전 액션 큐 지원
// ============================================================

export interface SocketSeat {
  seatId: number;
  name: string;
  isBot: boolean;
  isMe: boolean;
  stack: number;
  currentBet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  holeCards: string[]; // ["Ah", "Kd"] 또는 ["??", "??"]
}

export interface SocketTableState {
  type: "TABLE_STATE";
  handNumber: number;
  phase: string;
  buttonSeat: number;
  activeSeatId: number;
  totalPot: number;
  boardCards: string[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  mySeatId: number;
  isUserTurn: boolean;
  handInProgress: boolean;
  showdownHands: any[];
  winnerInfo: { name: string; amount: number; hand: string } | null;
  seats: SocketSeat[];
  preAction: { type: "fold" | "call" | "check"; amount: number } | null;
}

export interface LogEntry {
  id: number;
  text: string;
  tone: "system" | "action" | "win" | "taunt";
}

interface UsePokerSocketOpts {
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

// 8좌석 테이블 상대 위치 (% 단위) - 0번이 하단 중앙
const SEAT_POSITIONS = [
  { top: "90%", left: "50%" },  // 0: 하단 중앙 (나)
  { top: "78%", left: "88%" },  // 1: 우하단
  { top: "45%", left: "93%" },  // 2: 우측
  { top: "14%", left: "82%" },  // 3: 우상단
  { top: "7%",  left: "50%" },  // 4: 상단 중앙
  { top: "14%", left: "18%" },  // 5: 좌상단
  { top: "45%", left: "7%"  },  // 6: 좌측
  { top: "78%", left: "12%" },  // 7: 좌하단
];

export function usePokerSocket({ userName, onToast }: UsePokerSocketOpts) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketTableState | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [preAction, setPreAction] = useState<{
    type: "fold" | "call" | "check";
    amount: number;
  } | null>(null);
  const logIdRef = useRef(0);

  const pushLog = useCallback((text: string, tone: LogEntry["tone"] = "system") => {
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog((prev) => [...prev.slice(-50), { id, text, tone }]);
  }, []);

  // 소켓 연결
  useEffect(() => {
    // ★ 로컬 개발 환경 감지 (localhost:3000 또는 127.0.0.1:3000)
    const isLocal =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      window.location.port === "3000";

    // ★ 로컬: 직접 포트 3003, 프리뷰/프로덕션: window.location.origin + Caddy 라우팅
    const socketUrl = isLocal ? "http://localhost:3003" : window.location.origin;

    const socketOpts: any = {
      path: "/socket.io/",
      // ★ polling만 사용 (websocket 안정성 문제로 인해)
      // 안정화 후 websocket 추가 예정
      transports: ["polling"],
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      // ★ 프리뷰/프로덕션에서는 Caddy를 통해 XTransformPort=3003으로 라우팅
      ...(isLocal ? {} : { query: { XTransformPort: "3003" } }),
    };

    const socket = io(socketUrl, socketOpts);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[Socket] 연결됨:", socket.id, "(transport:", socket.io.engine.transport.name, ")");
      // 입장
      socket.emit("JOIN_ROOM", { name: userName });
    });

    socket.on("connect_error", (err: any) => {
      console.error("[Socket] 연결 에러:", err.message);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("[Socket] 연결 끊김");
    });

    socket.on("TABLE_STATE", (data: SocketTableState) => {
      console.log("[Socket] TABLE_STATE 수신:", data.phase, "mySeat:", data.mySeatId);
      setState(data);
      setPreAction(data.preAction);
    });

    socket.on("PLAYER_ACTION", (data: { seatId: number; name: string; action: string; amount: number }) => {
      pushLog(`${data.name}: ${data.action}`, "action");
    });

    socket.on("SYSTEM_NOTICE", (data: { messages: string[] }) => {
      if (data.messages) {
        data.messages.forEach((msg) => {
          pushLog(msg, "system");
          if (msg.includes("승리") || msg.includes("Split")) {
            onToast?.(msg, "win");
          } else if (msg.includes("시간 초과")) {
            onToast?.(msg, "lose");
          } else {
            onToast?.(msg, "info");
          }
        });
      }
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  // 액션 전송
  const submitUserAction = useCallback((action: ActionType, amount: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit("PLAYER_ACTION", { action, amount });
  }, []);

  // 사전 액션 설정/취소
  const setPreActionQ = useCallback((action: {
    type: "fold" | "call" | "check";
    amount: number;
  } | null) => {
    setPreAction(action);
    if (socketRef.current) {
      socketRef.current.emit("PRE_ACTION", action);
    }
  }, []);

  // ★ 시점 회전: 내 좌석을 0번(하단 중앙)으로 오도록 좌석 배열 회전
  const getRotatedSeats = useCallback(() => {
    if (!state || state.mySeatId < 0) return state?.seats ?? [];
    const offset = state.mySeatId; // 내 좌석이 0번이 되도록
    const rotated = [];
    for (let i = 0; i < 8; i++) {
      const origIdx = (i + offset) % 8;
      const seat = state.seats[origIdx];
      if (seat) {
        rotated.push({
          ...seat,
          seatId: i, // 회전된 인덱스
          isMe: i === 0, // 0번이 나
          position: SEAT_POSITIONS[i],
        });
      }
    }
    return rotated;
  }, [state]);

  // 회전된 활성 좌석 ID
  const getRotatedActiveSeatId = useCallback(() => {
    if (!state || state.activeSeatId < 0 || state.mySeatId < 0) return -1;
    return (state.activeSeatId - state.mySeatId + 8) % 8;
  }, [state]);

  // 회전된 버튼 좌석 ID
  const getRotatedButtonSeat = useCallback(() => {
    if (!state || state.mySeatId < 0) return state?.buttonSeat ?? 0;
    return (state.buttonSeat - state.mySeatId + 8) % 8;
  }, [state]);

  // 유저의 현재 핸드 족보 (보드가 있을 때만)
  const userHandCategory = useCallback(() => {
    if (!state || state.mySeatId < 0) return null;
    const mySeat = state.seats[state.mySeatId];
    if (!mySeat || mySeat.holeCards.length < 2 || mySeat.holeCards[0] === "??") return null;
    if (state.boardCards.length < 3) return null;
    // 문자열을 Card로 변환
    const hole: Card[] = mySeat.holeCards.map(s => ({ rank: s[0], suit: s[1] }));
    const board: Card[] = state.boardCards.map(s => ({ rank: s[0], suit: s[1] }));
    const score = evaluateBestHand(hole, board);
    return scoreToCategoryName(score);
  }, [state]);

  // 현재 AI 전략
  const currentStrategy = state ? getStrategyForHand(state.handNumber) : "AGGRESSIVE";

  return {
    connected,
    state,
    log,
    preAction,
    setPreActionQ,
    submitUserAction,
    rotatedSeats: getRotatedSeats(),
    rotatedActiveSeatId: getRotatedActiveSeatId(),
    rotatedButtonSeat: getRotatedButtonSeat(),
    userHandCategory: userHandCategory(),
    currentStrategy,
    livePot: state?.totalPot ?? 0,
    callAmount: state?.callAmount ?? 0,
    minRaise: state?.minRaise ?? 0,
    maxRaise: state?.maxRaise ?? 0,
    isUserTurn: state?.isUserTurn ?? false,
    handInProgress: state?.handInProgress ?? false,
    phase: state?.phase ?? "PREFLOP",
    handNumber: state?.handNumber ?? 0,
    boardCards: state?.boardCards ?? [],
    showdownHands: state?.showdownHands ?? [],
    winnerInfo: state?.winnerInfo ?? null,
    showdownReveal: state?.phase === "SHOWDOWN",
    mySeatId: state?.mySeatId ?? -1,
  };
}
