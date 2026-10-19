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

const PORT = 3003;
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

class HybridHoldemRoom {
  public state: ServerGameState;
  public trainer: SelfPlayTrainer;
  private users: Map<string, ConnectedUser> = new Map();
  private joinQueue: ConnectedUser[] = [];
  private leaveSeats: Set<number> = new Set();
  private pendingActionResolve: ((action: { action: string; amount: number }) => void) | null = null;
  private isRunning = false;

  constructor() {
    this.trainer = new SelfPlayTrainer();
    this.trainer.start();
    this.state = this.createInitialState();
    this.startGameLoop();
  }

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
    // ★ 고유 플레이어 ID 생성 (서버 사이드)
    const playerId = `P${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const baseName = (name || "용사").trim().slice(0, 8);

    // ★ 중복 이름 방지: 이미 같은 baseName을 쓰는 유저가 있으면 번호 추가
    const existingNames = new Set(
      Array.from(this.users.values()).map(u => u.baseName)
    );
    let uniqueName = baseName;
    if (existingNames.has(baseName)) {
      // 같은 이름이 있으면 #2, #3... 번호 추가
      let suffix = 2;
      while (existingNames.has(`${baseName}#${suffix}`)) {
        suffix++;
      }
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

    // 빈 자리 찾기 (BB+2 = UTG 자리 우선, 없으면 아무 빈 AI 자리)
    const botSeats = this.state.seats.filter(s => s.isBot);
    const hasEmptySeat = botSeats.length > 0;

    if (hasEmptySeat) {
      // ★ BB+2 자리 (UTG) 찾기
      const bbSeat = (this.state.buttonSeat + 2) % NUM_SEATS;
      const utgSeat = (this.state.buttonSeat + 3) % NUM_SEATS;
      // UTG 자리가 비어있으면(봇이면) 거기로, 아니면 첫 번째 봇 자리로
      let targetSeatId: number;
      if (this.state.seats[utgSeat]?.isBot) {
        targetSeatId = utgSeat;
      } else {
        targetSeatId = botSeats[0].seatId;
      }

      if (handInProgress) {
        // ★ 핸드 진행 중: 자리는 차지하지만 이번 핸드는 관전
        const seat = this.state.seats[targetSeatId];
        seat.isBot = false;
        seat.name = user.name;  // ★ 고유 이름 사용
        seat.socketId = user.socketId;
        seat.persona = undefined;
        seat.folded = true; // 이번 핸드는 폴드 처리
        seat.inHand = false;
        user.seatId = targetSeatId;

        // 이 플레이어에게만 "핸드 진행 중" 메시지 전송
        socket.emit("SYSTEM_NOTICE", {
          messages: [
            `👀 [${user.name}]님이 #${targetSeatId + 1}번 좌석에 착석했습니다.`,
            `⏳ 현재 핸드 #${this.state.handNumber}이(가) 진행 중입니다. 다음 핸드부터 참여할 수 있습니다.`,
          ],
        });
        // 다른 플레이어들에게는 일반 입장 메시지
        this.broadcastExcept("SYSTEM_NOTICE", {
          messages: [`👀 [${user.name}]님이 #${targetSeatId + 1}번 좌석에 착석했습니다. (다음 핸드부터 참여)`],
        }, socket.id);
      } else {
        // 핸드 사이: 즉시 참여 가능
        const seat = this.state.seats[targetSeatId];
        seat.isBot = false;
        seat.name = user.name;
        seat.socketId = user.socketId;
        seat.persona = undefined;
        seat.stack = DEFAULT_BUYIN;
        user.seatId = targetSeatId;

        this.broadcast("SYSTEM_NOTICE", {
          messages: [`🔄 [${user.name}]님이 #${targetSeatId + 1}번 좌석에 착석했습니다!`],
        });
      }
    } else {
      // 빈 자리 없음: 관전 모드
      this.joinQueue.push(user);
      socket.emit("SYSTEM_NOTICE", {
        messages: [
          `👀 [${user.name}]님이 관전 모드로 입장했습니다.`,
          `⏳ 테이블이 가득 찼습니다. 빈자리가 생기면 자동 착석됩니다.`,
        ],
      });
    }

    // 접속 즉시 현재 테이블 상태 전송 (시점 회전 적용)
    socket.emit("TABLE_STATE", this.getMaskedState(socket.id));
    console.log(`[User] ${user.name} 접속 (seatId: ${user.seatId}, handInProgress: ${handInProgress})`);
  }

  onUserDisconnect(socketId: string) {
    const user = this.users.get(socketId);
    console.log(`[Disconnect] socketId:${socketId.slice(0,8)}, user:${user?.name ?? "없음"}, seat:${user?.seatId ?? "없음"}`);
    if (!user) return;

    this.joinQueue = this.joinQueue.filter(u => u.socketId !== socketId);

    if (user.seatId !== null) {
      this.leaveSeats.add(user.seatId);
      // 유저가 턴 중에 나갔다면 즉시 폴드 처리
      if (this.state.activeSeatId === user.seatId && this.pendingActionResolve) {
        this.pendingActionResolve({ action: "fold", amount: 0 });
        this.pendingActionResolve = null;
      }
      // 사전 액션도 취소
      user.preAction = null;
    }

    this.users.delete(socketId);
    this.broadcast("SYSTEM_NOTICE", {
      messages: [`👋 [${user.name}]님이 퇴장했습니다. AI가 자리를 대체합니다.`],
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

    console.log(`[Action] ${user.name}: ${action.action} ${action.amount}`);
    this.pendingActionResolve(action);
    this.pendingActionResolve = null;
  }

  // 사전 액션 설정/취소
  onUserPreAction(socketId: string, preAction: { type: "fold" | "call" | "check"; amount: number } | null) {
    const user = this.users.get(socketId);
    if (!user) return;
    user.preAction = preAction;
    console.log(`[PreAction] ${user.name}: ${preAction ? preAction.type : "취소"}`);
  }

  // ============================================================
  // 핸드 간 AI <-> 유저 Hot-Swap
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

    // 2) 관전 대기열 유저를 빈 AI 자리에 투입 (핸드 사이에만)
    // ★ 입장 시 즉시 자리 배정은 onUserConnect에서 처리하므로
    //    여기서는 관전 모드였던 유저만 처리
    while (this.joinQueue.length > 0) {
      const botSeats = this.state.seats.filter(s => s.isBot);
      if (botSeats.length === 0) break;

      const user = this.joinQueue.shift()!;
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
    console.log("[GameLoop] 하이브리드 홀덤 게임 루프 시작");

    let handCount = 0;
    while (this.isRunning) {
      try {
        handCount++;
        console.log(`[GameLoop] 핸드 ${handCount} 시작 (users: ${this.users.size})`);
        await this.playOneHand();
        console.log(`[GameLoop] 핸드 ${handCount} 완료`);
      } catch (e: any) {
        console.error("[GameLoop] 핸드 처리 에러:", e?.message || e);
        console.error(e?.stack);
        await this.sleep(2000);
      }
    }
    console.log("[GameLoop] 루프 종료");
  }

  private async playOneHand() {
    const st = this.state;
    console.log("[Hand] playOneHand 시작");

    try {
      // 핸드 시작 전 Hot-Swap
      this.processSeatSwaps();
      console.log("[Hand] Hot-Swap 완료");

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
      console.log(`[Hand] 상태 리셋 완료 (hand #${st.handNumber})`);

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
      console.log("[Hand] 좌석 리셋 완료");

      // 덱 생성
      const deck = makeDeck();
      console.log("[Hand] 덱 생성 완료");

      // 블라인드
      const sbSeat = (st.buttonSeat + 1) % NUM_SEATS;
      const bbSeat = (st.buttonSeat + 2) % NUM_SEATS;
      st.seats[sbSeat].currentBet = Math.min(SMALL_BLIND, st.seats[sbSeat].stack);
      st.seats[sbSeat].stack -= st.seats[sbSeat].currentBet;
      st.seats[bbSeat].currentBet = Math.min(BIG_BLIND, st.seats[bbSeat].stack);
      st.seats[bbSeat].stack -= st.seats[bbSeat].currentBet;
      console.log("[Hand] 블라인드 완료");

      // 홀카드 딜
      for (const seat of st.seats) {
        if (seat.inHand) {
          seat.holeCards = [deck.pop()!, deck.pop()!];
        }
      }
      console.log("[Hand] 홀카드 딜 완료");

      this.broadcastTableState();
      this.broadcast("SYSTEM_NOTICE", { messages: [`◆ 핸드 #${st.handNumber} 시작`] });
      await this.sleep(800);
      console.log("[Hand] 베팅 라운드 시작");

      // 프리플랍 베팅 (UTG부터)
      await this.runBettingRound(st.buttonSeat, 3, deck);
      console.log("[Hand] 프리플랍 베팅 완료");

      // 다음 페이즈들
      await this.advancePhase(deck);
      console.log("[Hand] 핸드 완료");
    } catch (e: any) {
      console.error("[Hand] 에러:", e?.message || e);
      console.error(e?.stack);
      throw e;
    }
  }

  private async runBettingRound(btnSeat: number, startOffset: number, deck: Card[]) {
    const st = this.state;
    st.raiseLevel = 0;
    st.lastRaiseSize = BIG_BLIND; // ★ 라운드 시작마다 BB로 리셋
    st.seats = st.seats.map(s => ({ ...s, hasActed: false }));
    st.lastActions = {};
    this.broadcastTableState();
    await this.sleep(300);

    let lastActorIdx = -1;
    let safety = 0;
    while (safety++ < 100) {
      const alive = st.seats.filter(s => s.inHand && !s.folded);
      if (alive.length <= 1) { console.log(`[Bet] safety=${safety} alive<=1, break`); break; }

      const notAllIn = alive.filter(s => !s.allIn);
      if (notAllIn.length === 0) { console.log(`[Bet] safety=${safety} all allin, break`); break; }

      const maxBet = Math.max(...alive.map(s => s.currentBet));
      const needsAction = notAllIn.filter(s => !s.hasActed || s.currentBet < maxBet);
      if (needsAction.length === 0) { console.log(`[Bet] safety=${safety} no needsAction, break`); break; }

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
      if (actorIdx === -1) { console.log(`[Bet] safety=${safety} no actor, break`); break; }

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
      console.log(`[Bet] safety=${safety} actor=${actor.name}(${actorIdx}) call=${callAmt} minR=${minR} maxR=${maxR}`);

      this.broadcastTableState();

      // 사전 액션 체크 (유저인 경우)
      let decision: { action: ActionType; amount: number; isBluff?: boolean };
      const isUser = !actor.isBot && actor.socketId;
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

      // 레이즈 시 다른 유저의 콜/체크 사전 액션 취소
      if (decision.action === "raise" || decision.action === "allin") {
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
      console.log(`[Bet] applyAction 전: ${actor.name} ${decision.action} ${decision.amount}`);
      this.applyAction(actorIdx, decision);
      console.log(`[Bet] applyAction 후: ${actor.name}`);
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
      if (stillAlive.length <= 1) break;
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
      console.log(`[Decision] 유저 대기: ${actor.name}`);
      const action = await this.waitForUserAction(actor.socketId!);
      console.log(`[Decision] 유저 액션: ${actor.name} → ${action.action} ${action.amount}`);
      return action;
    } else {
      // 봇 결정
      console.log(`[Decision] 봇 결정 시작: ${actor.name}`);
      await this.sleep(600 + Math.random() * 600);
      try {
        const basePersona = actor.persona || RPG_BOT_POOL[0];
        // ★ AI 전략 로테이션: 5핸드마다 AGGRESSIVE/TIGHT/LOOSE 순환
        const currentStrategy = getStrategyForHand(this.state.handNumber);
        const persona = applyStrategyToPersona(basePersona, currentStrategy);
        const livePot = this.state.pot + this.state.seats.reduce((a, s) => a + s.currentBet, 0);
        const activeOpp = this.state.seats.filter(s => s.inHand && !s.folded).length - 1;
        console.log(`[Decision] trainer.decideActionForLive 호출 전`);
        const nnDecision = this.trainer.decideActionForLive(
          actor.holeCards,
          this.state.board,
          callAmt,
          minR,
          maxR,
          livePot,
          actor.stack,
          actor.currentBet,
          activeOpp,
          actor.seatId,
          NUM_SEATS,
          this.state.raiseLevel,
          this.state.buttonSeat,
          { vpip: persona.vpip, aggression: persona.aggression, bluffFreq: persona.bluffFreq }
        );
        console.log(`[Decision] 봇 결정 완료: ${actor.name} → action=${nnDecision.action} amount=${nnDecision.amount}`);
        return this.mapNNAction(nnDecision, callAmt, actor.stack);
      } catch (e: any) {
        console.error(`[Decision] 봇 결정 에러: ${actor.name}:`, e?.message || e);
        console.error(e?.stack);
        // 폴백: 폴드
        return { action: "fold", amount: 0 };
      }
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
        const mapped = this.mapUserAction(act);
        resolve(mapped);
      };
    });
  }

  private mapUserAction(act: { action: string; amount: number }): { action: ActionType; amount: number } {
    switch (act.action) {
      case "fold": return { action: "fold", amount: 0 };
      case "check": return { action: "check", amount: 0 };
      case "call": return { action: "call", amount: Math.min(act.amount, this.state.seats[this.state.activeSeatId]?.stack ?? 0) };
      case "raise":
        if (act.amount >= (this.state.seats[this.state.activeSeatId]?.stack ?? 0)) {
          return { action: "allin", amount: this.state.seats[this.state.activeSeatId]?.stack ?? 0 };
        }
        return { action: "raise", amount: act.amount };
      case "allin": return { action: "allin", amount: this.state.seats[this.state.activeSeatId]?.stack ?? 0 };
      default: return { action: "fold", amount: 0 };
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
        if (nn.amount >= myStack + (callAmt > 0 ? callAmt : 0)) {
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
        const cost = Math.min(target - currentBet, stack);
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
    const currentPot = st.pot;
    const alive = st.seats.filter(s => s.inHand && !s.folded);

    let winnerIndices: number[];
    if (alive.length === 1) {
      winnerIndices = [0];
    } else {
      winnerIndices = determineWinners(
        alive.map(c => ({ holeCards: c.holeCards })),
        st.board
      );
    }
    const winners = winnerIndices.map(i => alive[i]);
    const share = Math.floor(currentPot / winners.length);
    const remainder = currentPot - share * winners.length;

    let handName = "";
    if (isShowdown && winners[0]) {
      const score = evaluateBestHand(winners[0].holeCards, st.board);
      handName = scoreToCategoryName(score);
    } else if (winners.length === 1 && !isShowdown) {
      handName = "기본 승 (모두 폴드)";
    }

    const winnerNames = winners.map(w => w.name).join(", ");
    st.winnerInfo = { name: winnerNames, amount: currentPot, hand: handName };

    // 스택 분배
    st.seats = st.seats.map(s => {
      const idx = winners.findIndex(w => w.seatId === s.seatId);
      if (idx >= 0) {
        const bonus = idx === 0 ? remainder : 0;
        return { ...s, stack: s.stack + share + bonus };
      }
      return s;
    });
    st.pot = 0;

    this.broadcastTableState();

    // 결과 표시 5초 유지
    await this.sleep(5000);
    st.winnerInfo = null;
    st.showdownReveal = false;
    st.showdownHands = [];
    this.broadcastTableState();
  }

  // ============================================================
  // 상태 마스킹 & 브로드캐스트
  // ============================================================

  private getMaskedState(socketId: string | null) {
    const st = this.state;
    const user = socketId ? this.users.get(socketId) : null;
    const mySeatId = user?.seatId ?? -1;
    const isShowdown = st.phase === "SHOWDOWN";
    const handInProgress = st.phase !== "SHOWDOWN"
      && st.phase !== "HAND_END"
      && st.activeSeatId >= 0
      && mySeatId >= 0
      && !st.seats[mySeatId]?.inHand; // 내가 이번 핸드에 참여 안 함

    return {
      type: "TABLE_STATE",
      handNumber: st.handNumber,
      phase: st.phase,
      buttonSeat: st.buttonSeat,
      activeSeatId: st.activeSeatId,
      totalPot: st.pot + st.seats.reduce((a, s) => a + s.currentBet, 0),
      boardCards: st.board.map(c => `${c.rank}${c.suit}`),
      callAmount: st.callAmount,
      minRaise: st.minRaise,
      maxRaise: st.maxRaise,
      mySeatId,
      myPlayerId: user?.playerId ?? null,  // ★ 고유 플레이어 ID
      myName: user?.name ?? null,          // ★ 서버가 부여한 고유 이름
      isUserTurn: st.activeSeatId === mySeatId && mySeatId >= 0 && st.seats[mySeatId]?.inHand,
      handInProgress, // ★ 핸드 진행 중 입장 여부
      showdownHands: st.showdownHands,
      winnerInfo: st.winnerInfo,
      seats: st.seats.map(s => {
        const isMe = s.seatId === mySeatId;
        const rawHole = s.holeCards.map(c => `${c.rank}${c.suit}`);
        const reveal = isMe || (isShowdown && !s.folded);
        return {
          seatId: s.seatId,
          name: s.name,
          isBot: s.isBot,
          isMe, // ★ 자신 좌석 표시
          stack: s.stack,
          currentBet: s.currentBet,
          inHand: s.inHand,
          folded: s.folded,
          allIn: s.allIn,
          holeCards: reveal ? rawHole : (rawHole.length > 0 ? ["??", "??"] : []),
        };
      }),
      preAction: user?.preAction ?? null,
    };
  }

  private broadcast(event: string, data: any) {
    io.emit(event, data);
  }

  // ★ 테이블 상태를 각 클라이언트마다 개별 마스킹하여 전송
  // (각 플레이어가 자신의 mySeatId, 자신의 카드만 보게 함)
  private broadcastTableState() {
    if (this.users.size === 0) return; // 유저 없으면 전송 안 함
    for (const [socketId, user] of this.users) {
      const masked = this.getMaskedState(socketId);
      io.to(socketId).emit("TABLE_STATE", masked);
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

httpServer.listen(PORT, () => {
  console.log(`🎰 8-Player Hybrid Holdem Server running on port ${PORT}`);
  console.log(`   Caddy 라우팅: ?XTransformPort=${PORT}`);
});

// ★ 프로세스 안정성: 예외로 인한 종료 방지
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT] 예외 발생:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED] Promise 거부:", reason);
});
