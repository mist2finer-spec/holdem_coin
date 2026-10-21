# 1.15.0 — guide_3 integration and value betting

UI source: `origin/feature/new-ui-assets` at `eb27a8a`. This branch has an independent root history. Only its UI assets/components are integrated; its package manifest and generated preview files do not replace the poker application or server.

- Three distinct mode balances, demo +5,000 recharge, automatic tester names, four shop categories (price 100, purchase inactive), and six-seat human leaderboard (top seven, refresh every three minutes).
- Single-player balance lives in this browser. Multiplayer balance and leaderboard live in server memory and reset on restart. Lobby identity uses a random browser token; this is demo currency, not an authenticated paid wallet. Multiplayer chips are synchronized at settlement; credits enter the table between hands, never by changing a running hand's stack.
- Only free postflop check/fold candidates can receive a value-bet override. Own hand tier must be top pair or better, estimated equity against unknown opponents at least 62%, and the hand must improve on a complete board. Persona aggression increases betting probability; OOP retains a slightly larger checking range. Quarter, half, and three-quarter pot targets have equal selection probability. Illegal sizes stay with the original decision; no hidden minimum-size inflation. Existing bets, shoves, reactions to bets, prior checks and dry side pots retain their normal rules.
- Own cards are larger and fully exposed above the portrait. Table wager labels no longer shrink on mobile and use larger white numerals.

## Uploaded history inspection

The supplied 1.14.3 archive contains 51 completed hands and 455 actions. No negative/non-finite chip values, illegal checks facing bets, action stack/pot accounting discrepancies, duplicated dealt cards, contribution/settlement/refund/profit mismatches, or dry-side-pot raises were found in these records. This is a record check, not a proof of all game paths.

Of 36 CPU free postflop actions, 23 were checks. Most were air, overcards or weak pairs. Strong made hands have only two samples: hand 18, Jun, T♠4♠ on T♥8♠4♦, checked OOP; the other monster action raised. This sample is too small to establish an excessive near-nut checking rate. Code inspection confirms the intentional OOP/initiative check mix runs before the usual value selection; the former postflop support only supplied missed-flop c-bets and tight IP probes. Rake cannot be isolated as the cause from this log.

Validation: type/import checks, regression tests including equal bet-size distribution and persona mixing, twenty fast eight-seat simulated hands, production build, and actual Socket.IO startup/room/privacy/lobby tests.
