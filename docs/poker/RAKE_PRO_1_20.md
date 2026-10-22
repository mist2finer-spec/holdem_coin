# 1.20.0 — threshold rake, gross EV, private bot roles

At 100/200 blinds, any street-total wager of 900 or more activates 5% rake
for that whole hand, including a preflop fold win. This replaces No Flop, No Drop.
900 is a raise-to total, not the extra increment, total pot, or sum of small bets
across streets. A per-seat peakStreetBet survives folds/street collection and is
reset before the next deal. Once activated, all matched contributions, both
before and after the trigger, are raked at settlement. Uncalled excess remains a
full refund; side-pot eligibility and cumulative integer rounding are unchanged.

All bot odds, call/raise/fold EV, river catches and cheap-call guard valuations
use zero rake. Actual awards and self-play settled rewards still reflect actual
rake. Positive-EV calls retain a personality-weighted option even when removing
rake increases a modeled jam EV. This is a heuristic policy, not a solver.

Pro is an additional aggressive strategy template (VPIP .42, aggression .76,
bluff .20 before existing mood/stack adjustments). On entry, independently draw
a fixed catch threshold in [.45,.52]. Only a proposed fold may be rescued into
a call: equity uses the actor's own cards and public board against the existing
public value prior; no opponent cards or hit flags. Calls must also have positive
eligible-pot EV with a 1% pot safety margin and .85 future-street realization
unless locked/all-in or on the river. Multiway estimates and side-pot limits apply.
No forced raise, no automatic call solely from a threshold, no new raise rights.

Every new CPU independently draws strategy from the full template pool,
unrelated to the selected visible name/portrait. Keep this assignment for its
stay; re-deal mood/stack adjustments retain their existing cadence. Server DTOs
and public histories still omit role, strategy ID, thresholds and private audit.
Single-player policy is client-side and can be inspected through developer tools;
this change prevents fixed visual inference, not inspection of shipped code.

## Uploaded 1.19.1 sample (analysis only, no fixes from this sample)

153 completed hands, 131 CPU-only and 22 with one human; 86 ended preflop.
Independent PokerKit replay: 0 issues across turn legality, chip conservation,
old-version rake, eligible pot winners and showdown evaluation. Zero recorded
validation fallbacks. Observed actions: 745 folds, 181 raises, 109 calls,
103 checks, 65 bets, 26 all-ins. Counts alone do not establish optimal strategy.

Two folds priced at <=12%:
- #8 seq14: AT on A-9-K-2-3, facing 250 into 13,750 on the river. Existing river
  catch estimated 68.34% versus its polarized prior and positive EV but its
  25.28% mixture declined. pricedCall was null because existing locked-runout
  or voluntary-commitment conditions were not met. Candidate for later review.
- #103 seq6: 83o, preflop, 200 into 1,800 with four committed opponents and
  short effective stack. A cheap price alone does not prove this fold is wrong.

These historical decision exceptions were not globally changed in this release.
The expressly requested Pro role and zero-rake EV may independently change new
hands; the uploaded history itself was never edited.
