# 1.16.0 — preflop sizing and lobby controls

Shared single/server policy runs before trainer and short-stack reshove selection.

- JJ+ opens to 2.5–2.8 BB (500–560 at 100/200). Above 5 BB, facing ordinary raises it uses 3-bets/4-bets when the raise costs at most 65% of remaining chips; otherwise calls. Five-bet escalation is not automatic. Emergency <=5 BB and opponent all-ins retain existing EV decisions.
- Unpaired broadways (AK..QJ and JT, both suited/offsuit) facing a first open can flat from UTG through UTG+2. Positions use physical seats, excluding button and blinds, and do not shift after folds.
- In position versus the raiser, outside those early seats, qualified broadways mix 3-bets at 18% + 30% × effective aggression. Aggressive (>=0.70) 87s adds an 8% 3-bet mix. Calls still require rake-adjusted equity and cost <=25% of starting chips; non-premium re-raises cost <=45% of remaining chips. Effective per-hand persona is used.
- Existing private human-equity call defense and postflop policies remain in the shared finalizer.
- Room exit returns to mode selection. Solo saves the authoritative remaining stack and stops the hand; multiplayer uses the existing disconnect/hand-end cashout lifecycle. Exit is also available while connecting.
- Lobby footer edits the server account's name (1–12 Unicode characters, unique, no control/markup characters). Account identity and balances stay unchanged. Renaming is deferred until any previous live seat is released. Names live in the existing in-memory ledger and reset with it on server restart.

Validation: existing regression suite plus premium sizing, position/flat/3-bet policy, trainer bypass and ledger rename tests; 20 headless hands; production build.
