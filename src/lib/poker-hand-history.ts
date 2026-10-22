import type { HandResult } from './poker-rules';

export interface HandPlayer {
  seatId: number; name: string; isBot: boolean; startingStack: number;
  position: 'BTN/SB' | 'BTN' | 'SB' | 'BB' | 'OTHER';
  holeCards: string[]; revealed: boolean;
  privatePlayerId?: string;
}
export interface HandAction {
  sequence: number; at: string; street: string; board: string[];
  seatId: number; name: string; isBot: boolean;
  source: 'cpu' | 'human' | 'pre-action' | 'timeout' | 'disconnect';
  action: string; amount: number; paid: number; callBefore: number;
  potBefore: number; potAfter: number; stackBefore: number; stackAfter: number;
  minRaiseBefore?:number; lastFullRaiseBefore?:number; canRaiseBefore?:boolean;
  betBefore: number; betAfter: number; raiseLevelBefore: number;
  activePlayers: number; allInPlayers: number; activePlayersBefore: number; allInPlayersBefore: number; decisionMs: number;
  privateAudit?: Record<string, unknown>;
}
export interface HandHistory {
  schemaVersion: 1; id: string; sessionId: string; handNumber: number;
  rulesVersion: string; revision: string; startedAt: string; endedAt: string;
  status: 'completed' | 'aborted'; error?: string;
  humans: number; cpus: number; smallBlind: number; bigBlind: number;
  buttonSeat: number; smallBlindSeat: number; bigBlindSeat: number;
  players: HandPlayer[]; actions: HandAction[]; board: string[];
  streets: {street:string;board:string[];at:string}[];
  forcedBets: {seatId: number; blind: 'SB' | 'BB'; paid: number}[];
  results: HandResult[]; pots: unknown[]; rake: number;
}

// Explicit public whitelist: never export server-only decision inputs or identifiers.
export function publicHandHistory(h: HandHistory, viewerPlayerId?: string): HandHistory {
  return {
    schemaVersion: h.schemaVersion, id: h.id, sessionId: h.sessionId, handNumber: h.handNumber,
    rulesVersion: h.rulesVersion, revision: h.revision, startedAt: h.startedAt, endedAt: h.endedAt,
    status: h.status, humans: h.humans, cpus: h.cpus, smallBlind: h.smallBlind, bigBlind: h.bigBlind,
    buttonSeat: h.buttonSeat, smallBlindSeat: h.smallBlindSeat, bigBlindSeat: h.bigBlindSeat,
    players: h.players.map(p => ({seatId:p.seatId,name:p.name,isBot:p.isBot,startingStack:p.startingStack,
      position:p.position,revealed:p.revealed,
      holeCards:p.revealed || (viewerPlayerId && p.privatePlayerId===viewerPlayerId) ? [...p.holeCards] : ['??','??']})),
    actions: h.actions.map(a => {
      const {privateAudit: _audit,...visible}=a;
      return {...visible,board:[...a.board]};
    }),
    streets:h.streets.map(s=>({...s,board:[...s.board]})),
    board:[...h.board],forcedBets:h.forcedBets.map(b=>({...b})),
    results:h.results.map(r=>({...r})),pots:JSON.parse(JSON.stringify(h.pots)),rake:h.rake,
  };
}

// One CSV row per action, with enough hand context for fold/call/raise analysis.
export function handHistoryCSV(hands: HandHistory[]) {
  const columns=['handId','handNumber','rulesVersion','startedAt','status','humans','cpus',
    'sequence','street','board','seatId','name','isBot','source','action','amount','paid',
    'callBefore','potBefore','potAfter','stackBefore','stackAfter','betBefore','betAfter',
    'raiseLevelBefore','activePlayersBefore','allInPlayersBefore','activePlayers','allInPlayers','decisionMs','startingStack','position',
    'holeCards','contribution','payout','refund','netProfit','handRake'];
  const cell=(v:unknown)=>{
    let s=String(v??'');
    if(/^[\s]*[=+@\-\t\r]/.test(s)&&typeof v==='string')s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  const rows=hands.flatMap(h=>[...h.actions,...h.players.map(p=>{
    const r=h.results.find(r=>r.seatId===p.seatId);
    return {sequence:0,at:h.endedAt,street:'RESULT',board:h.board,seatId:p.seatId,name:p.name,isBot:p.isBot,
      source:p.isBot?'cpu' as const:'human' as const,action:'settlement',amount:0,paid:0,callBefore:0,
      potBefore:0,potAfter:0,stackBefore:p.startingStack,stackAfter:p.startingStack+(r?.netProfit||0),
      betBefore:0,betAfter:0,raiseLevelBefore:0,activePlayers:0,allInPlayers:0,activePlayersBefore:0,allInPlayersBefore:0,decisionMs:0};
  })].map(a=>{
    const p=h.players.find(p=>p.seatId===a.seatId),r=h.results.find(r=>r.seatId===a.seatId);
    const values=[h.id,h.handNumber,h.rulesVersion,h.startedAt,h.status,h.humans,h.cpus,
      a.sequence,a.street,a.board.join(' '),a.seatId,a.name,a.isBot,a.source,a.action,a.amount,a.paid,
      a.callBefore,a.potBefore,a.potAfter,a.stackBefore,a.stackAfter,a.betBefore,a.betAfter,
      a.raiseLevelBefore,a.activePlayersBefore,a.allInPlayersBefore,a.activePlayers,a.allInPlayers,a.decisionMs,p?.startingStack,p?.position,
      p?.holeCards.join(' '),r?.contribution,r?.payout,r?.refund,r?.netProfit,h.rake];
    return values.map(cell).join(',');
  }));
  return '\uFEFF'+[columns.join(','),...rows].join('\r\n');
}
