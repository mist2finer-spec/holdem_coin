# 1.22.1 — rare marginal original-opener flats

## Intent and scope

Add a small entertainment-oriented flat-call mixture independent of the bettor's
actual cards. The final shared live finish path invokes this once, only after a
fold survives the existing participation/Pro/priced-call policies. Existing calls,
raises, profitable defenses and prior tactics are not demoted. Applies identically
in solo and hosted six/eight-seat play. No tournament/ICM changes.

It does not detect AA/KK/QQ or accept a private-card boolean. Raw seats are explicitly
whitelisted into public scalars before simulation, so even enumerable private-card
or identity getters cannot influence this policy. The supplied 349-hand history's
large 700 -> 2,800 KK three-bet remains outside this small-price exception.

## Eligibility

- Preflop, exactly a three-bet, original opener only; no cold calls/four-bets.
- Exactly one live opponent, the last raiser, with chips remaining; no opponent
  all-in, multiway or side-pot speculation. The call cannot consume our stack.
- Own starting chips >2,500; effective starting chips >=3,000; own wager >=400.
- Opponent total wager <=1,600 and <=3x our wager; incremental call <=600,
  <=15% effective starting chips and <=20% remaining stack.
- IP eligible-pot odds <=28%; OOP <=24% and incremental cost <=500.
- Candidates: 55–TT; suited A5s–AQs; suited JT/QT/QJ/KT/KJ/KQ;
  IP with effective VPIP >=40% also AJ/AQ/KJ/KQ offsuit. No weak offsuit aces,
  low connectors, arbitrary small pairs or additional rare-connector rolls.

Equity uses our two cards versus a hypothetical public three-bet range, with
384 deterministic cached samples. An established public loose-three-bet read
can mix the existing wide range; fewer than six observations cannot widen it.
Only existing, actor-eligible contribution layers price the call. Uncalled bets
and inaccessible side pots never make the price look cheaper. OOP/IP realization
is 86%/94%; bot estimates remain gross of rake, actual settlement is unchanged.

## Frequency and loss budget

The character's base traits contribute 70%, hand-adjusted traits 30%. VPIP,
aggression, position and established public read produce a bounded 5–15% roll
on an eligible otherwise-folded decision. This is not a guaranteed overall VPIP,
call frequency against premiums, or minimum increase of five percentage points
over every three-bet opportunity.

Raw equity must exceed pot odds by two percentage points. Realization-adjusted
EV must be >= minus the smaller of 10% call cost and 2% eligible pre-call pot.
This deliberately permits a very small modeled-negative-EV entertainment mix;
it is not claimed to improve optimal EV. Large negative EV remains excluded.
The extra action is always CALL, never a shove or reraise. No RNG is consumed for
rejected eligibility or EV; one roll maximum per otherwise-folded eligible action.

Private history audits store `marginalFlat` eligibility, frequency, estimated equity,
odds, EV, budget and acceptance; selected actions use `marginal-three-bet-flat`.
Public DTO/history does not expose these strategy diagnostics. Full replay can
compare accepted/rejected opportunities without leaking opponent cards to bots.

## Verification

Tests cover the 5–15% mixture, legal affordable calls, actual private-card/identity
getter isolation, exclusion of shoves/cold calls/multiway/large bets/very short
stacks, public-read sample minimum, loss limits and shared integration preserving
normal calls/raises. Existing full regressions, type checks and the 20-hand server
watchdog validation run before release.
