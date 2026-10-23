# v1.25.0: casual/semi-pro cash table

## Shared rules

Single-player and server games use `decideLiveBot` and `settleHand`. No opponent hole cards enter live defense calculations. Existing character identities, stack modifiers and legal-raise normalization remain active. No tournament/ICM policy is introduced.

- Dealing profile `paced-textures-v3`: pair/suited/connector rejection weights 0.20/0.15/0.10, applied equally to every seat. These are weights, not a promise of exact observed hand frequencies. Remaining shuffled cards supply the board without forced hits or winners.
- Pro: call EV > 0 or realized equity meeting eligible pot odds bypasses the 45–52% personality threshold. Threshold remains in the audit for comparison.
- Preflop: a full additional call price <=2.5BB cannot fold 22+, A2s+, suited K9+/Q9+/J9+, suited consecutive connectors 54+, ATo+/KJo+/QJo. An all-in call remains a call; it does not reopen raising. Unmatched chips and inaccessible side pots never subsidize the price calculation.
- Unopened CO/BTN/SB: persona-weighted additional Ax/pair/suited-connector/broadway openings; strong middle pairs and broadways receive core open support. Ordinary open sizes stay 2.5–2.8BB. Extremely short stacks retain their separate emergency policy. Existing rare low-connector (<10%) entry gates are preserved.
- River: positive EV plus a 3pp equity edge over required equity, or a strong own made hand with >=35% equity, calls without a random gate. Other marginal positive-EV catches still mix by personality. A declined scary-board mix cannot block a deterministic rescue or create a second stochastic roll.
- All streets: <=15% required equity plus a pocket/own pair, actual draw or ace-high forces a call. This is a deliberate game-style guardrail: it may override a conservative value-prior EV estimate. Bare air and backdoor-only hands do not qualify. Eligibility is based on the actor's contribution layers, never the whole inaccessible table pot.

## Rake

Uncalled refunds are returned in full with zero rake. `contestedPot` sums only non-refund contribution layers. Charge 5% across contested pots when ANY of these holds:

1. Flop was dealt.
2. The recorded preflop full-raise level reached 2 (three-bet).
3. Contested chips reached 4BB.

Carry rounding across side pots so the total is `floor(contestedPot * .05)`. Examples at 100/200:

| Situation | Contested | Refund | Rake |
|---|---:|---:|---:|
| 5,000 steal, only 200 matched | 400 | 4,800 | 0 |
| 2,600 flop pot, no individual bet reached 900 | 2,600 | 0 | 130 |
| 800 contested preflop pot | 800 | 0 | 40 |

`preflopRaiseLevel` persists across street resets and resets at each new hand in both game modes. Settlement exports `rakePolicy` to history. Bot EV continues to use `BOT_EV_RAKE_RATE = 0`. Offline history audit switches policy by `rulesVersion`, preserving interpretation of older hands.

## Measured balance

Real-room seeded simulation, 6 CPU seats, 1,000 continuous hands per version, 6,000 player-hand opportunities. Baseline revision and machine-readable summary are in `casual-1250-balance.json`.

| Metric | v1.24.0 | v1.25.0 |
|---|---:|---:|
| Actual VPIP | 20.70% | 26.70% |
| Actual PFR | 15.25% | 18.43% |
| Unopened walks (no voluntary payment) | 29.40% | 17.80% |
| Any preflop fold win, including steals | 67.80% | 52.20% |

These are measurements of default initial policies with one fixed seed, not enforced live rates or a claim to reproduce an uploaded history. Per-character samples and live learned weights can differ. Walks are distinguished from raised pots won by a preflop fold.

Reproduce from the project root:

```sh
POKER_TEST_MODE=1 SIM_HANDS=1000 SIM_SEED=20261023 node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/simulate-casual.ts
npm test --prefix mini-services/poker-server
npm run typecheck --prefix mini-services/poker-server
```

The simulation asserts completed-hand status, integer nonnegative stacks and contributions = payouts + rake. It performs no writes to production history or training weights.
