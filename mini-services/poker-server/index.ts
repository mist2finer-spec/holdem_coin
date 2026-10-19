// ============================================================
// poker-server/index.ts - 8인 하이브리드 홀덤 소켓 서버
// ============================================================
// 단일 인메모리 룸 기반:
// - 8명 AI가 상시 게임 진행
// - 유저 접속 시 다음 핸드에 AI 자리 교체 (Hot-Swap)
// - 유저 이탈 시 즉시 AI로 복귀
// - 포트 3003 (Caddy ?XTransformPort=3003 로 라우팅)
// ============================================================

import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { SelfPlayTrainer } from "../../src/lib/self-play-trainer.ts";
import { RPG_BOT_POOL, BotPersona, getStrategyForHand, applyStrategyToPersona } from "../../src/lib/personas.ts";
import {
  makeDeck,
  Card,
  ActionType,
  evaluateBestHand,
  determineWinners,
  scoreToCategoryName,
} from "../../src/lib/poker-engine.ts";
import {
  classifyHandTier,
  HandTier,
  HandTierNames,
} from "../../src/lib/equity-engine.ts";

const PORT = Number(process.env.POKER_PORT || 3003);
const NUM_SEATS = 8;
const SMALL_BLIND = 100;
const BIG_BLIND = 200;
const DEFAULT_BUYIN = 20000;
const USER_TIMEOUT_MS = 15000;

// ============================================================
// 타입 정의
// ============================================================

interface ServerSeat {
  seatId: number;
  name: string;
  isBot: boolean;
  socketId: string | null; // 유저인 경우 소켓 ID
  stack: number;
  currentBet: number;
  totalBet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  hasActed: boolean;
  persona?: BotPersona;
}

interface ServerGameState {
  seats: ServerSeat[];
  board: Card[];
  pot: number;
  phase: string; // "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN"
  handNumber: number;
  buttonSeat: number;
  activeSeatId: number;
  lastActions: Record<number, string>;
  showdownReveal: boolean;
  showdownHands: any[];
  winnerInfo: { name: string; amount: number; hand: string } | null;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  raiseLevel: number;
  lastRaiseSize: number; // ★ 마지막 레이즈 크기 (표준 NLHE min-raise)
}

interface ConnectedUser {
  playerId: string;   // ★ 고유 플레이어 ID (서버 생성)
  socketId: string;
  name: string;       // 표시용 이름 (유저 입력 + 고유 번호)
  baseName: string;   // 유저가 입력한 원본 이름
  seatId: number | null; // null = 관전 중
  preAction: { type: "fold" | "call" | "check"; amount: number } | null;
}

// ============================================================
// 하이브리드 홀덤 룸
// ============================================================

export class HybridHoldemRoom {
  public state: ServerGameState;
  public trainer: SelfPlayTrainer;
  private users: Map<string, ConnectedUser> = new Map();
  private pendingJoinQueue: ConnectedUser[] = []; // ★ 핸드 종료 후 착석 대기열
  private leaveSeats: Set<number> = new Set();
  private pendingActionResolve: ((action: { action: string; amount: number }) => void) | null = null;
  private isRunning = false;

  constructor(autoStart = true) {
    this.trainer = new SelfPlayTrainer();
    this.state = this.createInitialState();
    if (autoStart) void this.startGameLoop();
  }

  get userCount() { return this.users.size; }

  private createInitialState(): ServerGameState {
    const personas: BotPersona[] = [...RPG_BOT_POOL].sort(() => Math.random() - 0.5).slice(0, NUM_SEATS);
    const seats: ServerSeat[] = [];
    for (let i = 0; i < NUM_SEATS; i++) {
      seats.push({
        seatId: i,
        name: personas[i].name,
        isBot: true,
        socketId: null,
        stack: DEFAULT_BUYIN,
        currentBet: 0,
        totalBet: 0,
        inHand: true,
        folded: false,
        allIn: false,
        holeCards: [],
        hasActed: false,
        persona: personas[i],
      });
    }
    return {
      seats,
      board: [],
      pot: 0,
      phase: "PREFLOP",
      handNumber: 0,
      buttonSeat: 0,
      activeSeatId: -1,
      lastActions: {},
      showdownReveal: false,
      showdownHands: [],
      winnerInfo: null,
      callAmount: 0,
      minRaise: BIG_BLIND,
      maxRaise: 0,
      raiseLevel: 0,
      lastRaiseSize: BIG_BLIND, // ★ 초기값 BB
    };
  }

  // ============================================================
  // 유저 접속/이탈 처리
  // ============================================================

  onUserConnect(socket: Socket, name: string) {
    // JOIN_ROOM is idempotent, including duplicate events during reconnect.
    if (this.users.has(socket.id)) {
      socket.emit("TABLE_STATE", this.createSafeSnapshot(socket.id));
      return;
    }
    if (typeof name !== "string") name = "용사";
    // ★ 고유 플레이어 ID 생성
    const playerId = `P${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const baseName = (name || "용사").trim().slice(0, 8);

    // 중복 이름 방지
    const existingNames = new Set(
      Array.from(this.users.values()).map(u => u.name)
    );
    let uniqueName = baseName;
    if (existingNames.has(baseName)) {
      let suffix = 2;
      while (existingNames.has(`${baseName}#${suffix}`)) suffix++;
      uniqueName = `${baseName}#${suffix}`;
    }

