/**
 * holdem_coin :: Demo player data
 * ─────────────────────────────────────────────────────────────────────────
 * Sample player roster for the Leaderboard demo. Amounts are in "K" (thousands)
 * of in-game currency, matching the original imageguide.pptx layout
 * (123,456,789 K shown for each player slot).
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { Player } from '../components/Leaderboard/Leaderboard';

export const DEMO_PLAYERS: Player[] = [
  { id: 1, name: 'Alice',    amount: 123_456_789, trend: 'same' },
  { id: 2, name: 'Bob',      amount:  98_765_432, trend: 'up'   },
  { id: 3, name: 'Charlie',   amount:  87_654_321, trend: 'down' },
  { id: 4, name: 'Diana',    amount:  76_543_210, trend: 'up'   },
  { id: 5, name: 'Eve',      amount:  65_432_109, trend: 'same' },
  { id: 6, name: 'Frank',    amount:  54_321_098, trend: 'down' },
  { id: 7, name: 'Grace',    amount:  43_210_987, trend: 'up'   },
  { id: 8, name: 'Henry',    amount:  32_109_876, trend: 'new'  },
  { id: 9, name: 'Iris',     amount:  21_098_765, trend: 'new'  },
  { id: 10, name: 'Jack',    amount:  10_987_654, trend: 'down' },
];
