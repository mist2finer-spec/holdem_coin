# Eight-seat test tournament

- Separate TournamentLifecycle and room instance; cash six-seat behavior remains separate.
- Eight entrants, CPU-filled at creation,20000 chips each =100BB. Initial SB100/BB200.
- Server wall clock300000ms per level; both blinds double. A level is applied only before the next hand, never during a street. HUD continues counting down while spectating.
- Zero rake, no cash-ledger debit/credit, no rebuy, no top-ups, no chip-leader cash-out. Total160000 chips until one champion remains.
- Any positive stack remains eligible, including less than one BB. Short blinds post their remaining stack. In tournament mode the call price follows actual posted bets; full-raise increment retains the nominal BB. Covering blinds with no betting opponent proceed straight to runout, with an implicit zero-cost check recognized by the offline auditor.
- Eliminations are finalized after settlement, not when a player first moves all-in. Eliminated avatars/seats disappear. No replacement CPU occupies that seat.
- Same eliminated name is blocked for this tournament, using NFKC/trim/case normalization. Active duplicate names are rejected. Disconnected live players can reconnect with the same name and retain their stack. While disconnected they automatically fold/check; no replacement bot is funded.
- Test-only alternate names may join a surviving CPU seat between hands and inherit its existing chips. They cannot occupy an eliminated seat or add a fresh stack. The first human requests a single 10-second countdown; the blind clock begins with the first dealt hand. If everyone leaves during the countdown, it cancels and departed seats return to CPU. no late join can mutate seats mid-hand.
- Winner-only congratulations displays champion portrait/name. One survivor stops the loop. A champion records an immutable finish timestamp. New entries are blocked for 600000ms, then the next lobby status request or entry creates a fresh waiting tournament; existing sockets retain their completed tournament view.
- Bot decisions use a200-BB-reference denomination adapter to preserve existing strategy bands as blinds grow; real-chip action validation/settlement remains authoritative. Tournament strategy is chip-EV, not an implementation of a general multi-prize ICM solver.
- Histories include gameMode/rakeRate, real blind values and real chip actions; the offline PokerKit auditor recognizes zero tournament rake.
- Like existing rooms, active tournament state is in memory and resets on server restart/deploy. No paid storage, identity proof or production entry fee is introduced.

- Lobby GET_TOURNAMENT_STATUS returns server time, phase/deadlines, round, hand number and remaining entrants; polling never starts a game. An expired cooldown rotates the room. Lobby shows server-aligned countdown/elapsed/round and disables entry during cooldown. Old completed observers keep their winner view.
- Tournament pots, wagers, action buttons, custom sizing, reservations and settlement display use current-BB units rounded to one decimal (half up). Custom input accepts BB, converts to integer chips and validates the original legal bounds. Stored histories and network action amounts remain integer chips. Cash display behavior is unchanged.
