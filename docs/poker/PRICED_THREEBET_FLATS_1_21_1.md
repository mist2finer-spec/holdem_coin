# 1.21.1 — price small three-bets before excluding an original opener

## Evidence and scope

Latest upload contains 221 completed 1.21.0 hands: the previous 162 plus 59 new
hands, not 221 independent additional hands. Independent PokerKit replay finds
no issues across legal actions, pots/winners, chip conservation or threshold rake.
CPU original openers facing a three-bet: 38 responses, 25 folds, 6 calls,
7 reraises. This rate alone does not establish that every fold is incorrect.

Existing negative gate examples: #11 KJo, #111 55, #152 AJo, #191 A3s.
These were excluded before call EV was calculated, despite a small extra price.
The new path reaches the existing public-range EV model; it never reads actual
opponent cards and does not automatically declare every wider-range call good.

This release does not implement strategies from the user's 16 video summaries.
Squeezes, blocker barrels, induce bets, thin-value leads, line-based opponent
range updates, and ICM are planning topics only. No runtime parameters or
candidate tactics derived from those summaries are deployed in this patch.

## Additional flat evaluation, not additional aggressive range

Only when the ordinary continuation gate rejects a hand:
- preflop, original opener (openedPreflop), facing exactly a three-bet;
- no all-in opponent, call does not consume the actor stack;
- effective starting stack >=3,000 (15BB); <=2,500 does not gain this exception;
- own street wager >=400; extra call <=600 (3BB), <=1.25x own wager,
  <=12% of effective/own starting stack, and gross pot odds <=28%;
- candidates: 55+, AJ+, suited aces with VPIP >=.35, KJ/QJ or better
  broadways with VPIP >=.30. Existing admitted hands retain their old policy.

Only CALL or FOLD is available through this exception. Jam and reraise EVs are
not evaluated, so widening a defensive evaluation gate cannot introduce a new
four-bet or shove. Calls require modeled EV >max(1 chip,2% current pot), after
existing equity-realization and risk premiums. Marginal positive EV can still
fold. A personality-weighted continuation mixture remains; sufficiently strong
EV has no random fold floor. Negative controls A3o and KTo remain excluded.

All bot EV is gross of rake as in 1.20; settlement still follows the existing
4.5BB activation / 5% matched-pot rake, refunds and side-pot eligibility.
The 40–60% draw-board mixture, cheap-river policy, short-stack tightening bands,
visual/strategy independence and Pro thresholds are unchanged.

## Effective SPR correction

Future risk uses min(actor's chips after calling, largest eligible opponent's
chips after matching the call price) / post-call pot. A deep covering stack
previously made even a short opponent look deep. This correction changes risk
realization where an opponent's capacity is genuinely smaller; it does not
increase the amount that opponent can win or access another side pot.

## Diagnostics and validation

Private decision paths distinguish priced-three-bet-flat, its EV/margin fold,
and its mixed-policy fold. Public DTOs/histories omit private audit data.
Sanitized fixtures store only the acting CPU cards and public seat state.

Tests cover the four historical admitted cases, ordinary cold callers, <=2,500
stacks, opponent shoves, expensive reraises/four-bets, weak offsuit controls,
a marginal-positive-EV fold, effective SPR, legal action normalization and the
shared live path with opponent-card getters that throw. Existing three-bet
regressions and the full 20-hand backend validation also run before release.
Counterfactual fixture decisions are not new full-hand outcome simulations and
do not prove improved long-run profit.
