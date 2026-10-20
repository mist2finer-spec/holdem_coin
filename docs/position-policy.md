# Live bot position policy (rules 1.8.1)

Single-player and multiplayer both call `decideLiveBot`. Position is computed
from public seat status, clockwise after the button, skipping folded, inactive
and all-in seats. The last remaining betting player is IP; players before that
player have a graded OOP disadvantage. The button acts last postflop, including
heads-up. This does not change the legal preflop action order.

The live trainer mixes a free OOP check before sampling its existing policy:

| Hand | Base check mixture |
| --- | --- |
| Top pair | 45% |
| Two pair or stronger | 40% |
| Draw | 35% |
| Weaker hand | 65% |

These base rates now vary with character aggression: add `(0.5 - aggression) *
0.20`, so calm characters check more and aggressive characters lead more. Add
10 percentage points when more than one betting opponent remains. Reduce the
strong-hand check mixture by 8 points on three-flush/connected boards. Clamp
the mixture to 15–85%. The
remaining branch can still select a check, so these are mixture probabilities,
not exact final observed check frequencies. Facing a bet never uses this free
check branch. Value betting remains possible with every strong hand.

Each betting round keeps a separate set of players whose last action was a
check. A raise resetting `hasActed` does not erase that history. When a checker
faces a moderate bet, strong value hands receive a check-raise weight increase;
top pair receives a smaller increase heads-up and none multiway. Large pressure
continues through the existing equity and rake policy. Non-check actions clear
that player's marker; every new street starts with a fresh set.

OOP preflop equity requirements receive a premium graded by relative position
and caution (`1.2 - aggression * 0.6`). OOP raise weights and explicit weak-hand
bluff frequency are reduced (bluff multiplier `0.4 + aggression * 0.3`). Value
check-raise weights also use character aggression and tightness.
The existing guarded 50% small-open/limped
blind-defense override remains in effect. IP retains its existing policy.

These are adjustable game heuristics, not a GTO solver or a PokerKit integration.
Only the acting player's cards and public board/state enter the policy. Existing
action validation, side pots, rake and all-in runout rules still apply.

Run `npm test --prefix mini-services/poker-server` for seeded distribution,
position, real server check-history and existing gameplay regression tests.

## Individual character traits and short-stack mood

The table cycle no longer replaces character traits. Instead, VPIP gets a
quarter of the table profile's difference from 0.35, aggression a quarter of
the difference from 0.55, and bluff frequency a fifth of the difference from
0.15. Ordinary characters retain their relative differences in every phase.

`individualLivePersona` selects a stable pseudo-random mood using only character
ID, seat and hand number. No opponent cards enter this calculation. The mood
uses starting chips (`stack + totalBet`), so posting blinds or committing more
chips cannot flip it during a hand. The next hand can select another mood.

| Base character | Normal stack surge | Starting chips <= 10,000 |
| --- | --- | --- |
| Tight: VPIP <= .30 and aggression <= .55 | 12% | 40% |
| Aggressive: aggression > .70 | 3% | 8% |
| Other | 7% | 18% |

A surge raises participation and aggression for the hand, with VPIP at least
.45 and aggression at least .78. It does not force any action: legal-action
validation, position, board strength, equity, rake and side-pot rules still
govern decisions. These are configured mood frequencies, not measured VPIP or
raise percentages. Bot styles and numeric personality traits are not displayed.
Server seat DTOs omit personality/style fields; the five-hand correction stays
internal. Single-player still executes its AI locally, so this is not source-code
secrecy against developer tools.

## Stack adjustment

Starting buy-in and manual rebuy are 5,000 chips in both modes. SB/BB stay
100/200. Final traits combine base character, five-hand table correction,
per-hand mood, then starting-stack adjustment, with bounded trait values.

| Starting chips | VPIP adjustment | Aggression adjustment | Bluff adjustment | Required equity premium |
| --- | --- | --- | --- | --- |
| <= 2,500 | -.12 | .00 | -.04 | .08 |
| 2,501–5,000 | -.08 | .00 | -.03 | .06 |
| 5,001–10,000 | -.04 | .00 | -.02 | .04 |
| 10,001–15,000 | -.02 | .00 | -.01 | .02 |
| 15,001–35,000 (and above) | .00 | .00 | .00 | .00 |