    const user: ConnectedUser = {
      playerId,
      socketId: socket.id,
      name: uniqueName,
      baseName,
      seatId: null,
      preAction: null,
    };
    this.users.set(socket.id, user);

    // ★ 핸드 진행 중인지 확인
    const handInProgress = this.state.phase !== "SHOWDOWN"
      && this.state.phase !== "HAND_END"
      && this.state.activeSeatId >= 0;

    // ★ 핵심 수정: 핸드 진행 중에는 절대 seats 배열을 건드리지 않음!
    // 오직 pendingJoinQueue에 넣고 관전 상태로 둠
    if (handInProgress) {
      this.pendingJoinQueue.push(user);
      console.log(`[User] ${user.name} 접속 → 대기열 (handInProgress, queue: ${this.pendingJoinQueue.length})`);
      socket.emit("SYSTEM_NOTICE", {
        messages: [
          `👀 [${user.name}]님이 입장했습니다.`,
          `⏳ 현재 핸드 #${this.state.handNumber}이(가) 진행 중입니다. 다음 핸드부터 참여할 수 있습니다.`,
        ],
      });
    } else {
      // 핸드 사이: 즉시 좌석 할당
      this.pendingJoinQueue.push(user);
      console.log(`[User] ${user.name} 접속 → 대기열 (핸드 사이, 즉시 할당 예정)`);
      socket.emit("SYSTEM_NOTICE", {
        messages: [`👀 [${user.name}]님이 입장했습니다. 곧 착석됩니다.`],
      });
    }

