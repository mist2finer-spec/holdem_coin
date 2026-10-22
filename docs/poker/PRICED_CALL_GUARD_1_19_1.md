# 1.19.1 — priced call guard

Some 1.18.0 history snapshots still folded under 1.19.0 despite a very small
incremental all-in call. In particular #523's turn overcards were completely
blocked by the trainer's call mask. The other cheap-call cases could still
randomly fold. A final shared decision guard now rescues a fold when the
following narrower conditions are met.

## Closed all-in calls

- The actor has voluntarily committed chips on the current street, or on an
  earlier street when this call consumes the remaining stack. Preflop,
  posting a blind alone does not qualify; current bet must exceed 1BB.
- Every remaining opponent is all-in, or the call consumes the actor's remaining
  stack. No opponent can require further chips from this actor; other players
  may still continue betting a separate side pot.
- After adding the actual call cost, only contested pot layers the actor can
  win are included. Other side pots and uncalled refunds are excluded.
- Required equity is at most 15% of that eligible pot after 5% rake.
- Estimated incremental call EV exceeds a margin of `max(1 chip, 1% of net pot)`.
  Existing OOP and stack risk premiums are not charged to a locked runout.

Preflop equity uses the existing jam-call range with 384 deterministic samples.
Postflop equity uses a conservative public value prior: opponents are drawn
from the strongest 35% of current-board hand strength, including cutoff ties,
then runouts are sampled. Cards are dealt without replacement; if that upper
range cannot supply another legal opponent, the strongest remaining legal
combination is used. Ties count as pot shares. This is a bounded policy model,
not a measured opponent range, confidence interval or GTO solution.

The evaluator sees only the acting player's cards and public board. It never
reads actual human or CPU opponent cards. The cache is bounded to 128 entries.

## Cheap BB pocket-pair defense

A separate positive-EV fold rescue covers BB holding 66+ against a 2BB-or-smaller
open (raise level 1), with at most 1BB to call. The starting stack must be at
least 10BB and call cost at most 10% of that stack. Other remaining players must
already have matched the price or be all-in. Equity uses the open range and a
0.82 realization discount for future streets; expensive calls and tiny stacks
do not get a forced continue.

This does not force every unopened 66/77 to raise, remove ordinary persona
folds, expand rare low-connector cold entry, or turn calls into re-raises.
Raises and ordinary calls chosen by the base policy remain unchanged. A call
that consumes the actor's stack remains an all-in call under the normalizer.

## Audit and checks

`privateAudit.pricedCall` records the guard kind, eligible net pot, cost,
required equity, modeled equity, EV margin and acceptance/rejection reason.
Public hand histories still omit private decision audits.

- Anonymized public-state fixtures cover all eight low-price-fold cases
  (#355/#379/#426/#438/#474/#523/#539/#1047) plus #709/#1114. No
  opponent cards or player names are in the fixtures.
- All ten snapshots continued with calls/all-in calls in all 100 seeded
  full-policy counterfactual decisions each. All ten also have direct positive-EV
  regression checks. These are decision snapshots, not newly played whole hands.
- Negative tests cover a losing river ace-high, an ineligible large side pot,
  another active bettor, tiny stacks, expensive calls and rare-connector caps.
- Shared-board ties, non-mutating contribution accounting, and the all-in-call
  amount are checked. Existing regressions and the 20-hand backend simulation
  pass, as do scoped lint and the production build.
- The prior 66/77 opening examples retain their existing stochastic mixtures.

The known-opponent calculation for #523 (0 wins, 4 ties among 44 rivers) was a
separate offline diagnostic. It is not an input to the runtime guard.
