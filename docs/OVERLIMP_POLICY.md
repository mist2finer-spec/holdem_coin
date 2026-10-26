# Conditional overlimps (v1.25.1)

Both single-player and multiplayer use planPreflop in decideLiveBot.

A voluntary limper must already have publicly matched the BB. The forced BB alone does not count. In unraised preflop pots, non-premium speculative hands may overlimp at a conditional probability of12–35%, adjusted by final character traits, physical late position and prior limper count. A deterministic shared social mood occurs in approximately12% of hands and adds25 percentage points (maximum60%). This produces occasional chains of voluntary limps, rather than commanding all seats to call. Each seat still checks its own hand, price and stack.

- At least20BB starting/effective depth; call no more than5% of both.
- No raises, opponent all-ins, stack-sized calls or additional retries of the old limp roll.
- Eligible:22–TT, suited Ax below AQ, suited connected/gapped cards from4 up, broadways below AQ/AK, existing trait-qualified offsuit seven-connectors and loose late-position A8o–AJo.
- JJ+/AQ+/AK preserve the existing opening/isolation sizing policy.
- Rare2/3 connectors stay outside this mixture.
- No opponent hole cards, names or premium-hand oracle. No forced table-wide call or new hidden player advantage.
- Accepted calls are audited as `decisionPath: preflop-overlimp` with private overlimp fields for frequency, social mood and eligibility.
- This is a small entertainment policy, not a claim that every speculative call has positive solver EV.

Settlement/rake and existing postflop defense frequencies are unchanged. Offline PokerKit history auditing additionally verifies each seat's award/refund/net profit and clockwise odd-chip split, not only table-level chip conservation.