The equity premium applies in full preflop and at half strength postflop.
Against at least one opponent with effective starting chips above 15,000,
add .015 to the premium and reduce pot-raise/all-in logits by .35/.55. A deep
player facing only a short stack does not receive this additional deep-v-deep
penalty. Existing contribution-level EV still evaluates side pots separately.
These are chip-based game heuristics, not a solver-derived range chart.

Shorter stacks now enter fewer pots and bluff less. This does not reduce value
aggression: the selected good hands can prefer re-raising or shoving instead of
calling. The older 50% speculative blind-defense override is disabled at starting
stacks <= 5,000 so it cannot undo a short-stack policy fold.

## Short-stack re-shove policy

Facing one 2–3BB open preflop with starting chips <= 5,000, compare fold (zero
incremental EV), a realized call, a strong 3x re-raise, and a shove. Calling
opponents use modeled opening and tighter jam-calling ranges, sampled before
unknown board runouts. The EV calculation retains contribution layers, rake,
refunds, and side-pot eligibility. Aggression EV mixes called EV with a bounded
estimated all-fold probability (zero if a live opponent is already all-in).
OOP calling realizes less of its showdown equity than IP calling in this model.

The entry gate allows 66+ and AQ+, with additional suited/broadway hands for
looser/aggressive characters. Tight KQo/QJo can fold even at attractive-looking
raw pot odds. Only positive modeled-EV aggressive options enter the short-stack
mix. At <= 2,500 prefer a positive-EV shove when close to the best re-raise;
otherwise choose the best modeled aggressive option most of the time, retaining
some calls and folds. Do not make a nominal raise committing >=70% of the
remaining stack. Premium JJ+/AK are not randomly folded when a positive-EV
aggressive option exists. Other contexts retain the main policy, with a small
positive-EV value-shove boost for short stacks. Action normalization remains
the final authority in both modes.

The opening/calling ranges, fold probabilities and realization factors are
explicit heuristic assumptions, not inferred opponent hole cards or a solved
equilibrium. Range sampling and caches are bounded.

## Range and action mixtures (1.7)

Before table/mood/stack adjustments, participation uses `.30 + (baseVPIP-.18)*.80`
and aggression `.35 + (baseAggression-.20)*.85`. This lifts the quieter end of
the pool while retaining differences instead of flattening several bots to
identical floors. Stack tightening, short-stack EV re-shoves and OOP remain.

The shared preflop entry planner evaluates the final effective traits:

| Numeric connector/one-gap family | Entry gate |
| --- | --- |
| Suited connectors, lower card >= 5 | VPIP >= .30 |
| Suited one-gappers, lower card >= 5 | VPIP >= .35, aggression >= .50 |
| Offsuit connectors containing 7 | VPIP >= .42, aggression >= .58 |
| Offsuit one-gappers containing 7 | VPIP >= .48, aggression >= .65 |

Ordinary connector calls also need affordable 2–4BB pricing and modeled equity
near after-rake odds. Without a qualifying call, these hands fold rather than
falling through to unrelated bluff/automatic blind-defense branches. Qualified
unopened connectors can open to 3BB, with final-trait sampling. Opponent opening
range rollouts also include suited middle connectors; jam-calling ranges stay tight.

23/34/24/35 suited or offsuit use a separate 7% call gate, never an automatic
raise. Requirements: final aggression >= .70, VPIP >= .35, starting chips >=
5,000, effective chips >= 4,000, at most three opponents, a single open <=4BB,
no live all-in, call cost <=15% of starting chips, and approximate equity within
.08 of after-rake odds. Rejection returns fold/check directly; no later policy
can retry the gate. This is a per-eligible-decision probability, not a quota
over arbitrary short runs or 7% of all hands.

Limping is limited to late seats/SB with 22–77 or qualified suited connectors,
starting chips >2,500 and no raise. Its single gate is `.12*(1-.5*aggression)`
(minimum .04): below .15, and lower for aggressive characters. Failed rolls
disable the generic check/call action while facing a blind, preventing leakage.
Limp history persists through preflop re-raises. Only bluff >=.20/aggression >=.55
can retain limp/re-raise options; others call affordably with sufficient equity
or fold. Free BB checks remain legal.

