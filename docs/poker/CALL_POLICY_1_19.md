# 1.19.0 — public-information call policy and persona mixes

The 1.18.0 history showed cold calls being rejected when one player opened but
several seats had not yet acted. Some preflop gates compared equity against
all those seats to the price of the currently contested pot. Separately, a
profitable short-stack flat was still discarded frequently after the EV check.

## Decision changes

- Call evaluation separates the actual raiser, players who matched the current
  price, all-in players, and pending responders. Actual participants remain in
  every scenario. Contributions from projected folds remain dead money.
- With pending responders, a bounded two-scenario approximation weighs the
  existing field against one additional caller. The latter probability is
  `min(0.35, 0.12 + 0.04 * pendingSeats)`; the most invested/deeper pending seat
  represents the additional caller. This is a heuristic, not an exact solver
  or a guarantee that multiple future calls cannot happen.
- Postflop, already matched multiway pots and heads-up EV calculations retain
  the existing field/accounting. Raise/jam downside still uses the conservative
  called-action model. Settlement, rake, refunds and raise legality are unchanged.
- Ordinary-stack priced flats include 2BB opens, not just 3–4BB opens. Suitable
  preflop broadways/pairs/suited aces can retain a call action instead of being
  excluded by postflop-style AIR/OVERCARDS masks. Postflop air protections remain.
- A positive-EV short-stack call participates in the same near-EV action mix as
  raises/jams. Above 10BB, calls get more weight; at <=10BB, positive-EV jams
  retain greater weight. Entry gates and expensive-call protection remain.
- Small-open call realization is 0.82 OOP / 0.92 IP instead of 0.70 / 0.85.
- Conditional limps cover middle/late position and SB with small/mid pairs,
  qualified suited connectors and suited aces. The eligible-decision frequency
  remains below 15% and decreases with aggression. Short-stack exclusions,
  premium open sizing and rare-low-connector caps remain.
- Individual personas, five-hand rotations, stack bands, surge, bluff reveals,
  continuation bets and traps remain. No opponent hole cards or human hit hints
  are inputs. `privateAudit.callModel` records the public field-model counts.

## Verification

- Shared single-player/server decision functions are used; no duplicated UI policy.
- Regression tests cover pending seats, actual cold callers, all-ins, dead chips,
  postflop invariance, heads-up EV, historical AQo vs a 2BB open, and a priced
  20BB pocket-pair call. Existing rare-connector, limp-cap, 3bet, side-pot,
  raise-reopening and privacy tests pass.
- `node scripts/validate_holdem.js`: type checks, regression suite and 20 actual
  eight-seat backend hands with join/disconnect invariants pass.
- The watchdog now measures five seconds without completed-action progress,
  rather than five seconds for an entire multiway hand. A separate 30-second
  total-hand deadline remains. This permits legitimate multiway action while
  still detecting a stalled decision/event loop.
- Production build and scoped lint pass.
- An evenly spaced sample of 80 recorded preflop CPU decision snapshots changed
  from 65 folds / 3 calls / 12 raises to 61 folds / 6 calls / 13 raises with a
  fixed policy sampling seed. Three old folds became calls. This is a limited
  counterfactual snapshot comparison, NOT 1,000 newly played hands and NOT a
  predicted long-run VPIP or win rate.

To repeat the snapshot check locally with an admin export:

```bash
POKER_TEST_MODE=1 node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs \
  scripts/compare-call-policy.ts /path/to/admin-history.json 80
```

The comparison emits aggregate counts only. Do not commit private hand exports.
Review a new live history before making further participation/EV changes.