    // 관전자에게 현재 상태 전송 (순수 DTO만)
    socket.emit("TABLE_STATE", this.createSafeSnapshot(socket.id));
  }

  onUserDisconnect(socketId: string) {
    const user = this.users.get(socketId);
    if (!user) return;

    // ★ 대기열에서 제거
    const idx = this.pendingJoinQueue.findIndex(u => u.socketId === socketId);
    if (idx >= 0) this.pendingJoinQueue.splice(idx, 1);

    if (user.seatId !== null) {
      this.leaveSeats.add(user.seatId);
      // 유저가 턴 중에 나갔다면 즉시 폴드 처리
      if (this.state.activeSeatId === user.seatId && this.pendingActionResolve) {
        this.pendingActionResolve({ action: "fold", amount: 0 });
        this.pendingActionResolve = null;
      }
      user.preAction = null;
    }

    this.users.delete(socketId);
    this.broadcast("SYSTEM_NOTICE", {
      messages: [`👋 [${user.name}]님이 퇴장했습니다.`],
    });
    console.log(`[User] ${user.name} 퇴장 (남은 유저: ${this.users.size})`);
  }

  // ============================================================
  // 유저 액션 처리
  // ============================================================

  onUserAction(socketId: string, action: { action: string; amount: number }) {
    const user = this.users.get(socketId);
    if (!user || user.seatId === null) return;
    if (this.state.activeSeatId !== user.seatId) return; // 내 턴이 아니면 무시
    if (!this.pendingActionResolve) return;

    const mapped = this.mapUserAction(action);
    if (!mapped) {
      io.to(socketId).emit("ACTION_REJECTED", { message: "유효하지 않은 액션입니다." });
      return;
    }
    this.pendingActionResolve(mapped);
    this.pendingActionResolve = null;
  }

  // 사전 액션 설정/취소
  onUserPreAction(socketId: string, preAction: { type: "fold" | "call" | "check"; amount: number } | null) {
    const user = this.users.get(socketId);
    if (!user) return;
    if (preAction !== null && (!preAction || !["fold", "call", "check"].includes(preAction.type))) return;
    user.preAction = preAction ? { type: preAction.type, amount: Number.isFinite(preAction.amount) ? Math.max(0, preAction.amount) : 0 } : null;
  }

  // ============================================================
  // 핸드 간 AI <-> 유저 Hot-Swap (오직 핸드 사이에만 실행)
  // ============================================================

  private processSeatSwaps() {
    // 1) 나간 유저 자리를 AI로 복구
    for (const seatId of this.leaveSeats) {
      const seat = this.state.seats[seatId];
      const usedNames = new Set(this.state.seats.filter(s => s.seatId !== seatId).map(s => s.name));
      const avail = RPG_BOT_POOL.filter(p => !usedNames.has(p.name));
      const persona = avail.length > 0
        ? avail[Math.floor(Math.random() * avail.length)]
        : RPG_BOT_POOL[Math.floor(Math.random() * RPG_BOT_POOL.length)];
      seat.isBot = true;
      seat.name = persona.name;
      seat.socketId = null;
      seat.persona = persona;
      if (seat.stack < BIG_BLIND * 2) seat.stack = DEFAULT_BUYIN;
    }
    this.leaveSeats.clear();

    // 2) ★ pendingJoinQueue에서 대기 중인 유저를 빈 AI 자리에 할당
    //    오직 이 시점(핸드 사이)에서만 seats 배열 수정!
    while (this.pendingJoinQueue.length > 0) {
      const botSeats = this.state.seats.filter(s => s.isBot);
      if (botSeats.length === 0) break;

      const user = this.pendingJoinQueue.shift()!;
      if (this.users.get(user.socketId) !== user || user.seatId !== null) continue;
      const targetSeat = botSeats[Math.floor(Math.random() * botSeats.length)];

      targetSeat.isBot = false;
      targetSeat.name = user.name;
      targetSeat.socketId = user.socketId;
      targetSeat.persona = undefined;
      targetSeat.stack = DEFAULT_BUYIN;
      user.seatId = targetSeat.seatId;

      this.broadcast("SYSTEM_NOTICE", {
        messages: [`🔄 [${user.name}]님이 #${targetSeat.seatId + 1}번 좌석에 착석했습니다!`],
      });
      console.log(`[Swap] ${user.name} → 좌석 ${targetSeat.seatId + 1}`);
    }
  }

  // ============================================================
  // 메인 게임 루프 (서버 권위)
  // ============================================================

  private async startGameLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[GL] 하이브리드 홀덤 게임 루프 시작");

    let handCount = 0;
    while (this.isRunning) {
      try {
        handCount++;
        console.log(`[GameLoop] 핸드 ${handCount} 시작 (users: ${this.users.size})`);
        await this.playOneHand();
        console.log(`[GameLoop] 핸드 ${handCount} 완료`);
      } catch (e: any) {
        console.error("[GL ERR] 핸드 처리 에러:", e?.message || e);
        console.error(e?.stack);
        // An incomplete hand must not silently destroy already committed chips.
        this.state.seats = this.state.seats.map(seat => ({
          ...seat, stack: seat.stack + seat.totalBet, totalBet: 0, currentBet: 0,
        }));
        this.state.pot = 0;
        this.state.phase = "HAND_END";
        this.state.activeSeatId = -1;
        this.broadcast("SYSTEM_NOTICE", { messages: ["핸드 오류로 베팅을 반환하고 새 핸드를 시작합니다."] });
        await this.sleep(2000);
      }
    }
    console.log("[GL] 루프 종료");
  }

  private async playOneHand() {
    const st = this.state;

    try {
      // 핸드 시작 전 Hot-Swap
      this.processSeatSwaps();

      // 상태 리셋
      st.handNumber++;
      st.board = [];
      st.pot = 0;
      st.phase = "PREFLOP";
      st.lastActions = {};
      st.showdownReveal = false;
      st.showdownHands = [];
      st.winnerInfo = null;
      st.raiseLevel = 0;
      st.lastRaiseSize = BIG_BLIND;
      st.buttonSeat = (st.buttonSeat + 1) % NUM_SEATS;

      // 좌석 리셋 (파산 봇 리필)
      const usedNames = new Set<string>();
      st.seats.forEach(s => { if (s.isBot) usedNames.add(s.name); });
      st.seats = st.seats.map(s => {
        let persona = s.persona;
        let name = s.name;
        if (s.isBot && s.stack < BIG_BLIND * 2) {
          usedNames.delete(name);
          const avail = RPG_BOT_POOL.filter(p => !usedNames.has(p.name));
          const newP = avail.length > 0
            ? avail[Math.floor(Math.random() * avail.length)]
            : RPG_BOT_POOL[Math.floor(Math.random() * RPG_BOT_POOL.length)];
          persona = newP;
          name = newP.name;
          usedNames.add(name);
        }
        const newStack = s.stack < BIG_BLIND * 2 ? DEFAULT_BUYIN : s.stack;
        return {
          ...s,
          persona,
          name,
          stack: newStack,
          currentBet: 0,
          totalBet: 0,
          inHand: newStack >= BIG_BLIND,
          folded: false,
          allIn: false,
          holeCards: [],
          hasActed: false,
        };
      });

      // 덱 생성
      const deck = makeDeck();

      // 블라인드
      const sbSeat = (st.buttonSeat + 1) % NUM_SEATS;
      const bbSeat = (st.buttonSeat + 2) % NUM_SEATS;
      st.seats[sbSeat].currentBet = Math.min(SMALL_BLIND, st.seats[sbSeat].stack);
      st.seats[sbSeat].stack -= st.seats[sbSeat].currentBet;
      // ★ totalBet에도 블라인드 추가 (사이드팟 계산용)
      st.seats[sbSeat].totalBet += st.seats[sbSeat].currentBet;
      st.seats[bbSeat].currentBet = Math.min(BIG_BLIND, st.seats[bbSeat].stack);
      st.seats[bbSeat].stack -= st.seats[bbSeat].currentBet;
      st.seats[bbSeat].totalBet += st.seats[bbSeat].currentBet;

      // 홀카드 딜
      for (const seat of st.seats) {
        if (seat.inHand) {
          seat.holeCards = [deck.pop()!, deck.pop()!];
        }
      }

      this.broadcastTableState();
      this.broadcast("SYSTEM_NOTICE", { messages: [`◆ 핸드 #${st.handNumber} 시작`] });
      await this.sleep(800);

      // 프리플랍 베팅 (UTG부터)
      await this.runBettingRound(st.buttonSeat, 3, deck);

      // 다음 페이즈들
      await this.advancePhase(deck);
    } catch (e: any) {
      console.error(e?.stack);
      throw e;
    }
  }

  private async runBettingRound(btnSeat: number, startOffset: number, deck: Card[]) {
    const st = this.state;
    st.raiseLevel = 0;
    st.lastRaiseSize = BIG_BLIND;
    st.seats = st.seats.map(s => ({ ...s, hasActed: false }));
    st.lastActions = {};
    this.broadcastTableState();
    await this.sleep(300);

    let lastActorIdx = -1;
    // Emergency action ceiling; exceeding it refunds the incomplete hand.
    const MAX_ACTIONS = 256;
    let safety = 0;

    while (safety < MAX_ACTIONS) {
      // ★ safety를 최상단에서 증가 - 어떤 continue/break 시에도 무한루프 방지
      safety++;

      const alive = st.seats.filter(s => s.inHand && !s.folded);
      if (alive.length <= 1) break;

      const notAllIn = alive.filter(s => !s.allIn);
      // ★ 모든 생존자가 올인이면 베팅 라운드 종료 (자동 다음 스트릿/쇼다운)
      if (notAllIn.length === 0) break;

      // ★ 생존자 중 올인이 아닌 사람이 1명이고 그 사람이 이미 콜한 상태면 종료
      const maxBet = Math.max(...alive.map(s => s.currentBet));
      const needsAction = notAllIn.filter(s => !s.hasActed || s.currentBet < maxBet);
      if (needsAction.length === 0) break;

      // 다음 액터 찾기
      let actorIdx = -1;
      const startSearchFrom = lastActorIdx === -1
        ? (btnSeat + startOffset) % NUM_SEATS
        : (lastActorIdx + 1) % NUM_SEATS;

      for (let i = 0; i < NUM_SEATS; i++) {
        const idx = (startSearchFrom + i) % NUM_SEATS;
        const s = st.seats[idx];
        if (s && s.inHand && !s.folded && !s.allIn && (!s.hasActed || s.currentBet < maxBet)) {
          actorIdx = idx;
          break;
        }
      }
      if (actorIdx === -1) throw new Error("Pending actions exist without an actor");

      lastActorIdx = actorIdx;
      const actor = st.seats[actorIdx];
      st.activeSeatId = actorIdx;
      const callAmt = Math.max(0, maxBet - actor.currentBet);
      st.callAmount = callAmt;
      // ★ 표준 NLHE min-raise 규칙
      const minR = maxBet === 0
        ? BIG_BLIND
        : maxBet + st.lastRaiseSize;
      const maxR = actor.stack + actor.currentBet;
      st.minRaise = minR;
      st.maxRaise = maxR;

      this.broadcastTableState();

      // 사전 액션 체크 (유저인 경우)
      let decision: { action: ActionType; amount: number; isBluff?: boolean };
      const isUser = Boolean(!actor.isBot && actor.socketId);
      const userObj = isUser ? this.users.get(actor.socketId!) : null;

      // 사전 액션 자동 실행
      if (isUser && userObj && userObj.preAction) {
        const pa = userObj.preAction;
        userObj.preAction = null;
        let validAction: { action: ActionType; amount: number } | null = null;
        if (pa.type === "fold" && callAmt > 0) validAction = { action: "fold", amount: 0 };
        else if (pa.type === "call" && callAmt > 0) validAction = { action: "call", amount: Math.min(callAmt, actor.stack) };
        else if (pa.type === "check" && callAmt === 0) validAction = { action: "check", amount: 0 };

        if (validAction) {
          decision = validAction;
        } else {
          decision = await this.getDecision(actor, callAmt, minR, maxR, isUser || false);
        }
      } else {
        decision = await this.getDecision(actor, callAmt, minR, maxR, isUser || false);
      }

      // Validate bot decisions too. A stale/invalid decision falls back safely.
      decision = this.mapUserAction(decision) ?? { action: callAmt === 0 ? "check" : "fold", amount: 0 };
      const raisesBet = decision.action === "raise" ||
        (decision.action === "allin" && actor.currentBet + actor.stack > maxBet);
      // An all-in call is not a raise.
      if (raisesBet) {
        st.raiseLevel += 1;
        // ★ lastRaiseSize 업데이트 (표준 NLHE min-raise)
        const oldMaxBet = maxBet;
        const newBetTotal = decision.action === "allin"
          ? actor.currentBet + actor.stack
          : decision.amount;
        const raiseSize = newBetTotal - oldMaxBet;
        if (raiseSize > st.lastRaiseSize) {
          st.lastRaiseSize = raiseSize;
        }
        for (const u of this.users.values()) {
          if (u.preAction && (u.preAction.type === "call" || u.preAction.type === "check")) {
            u.preAction = null;
            this.broadcastTableState();
          }
        }
      }

      // 액션 적용
      this.applyAction(actorIdx, decision);
      const actionLabel = this.labelAction(decision.action, decision.amount, callAmt);
      st.lastActions = { ...st.lastActions, [actorIdx]: actionLabel };
      this.broadcast("PLAYER_ACTION", {
        seatId: actorIdx,
        name: actor.name,
        action: actionLabel,
        amount: decision.amount,
      });
      this.broadcastTableState();
      await this.sleep(800);

      const stillAlive = st.seats.filter(s => s.inHand && !s.folded);
    }

    const remaining = st.seats.filter(s => s.inHand && !s.folded);
    const highBet = Math.max(0, ...remaining.map(s => s.currentBet));
    if (remaining.length > 1 && remaining.some(s => !s.allIn && (!s.hasActed || s.currentBet < highBet))) {
      throw new Error("Betting action limit exceeded before round completion");
    }
    st.activeSeatId = -1;
    st.lastActions = {};

    // 베팅 팟으로 합산
    let potAdd = 0;
    st.seats = st.seats.map(s => {
      potAdd += s.currentBet;
      return { ...s, currentBet: 0, hasActed: false };
    });
    st.pot += potAdd;
    this.broadcastTableState();
    await this.sleep(400);
  }

  private async getDecision(
    actor: ServerSeat,
    callAmt: number,
    minR: number,
    maxR: number,
    isUser: boolean
  ): Promise<{ action: ActionType; amount: number; isBluff?: boolean }> {
    if (isUser) {
      // 유저 액션 대기 (15초 타임아웃)
      if (!this.users.has(actor.socketId!)) return { action: "fold", amount: 0 };
      const action = await this.waitForUserAction(actor.socketId!);
      return action;
    } else {
      await this.sleep(400 + Math.random() * 400);
      const persona = applyStrategyToPersona(actor.persona || RPG_BOT_POOL[0], getStrategyForHand(this.state.handNumber));
      const livePot = this.state.pot + this.state.seats.reduce((sum, seat) => sum + seat.currentBet, 0);
      const opponents = this.state.seats.filter(seat => seat.inHand && !seat.folded).length - 1;
      const nn = this.trainer.decideActionForLive(
        actor.holeCards, this.state.board, callAmt, minR, maxR, livePot,
        actor.stack, actor.currentBet, opponents, actor.seatId, NUM_SEATS,
        this.state.raiseLevel, this.state.buttonSeat,
        { vpip: persona.vpip, aggression: persona.aggression, bluffFreq: persona.bluffFreq }
      );
      const decision = this.mapNNAction(nn, callAmt, actor.stack);
      // Optional blind defence only overrides a fold, never a strong-hand raise.
      const isBlind = actor.seatId === (this.state.buttonSeat + 1) % NUM_SEATS ||
        actor.seatId === (this.state.buttonSeat + 2) % NUM_SEATS;
      const highestBet = actor.currentBet + callAmt;
      const limped = this.state.raiseLevel === 0 && highestBet <= BIG_BLIND;
      const smallOpen = this.state.raiseLevel === 1 && highestBet >= 2 * BIG_BLIND && highestBet <= 3 * BIG_BLIND;
      const { rawEquity } = classifyHandTier(actor.holeCards, []);
      const odds = callAmt / Math.max(1, livePot + callAmt);
      // Modest extra calls; exclude large pressure and very large equity deficits.
      if (decision.action === "fold" && this.state.board.length === 0 && isBlind &&
          callAmt > 0 && callAmt < actor.stack && callAmt <= actor.stack * 0.1 &&
          (limped || smallOpen) && rawEquity >= odds - 0.1 && Math.random() < 0.5) {
        return { action: "call", amount: callAmt };
      }
      return decision;
    }
  }

  private async waitForUserAction(socketId: string): Promise<{ action: ActionType; amount: number }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingActionResolve = null;
        const callAmt = this.state.callAmount;
        const autoAction = callAmt === 0
          ? { action: "check" as ActionType, amount: 0 }
          : { action: "fold" as ActionType, amount: 0 };
        this.broadcast("SYSTEM_NOTICE", { messages: ["⏱ 시간 초과! 자동 액션"] });
        resolve(autoAction);
      }, USER_TIMEOUT_MS);

      this.pendingActionResolve = (act) => {
        clearTimeout(timer);
        resolve(act as { action: ActionType; amount: number });
      };
    });
  }

  private mapUserAction(act: unknown): { action: ActionType; amount: number } | null {
    const actor = this.state.seats[this.state.activeSeatId];
    if (!actor || !actor.inHand || actor.folded || actor.allIn || !act || typeof act !== "object") return null;
    const { action, amount } = act as { action?: string; amount?: number };
    const maxBet = Math.max(0, ...this.state.seats.filter(s => s.inHand && !s.folded).map(s => s.currentBet));
    const call = Math.max(0, maxBet - actor.currentBet);
    const maxRaise = actor.currentBet + actor.stack;
    switch (action) {
      case "fold": return { action, amount: 0 };
      case "check": return call === 0 ? { action, amount: 0 } : null;
      case "call": return call > 0 ? { action: call >= actor.stack ? "allin" : "call", amount: Math.min(call, actor.stack) } : { action: "check", amount: 0 };
      case "allin": return { action, amount: actor.stack };
      case "raise":
        if (!Number.isSafeInteger(amount) || amount! <= maxBet || amount! > maxRaise) return null;
        if (amount !== maxRaise && amount! < (maxBet === 0 ? BIG_BLIND : maxBet + this.state.lastRaiseSize)) return null;
        return amount === maxRaise ? { action: "allin", amount: actor.stack } : { action: "raise", amount: amount! };
      default: return null;
    }
  }

  private mapNNAction(
    nn: { action: number; amount: number; isBluff?: boolean },
    callAmt: number,
    myStack: number
  ): { action: ActionType; amount: number; isBluff?: boolean } {
    switch (nn.action) {
      case 0: return { action: "fold", amount: 0, isBluff: nn.isBluff };
      case 1:
        if (callAmt === 0) return { action: "check", amount: 0 };
        if (nn.amount >= myStack) return { action: "allin", amount: myStack };
        return { action: "call", amount: nn.amount };
      case 2:
      case 3:
        if (nn.amount >= this.state.seats[this.state.activeSeatId].currentBet + myStack) {
          return { action: "allin", amount: myStack, isBluff: nn.isBluff };
        }
        return { action: "raise", amount: nn.amount, isBluff: nn.isBluff };
      case 4: return { action: "allin", amount: myStack, isBluff: nn.isBluff };
      default: return { action: "fold", amount: 0 };
    }
  }

  private applyAction(seatId: number, decision: { action: ActionType; amount: number }) {
    const s = this.state.seats[seatId];
    if (!s) return;
    if (!Number.isSafeInteger(decision.amount) || decision.amount < 0) throw new Error("Invalid chip amount");
    let { stack, currentBet, totalBet, folded, allIn, inHand, hasActed } = s;

    switch (decision.action) {
      case "fold":
        folded = true; inHand = false; break;
      case "check": break;
      case "call": {
        const cost = Math.min(decision.amount, stack);
        stack -= cost; currentBet += cost; totalBet += cost;
        if (stack === 0) allIn = true;
        break;
      }
      case "raise": {
        const target = decision.amount;
        if (target <= currentBet || target > currentBet + stack) throw new Error("Invalid raise target");
        const cost = target - currentBet;
        stack -= cost; currentBet += cost; totalBet += cost;
        if (stack === 0) allIn = true;
        break;
      }
      case "allin": {
        const cost = stack; stack = 0;
        currentBet += cost; totalBet += cost; allIn = true;
        break;
      }
    }
    this.state.seats[seatId] = { ...s, stack, currentBet, totalBet, folded, allIn, inHand, hasActed: true };
  }

  private labelAction(action: ActionType, amount: number, callAmt: number): string {
    switch (action) {
      case "fold": return "FOLD";
      case "check": return "CHECK";
      case "call": return `CALL ${amount.toLocaleString()}`;
      case "raise": return `RAISE ${amount.toLocaleString()}`;
      case "allin": return `ALL-IN ${amount.toLocaleString()}`;
    }
  }

  // ============================================================
  // 페이즈 진행
  // ============================================================

  private async advancePhase(deck: Card[]) {
    const st = this.state;
    const alive = st.seats.filter(s => s.inHand && !s.folded);

    if (alive.length <= 1) {
      await this.finishHand(false);
      return;
    }

    // ★ 모든 생존자가 올인이면 베팅 없이 보드를 끝까지 펼치고 쇼다운
    const allIn = alive.every(s => s.allIn);
    if (allIn) {
      // 남은 보드 카드를 모두 펼침
      while (st.board.length < 5) {
        deck.pop(); // burn
        st.board = [...st.board, deck.pop()!];
        this.broadcastTableState();
        await this.sleep(800);
      }
      await this.doShowdown();
      return;
    }

    if (st.phase === "PREFLOP") {
      // 플랍 3장
      deck.pop(); // burn
      const flop = [deck.pop()!, deck.pop()!, deck.pop()!];
      st.board = [...st.board, ...flop];
      st.phase = "FLOP";
      this.broadcastTableState();
      await this.runBettingRound(st.buttonSeat, 1, deck);
      await this.advancePhase(deck);
    } else if (st.phase === "FLOP") {
      deck.pop();
      const turn = deck.pop()!;
      st.board = [...st.board, turn];
      st.phase = "TURN";
      this.broadcastTableState();
      await this.runBettingRound(st.buttonSeat, 1, deck);
      await this.advancePhase(deck);
    } else if (st.phase === "TURN") {
      deck.pop();
      const river = deck.pop()!;
      st.board = [...st.board, river];
      st.phase = "RIVER";
      this.broadcastTableState();
      await this.runBettingRound(st.buttonSeat, 1, deck);
      await this.advancePhase(deck);
    } else if (st.phase === "RIVER") {
      await this.doShowdown();
    }
  }

  private async doShowdown() {
    const st = this.state;
    st.showdownReveal = true;
    st.phase = "SHOWDOWN";
    this.broadcastTableState();
    await this.sleep(1500);

    const contenders = st.seats.filter(s => s.inHand && !s.folded);
    const winnerIndices = determineWinners(
      contenders.map(c => ({ holeCards: c.holeCards })),
      st.board
    );

    st.showdownHands = contenders.map((c, i) => {
      const score = evaluateBestHand(c.holeCards, st.board);
      return {
        seatId: c.seatId,
        name: c.name,
        handCategory: scoreToCategoryName(score),
        isWinner: winnerIndices.includes(i),
        isUser: !c.isBot,
      };
    });

    this.broadcastTableState();
    await this.sleep(500);

    await this.finishHand(true);
  }

  private async finishHand(isShowdown: boolean) {
    const st = this.state;
    const alive = st.seats.filter(s => s.inHand && !s.folded);

    // ★ 사이드팟 계산
    // 각 플레이어의 totalBet (이번 핸드에 베팅한 총액)를 기준으로
    // 메인팟과 사이드팟을 분리
    const pots = this.calculateSidePots(alive);

    console.log(`[Finish] pots: ${pots.length}개`);
    for (const pot of pots) {
      console.log(`[Finish] pot amount=${pot.amount}, eligible=${pot.eligibleSeatIds.map(s => s + 1).join(",")}`);
    }

    // 각 팟별로 승자 결정 및 분배
    const allWinners: { seatId: number; amount: number; handName: string }[] = [];
    let totalWinnerAmount = 0;
    let bestHandName = "";

    for (const pot of pots) {
      if (pot.eligibleSeats.length === 0) continue;
      if (pot.amount === 0) continue;

      let potWinners: number[];
      if (pot.eligibleSeats.length === 1) {
        // 한 명만 남은 팟 (다른 사람이 폴드)
        potWinners = [0];
      } else {
        potWinners = determineWinners(
          pot.eligibleSeats.map(s => ({ holeCards: s.holeCards })),
          st.board
        );
      }

      const potWinningSeats = potWinners.map(i => pot.eligibleSeats[i]);
      const share = Math.floor(pot.amount / potWinningSeats.length);
      const remainder = pot.amount - share * potWinningSeats.length;

      // 스택에 추가
      st.seats = st.seats.map(s => {
        const idx = potWinningSeats.findIndex(ws => ws.seatId === s.seatId);
        if (idx >= 0) {
          const bonus = idx === 0 ? remainder : 0;
          return { ...s, stack: s.stack + share + bonus };
        }
        return s;
      });

      // 승자 정보 기록
      for (let i = 0; i < potWinningSeats.length; i++) {
        const ws = potWinningSeats[i];
        const handName = isShowdown
          ? scoreToCategoryName(evaluateBestHand(ws.holeCards, st.board))
          : "기본 승";
        allWinners.push({ seatId: ws.seatId, amount: share + (i === 0 ? remainder : 0), handName });
        totalWinnerAmount += share + (i === 0 ? remainder : 0);
        if (!bestHandName && isShowdown) bestHandName = handName;
      }
    }

    // 승자 정보 표시 (총 획득액 기준)
    const winnerNames = [...new Set(allWinners.map(w => st.seats[w.seatId].name))].join(", ");
    const displayHand = isShowdown ? bestHandName : (alive.length === 1 ? "기본 승 (모두 폴드)" : "");
    st.winnerInfo = { name: winnerNames, amount: totalWinnerAmount, hand: displayHand };

    st.pot = 0;
    st.seats = st.seats.map(seat => ({ ...seat, currentBet: 0, totalBet: 0 }));
    st.phase = isShowdown ? "SHOWDOWN" : "HAND_END";
    this.broadcastTableState();

    // 결과 표시 5초 유지
    await this.sleep(5000);
    st.winnerInfo = null;
    st.showdownReveal = false;
    st.showdownHands = [];
    this.broadcastTableState();
  }

  // ============================================================
  // ★ 사이드팟 계산 (핵심 로직)
  // ============================================================
  // 올인한 금액별로 팟을 분리:
  // - 메인팟: 가장 적게 올인한 사람의 금액까지
  // - 사이드팟: 그 이상의 금액
  //
  // 예: A 올인 15000, B 올인 20000, C 콜 20000
  // → 메인팟: 15000 × 3 = 45000 (A, B, C 모두 참여)
  // → 사이드팟1: (20000-15000) × 2 = 10000 (B, C만 참여)
  // A가 이기면 메인팟 45000만 가져감, 사이드팟은 B vs C
  // ============================================================

  private calculateSidePots(alive: ServerSeat[]): {
    amount: number;
    eligibleSeats: ServerSeat[];
    eligibleSeatIds: number[];
  }[] {
    const contributors = this.state.seats.filter(seat => seat.totalBet > 0);
    const levels = [...new Set(contributors.map(seat => seat.totalBet))].sort((a, b) => a - b);
    const pots: { amount: number; eligibleSeats: ServerSeat[]; eligibleSeatIds: number[] }[] = [];
    let previous = 0;
    for (const level of levels) {
      const layer = contributors.filter(seat => seat.totalBet >= level);
      const eligibleSeats = alive.filter(seat => seat.totalBet >= level);
      if (eligibleSeats.length === 0) throw new Error("Pot layer has no eligible player");
      const amount = (level - previous) * layer.length;
      const eligibleSeatIds = eligibleSeats.map(seat => seat.seatId);
      const last = pots[pots.length - 1];
      if (last && last.eligibleSeatIds.join(",") === eligibleSeatIds.join(",")) last.amount += amount;
      else pots.push({ amount, eligibleSeats, eligibleSeatIds });
      previous = level;
    }
    return pots;
  }

  // ============================================================
  // 상태 마스킹 & 브로드캐스트 (순수 DTO만 전송)
  // ============================================================

  // ★ 순수 JSON DTO만 생성 (socket 참조, 순환 참조 완전 차단)
  private createSafeSnapshot(socketId: string | null) {
    const st = this.state;
    const user = socketId ? this.users.get(socketId) : null;
    const mySeatId = user?.seatId ?? -1;
    const isShowdown = st.phase === "SHOWDOWN";
    const handInProgress = st.phase !== "SHOWDOWN"
      && st.phase !== "HAND_END"
      && st.activeSeatId >= 0
      && Boolean(user)
      && (mySeatId < 0 || !st.seats[mySeatId]?.inHand);

    // ★ 모든 값을 원시 타입으로 매핑 (Number, String, Boolean, Array)
    const totalPot = Number(st.pot || 0) + st.seats.reduce((a, s) => a + Number(s.currentBet || 0), 0);

    // 순수 배열로 복사 (참조 끊기)
    const boardCards = st.board.map(c => String(c.rank) + String(c.suit));

    // seats를 순수 DTO로 매핑
    const seats = st.seats.map(s => {
      const isMe = s.seatId === mySeatId;
      const reveal = isMe || (isShowdown && !s.folded);
      const rawHole = s.holeCards.map(c => String(c.rank) + String(c.suit));
      return {
        seatId: Number(s.seatId),
        name: String(s.name || ""),
        isBot: Boolean(s.isBot),
        isMe: Boolean(isMe),
        stack: Number(s.stack || 0),
        currentBet: Number(s.currentBet || 0),
        inHand: Boolean(s.inHand),
        folded: Boolean(s.folded),
        allIn: Boolean(s.allIn),
        holeCards: reveal ? rawHole : (rawHole.length > 0 ? ["??", "??"] : []),
      };
    });

    // showdownHands도 순수 DTO로
    const showdownHands = Array.isArray(st.showdownHands)
      ? st.showdownHands.map(h => ({
          seatId: Number(h.seatId),
          name: String(h.name || ""),
          handCategory: String(h.handCategory || ""),
          isWinner: Boolean(h.isWinner),
          isUser: Boolean(h.isUser),
        }))
      : [];

    // winnerInfo도 순수 DTO로
    const winnerInfo = st.winnerInfo
      ? {
          name: String(st.winnerInfo.name || ""),
          amount: Number(st.winnerInfo.amount || 0),
          hand: String(st.winnerInfo.hand || ""),
        }
      : null;

    return {
      type: "TABLE_STATE",
      handNumber: Number(st.handNumber || 0),
      phase: String(st.phase || "PREFLOP"),
      buttonSeat: Number(st.buttonSeat || 0),
      activeSeatId: Number(st.activeSeatId ?? -1),
      totalPot: Number(totalPot),
      boardCards,
      callAmount: Number(st.callAmount || 0),
      minRaise: Number(st.minRaise || 0),
      maxRaise: Number(st.maxRaise || 0),
      mySeatId: Number(mySeatId),
      myPlayerId: user?.playerId ?? null,
      myName: user?.name ?? null,
      isUserTurn: Boolean(st.activeSeatId === mySeatId && mySeatId >= 0 && st.seats[mySeatId]?.inHand),
      handInProgress: Boolean(handInProgress),
      showdownHands,
      winnerInfo,
      seats,
      preAction: user?.preAction ? { type: user.preAction.type, amount: user.preAction.amount } : null,
    };
  }

  private broadcast(event: string, data: any) {
    io.emit(event, data);
  }

  // ★ 각 클라이언트마다 순수 DTO 스냅샷 전송
  private broadcastTableState() {
    if (this.users.size === 0) return;
    for (const [socketId] of this.users) {
      const snapshot = this.createSafeSnapshot(socketId);
      io.to(socketId).emit("TABLE_STATE", snapshot);
    }
  }

  // ★ 특정 소켓 제외하고 브로드캐스트
  private broadcastExcept(event: string, data: any, exceptSocketId: string) {
    for (const [socketId] of this.users) {
      if (socketId !== exceptSocketId) {
        io.to(socketId).emit(event, data);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }
}

// ============================================================
// 서버 시작
// ============================================================

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

if (process.env.POKER_TEST_MODE !== "1") {
  const room = new HybridHoldemRoom();

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] 연결: ${socket.id}`);

    socket.on("JOIN_ROOM", (data: { name: string }) => {
      room.onUserConnect(socket, data?.name || "용사");
    });

    socket.on("PLAYER_ACTION", (data: { action: string; amount: number }) => {
      room.onUserAction(socket.id, data);
    });

    socket.on("PRE_ACTION", (data: { type: "fold" | "call" | "check"; amount: number } | null) => {
      room.onUserPreAction(socket.id, data);
    });

    socket.on("disconnect", () => {
      room.onUserDisconnect(socket.id);
    });
  });

  httpServer.on("error", error => {
    console.error("[Server] Listen failed:", error);
    process.exit(1);
  });
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🎰 8-Player Hybrid Holdem Server running on port ${PORT}`);
    console.log(`   Caddy 라우팅: ?XTransformPort=${PORT}`);
  });

  // Unexpected failures exit nonzero so the host can restart cleanly.
  process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT] 예외 발생:", err.message);
    console.error(err.stack);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[UNHANDLED] Promise 거부:", reason);
    process.exit(1);
  });

  // ★ SIGPIPE 무시 (백그라운드 파이프 끊김 방지)
  process.on("SIGPIPE", () => {
    console.warn("[SIGPIPE] 파이프 끊김 (무시됨)");
  });

  // ★ SIGTERM/SIGINT 시 정상 종료
  process.on("SIGTERM", () => {
    console.log("[Server] SIGTERM 수신, 종료 중...");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[Server] SIGINT 수신, 종료 중...");
    process.exit(0);
  });

  // ★ 헬스체크 엔드포인트 (서버 살아있는지 확인용)
  httpServer.on("request", (req, res) => {
    if (new URL(req.url || "/", "http://localhost").pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", users: room.userCount, hand: room.state.handNumber }));
    }
  });

}