Against 3–4BB opens, or a re-raise to that amount after the actor opened, the
flat-call gate uses `.30 + (VPIP-.35)*.60 - (aggression-.55)*.45`, plus .10 IP
or -.08 OOP, bounded .03–.75. Premium JJ+/AK use a .20 multiplier. Pricing,
equity and stack gates apply before sampling; exact short-stack cases continue
through their EV policy when the planner does not choose a flat call.

Each real betting round tracks its own last aggressor independently from the
bluff-reveal marker. A checked-through street clears continuation initiative.
CB/check mixtures use aggression, board texture, hand tier and opponent count.
Turn air barrels are capped by final aggression (high .35, medium .15, low .02),
and eligible high-VPIP checkers can defend small bets when their equity supports
it. River initiative holders with trap-like traits mix more strong-hand checks.
These weights are heuristics, not promised exact betting frequencies.

## Original opener facing a three-bet (1.8)

Each preflop round records who actually made the first raise. Only that opener
receives the new short-stack three-bet defense (`raiseLevel === 2`, starting
chips <=5,000). Cold calls and four-bets retain their own policy. The marker
clears each street/hand, and it is not included in client DTOs. The entry planner
defers to the defense policy before its ordinary connector price cutoff, while
the separate rare 23/34/24/35 gate still forbids these hands from this route.

Sizing is not capped at a total of 4BB or 6BB: a 3BB open facing a 9BB re-raise
is evaluated, as are larger bets and all-in three-bets. Candidate EVs compare
fold, call, a legal non-committing four-bet and an all-in. A three-bet-specific
modeled opponent range is used for calls; a tighter jam-calling range is used
for re-shoves. Each range rollout uses 768 deterministic samples in this route,
with the same bounded cache and public-information-only inputs.

Call equity realization improves as remaining stack/pot shrinks and reaches 1
when the call itself is all-in. The stack premium is scaled by .25 and positional
premium by .30 for this defense; both remain part of an explicit EV margin.
Estimated all-fold probability is capped at .20 per opponent (.10 if an opponent
already committed >=40% of its starting chips), and is zero if a live opponent
is already all-in. Only aggressions with EV above `max(.03*pot,.04*newCost)`
enter the mix, preventing a near-zero noisy estimate from justifying a large jam.

88+ and AQ+ are standard candidates. Additional 66/77, cheaper small pairs,
suited aces/broadways and qualified connectors depend on final personality,
price and stack. Eligibility is not an instruction to shove: if no permitted
candidate has adequate positive EV the player folds. Otherwise near-equivalent
EV options use call/raise/jam weights from personality; marginal continues retain
some folds. Premium JJ+/AK do not randomly fold when a valid positive-EV option
exists. Very large three-bets can still fold hands that defend smaller sizing.
When all live opponents are all-in, only call/fold candidates are permitted.

Larger stacks can use the existing priced flat-call mix beyond 4BB when they
are the recorded opener and the call remains affordable. This patch does not
substitute an unopened-pot push chart for a three-bet defense range or claim a
Nash solution. Existing preflop tiers classify 88–TT as TWO_PAIR_PLUS, 55–77 as
TOP_PAIR, and 22–44 as WEAK_PAIR; the policy does not assume all medium pairs
share a hard fold mask. Actual fold rates depend on the full scenario.

## Stack bands (1.8.1)

Starting chips (remaining stack + hand contribution) select a stable band:

| Chips | VPIP delta | Aggression delta | Bluff delta | Equity premium |
| --- | --- | --- | --- | --- |
| <=1,000 (5BB) | -.16 | 0 | -.05 | .10 |
| 1,001–2,000 | -.12 | 0 | -.04 | .08 |
| 2,001–5,000 | -.08 | 0 | -.03 | .06 |
| 5,001–10,000 | -.04 | 0 | -.02 | .04 |
| 10,001–15,000 | -.02 | 0 | -.01 | .02 |
| >15,000 and <25,000 | 0 | 0 | 0 | 0 |
| >=25,000 | 0 | +.08 | 0 | 0 |

Below 5BB stays in the most restrictive band, without a chip top-up or forced
all-in. At exactly 25,000 the additive aggression boost starts; existing .95
clamping and character differences remain. It does not automatically increase
VPIP or bluff frequency. Shared live decisions apply this in both modes. Existing
<=5,000 reshove eligibility and effective-stack/deep-vs-deep EV protection remain.
