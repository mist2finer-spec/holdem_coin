"use client";
import {lobbyToken} from "@/lib/lobby-client";
import {handHistoryCSV,type HandHistory} from '@/lib/poker-hand-history';
import {browserHistory,mergeHandHistories,downloadHistoryFile} from '@/lib/poker-hand-history-client';
import { LIVE_RULES } from "@/lib/poker-live";
import type { WinnerInfo } from "@/lib/poker-rules";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Card } from "@/lib/poker-engine";
import { evaluateBestHand, scoreToCategoryName } from "@/lib/poker-engine";
import { STRATEGY_PROFILES, StrategyType, getStrategyForHand } from "@/lib/personas";
import { ActionType } from "@/lib/poker-engine";
import { rotateSeatView } from "@/lib/poker-seat-view";

// ============================================================
// 소켓 기반 홀덤 클라이언트 훅
// - poker-server (포트 3003)와 통신
// - TABLE_STATE 스냅샷 수신 → 렌더링
// - 시점 회전: 각 플레이어가 자신을 6시 방향(하단 중앙)으로 보게 함
// - 사전 액션 큐 지원
// ============================================================

export interface SocketSeat {
  portrait?: number;
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
  smallBlindSeat: number;
  bigBlindSeat: number;
  actionDeadline: number;
  playerBusted: boolean;
  rebuyPending: boolean;
  activeSeatId: number;
  totalPot: number;
  boardCards: string[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  mySeatId: number;
  myPlayerId: string | null;  // ★ 서버가 부여한 고유 ID
  myName: string | null;      // ★ 서버가 부여한 고유 이름
  isUserTurn: boolean;
  handInProgress: boolean;
  showdownHands: any[];
  winnerInfo: WinnerInfo | null;
  bluffReveal: number | null;
  seats: SocketSeat[];
  preAction: { type: "fold" | "call" | "check"; amount: number } | null;
}

export interface LogEntry {
  id: number;
  text: string;
  tone: "system" | "action" | "win" | "taunt";
}

interface UsePokerSocketOpts {
  onExit?:()=>void;
  tableSize?: 6 | 8;
  userName: string;
  onToast?: (msg: string, tone?: "info" | "win" | "lose") => void;
}

export function usePokerSocket({ userName, onToast, tableSize=8, onExit }: UsePokerSocketOpts) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketTableState | null>(null);
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [preAction, setPreAction] = useState<{
    type: "fold" | "call" | "check";
    amount: number;
  } | null>(null);
  const logIdRef = useRef(0);
  const historyRef=useRef<HandHistory[]>([]);
  const [historyCount,setHistoryCount]=useState(0);
  const [historyBusy,setHistoryBusy]=useState(false);
  const historyWrites=useRef(Promise.resolve());
  const keepHistory=useCallback((hands:HandHistory[])=>{
    const merged=mergeHandHistories(historyRef.current,hands);
    historyRef.current=merged;setHistoryCount(merged.length);
    historyWrites.current=historyWrites.current.then(()=>browserHistory(userName,merged)).then(()=>{})
      .catch(()=>onToast?.('브라우저 자동 저장에 실패했습니다. JSON으로 다운로드해 주세요.','info'));
    return merged;
  },[userName,onToast]);
  useEffect(()=>{
    let active=true;
    historyRef.current=[];
    browserHistory(userName).then(hands=>{if(active)keepHistory(mergeHandHistories(hands,historyRef.current));})
      .catch(()=>onToast?.('브라우저 기록을 불러오지 못했습니다. 서버 로그 다운로드는 사용할 수 있습니다.','info'));
    return ()=>{active=false;};
  },[userName]);
  const historyHandler=useRef(keepHistory);
  useEffect(()=>{historyHandler.current=keepHistory;},[keepHistory]);
  const exportHistory=useCallback(async(format:'json'|'csv'|'admin')=>{
    if(historyBusy)return;setHistoryBusy(true);
    try {
      if(format==='admin') {
        const token=window.prompt('Render 환경변수 HAND_HISTORY_ADMIN_TOKEN을 입력하세요. 저장하지 않습니다.');
        if(!token)return;
        const response=await fetch('/api/hand-history/admin',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
        if(!response.ok)throw new Error('관리자 키를 확인해 주세요.');
        downloadHistoryFile(await response.text(),'json');return;
      }
      let hands=historyRef.current;
      if(socketRef.current?.connected) {
        const result=await socketRef.current.timeout(20000).emitWithAck('GET_HAND_HISTORY') as {hands?:HandHistory[];error?:string;writeError?:string};
        if(result.error&&!hands.length)throw new Error(result.error);
        if(result.hands)hands=historyHandler.current(result.hands);
        if(result.writeError)onToast?.('서버 파일 저장에 오류가 있습니다. 지금 다운로드한 기록을 보관해 주세요.','info');
      }
      if(!hands.length)throw new Error('완료된 핸드가 아직 없습니다.');
      downloadHistoryFile(format==='csv'?handHistoryCSV(hands):JSON.stringify({schemaVersion:1,scope:'player',exportedAt:new Date().toISOString(),hands},null,2),format);
    }catch(error){onToast?.(error instanceof Error?error.message:'로그 다운로드 실패','info');}
    finally {setHistoryBusy(false);}
  },[historyBusy,onToast]);

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
      socket.emit('LOBBY_HELLO',{token:lobbyToken()},(account:{token?:string})=>{
        if(account.token)localStorage.setItem('holdem-lobby-token',account.token);
        socket.emit("JOIN_ROOM", { name: userName, tableSize });
      });
      socket.timeout(20000).emitWithAck('GET_HAND_HISTORY')
        .then((result:{hands?:HandHistory[]})=>{if(result.hands)historyHandler.current(result.hands);})
        .catch(()=>{});
    });

    socket.on("connect_error", (err: any) => {
      setConnected(false);
      console.error("[Socket] 연결 에러:", err.message);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("[Socket] 연결 끊김");
    });

    socket.on('ROOM_EXIT',(data:{message?:string})=>{
      socket.disconnect();
      onToast?.(data.message||'방에서 퇴장했습니다.','info');
      onExit?.();
    });
    socket.on("ACTION_REJECTED", (data: { message: string }) => onToast?.(data.message, "info"));

    socket.on("TABLE_STATE", (data: SocketTableState) => {
      console.log("[Socket] TABLE_STATE 수신:", data.phase, "mySeat:", data.mySeatId);
      setState(data);
      setClock(Date.now());
      setPreAction(data.preAction);
    });

    socket.on('HAND_HISTORY',(hand:HandHistory)=>historyHandler.current([hand]));

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
  }, [userName, tableSize, onExit]);

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

  useEffect(() => {
    if (!state?.isUserTurn) return;
    const interval = setInterval(() => setClock(Date.now()), 200);
    return () => clearInterval(interval);
  }, [state?.isUserTurn, state?.actionDeadline]);

  const requestRebuy = useCallback(() => socketRef.current?.emit("REBUY"), []);

  // ★ 시점 회전: 내 좌석을 0번(하단 중앙)으로 오도록 좌석 배열 회전
  const getRotatedSeats = useCallback(() => {
    return state ? rotateSeatView(state.seats, state.mySeatId) : [];
  }, [state]);

  // 회전된 활성 좌석 ID
  const getRotatedActiveSeatId = useCallback(() => {
    if (!state || state.activeSeatId < 0) return -1;
    return (state.activeSeatId - Math.max(0, state.mySeatId) + state.seats.length) % state.seats.length;
  }, [state]);

  // 회전된 버튼 좌석 ID
  const getRotatedButtonSeat = useCallback(() => {
    if (!state || state.mySeatId < 0) return state?.buttonSeat ?? 0;
    return (state.buttonSeat - state.mySeatId + state.seats.length) % state.seats.length;
  }, [state]);

  // 유저의 현재 핸드 족보 (보드가 있을 때만)
  const userHandCategory = useCallback(() => {
    if (!state || state.mySeatId < 0) return null;
    const mySeat = state.seats[state.mySeatId];
    if (!mySeat || mySeat.holeCards.length < 2 || mySeat.holeCards[0] === "??") return null;
    if (state.boardCards.length < 3) return null;
    // 문자열을 Card로 변환
    const hole: Card[] = mySeat.holeCards.map(s => ({ rank: s[0] as Card["rank"], suit: s[1] as Card["suit"] }));
    const board: Card[] = state.boardCards.map(s => ({ rank: s[0] as Card["rank"], suit: s[1] as Card["suit"] }));
    const score = evaluateBestHand(hole, board);
    return scoreToCategoryName(score);
  }, [state]);

  // 현재 AI 전략
  const currentStrategy = state ? getStrategyForHand(state.handNumber) : "AGGRESSIVE";

  return {
    connected,
    historyCount,historyBusy,exportHistory,
    requestRebuy,
    playerBusted: state?.playerBusted ?? false,
    rebuyPending: state?.rebuyPending ?? false,
    userTimer: state?.isUserTurn ? Math.min(LIVE_RULES.userSeconds, Math.max(0, Math.ceil(((state.actionDeadline || 0) - clock) / 1000))) : 0,
    rotatedSmallBlindSeat: state ? (state.smallBlindSeat - Math.max(0, state.mySeatId) + state.seats.length) % state.seats.length : -1,
    rotatedBigBlindSeat: state ? (state.bigBlindSeat - Math.max(0, state.mySeatId) + state.seats.length) % state.seats.length : -1,
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
    bluffReveal: state?.bluffReveal ?? null,
    mySeatId: state?.mySeatId ?? -1,
    myPlayerId: state?.myPlayerId ?? null,  // ★ 고유 플레이어 ID
    myName: state?.myName ?? null,          // ★ 서버 부여 고유 이름
  };
}
