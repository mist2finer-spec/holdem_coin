# Live bot position policy (rules 1.11.0)

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

## Priced defense refinements (1.9.0)

The original-opener three-bet EV policy now covers starting stacks <=10,000;
ordinary small-open reshoves remain limited to <=5,000. The incremental cost
gate for speculative three-bet candidates rises from 20% to 30% of starting
chips. Passing it only enables EV evaluation, not a forced call. The rare low
connector gate still runs first and forbids re-raise defense for those hands.

For stacks >5,000, aggressive EV uses a tighter four-bet calling model (TT+, AK,
AQs), preventing the old 55+ jam-calling model from overvaluing medium-hand
four-bets. Calls still use the separate three-bet range. These ranges and equity
realization factors are explicit heuristic assumptions, not exact GTO values.

Only positive-EV choices qualify; raises retain their uncertainty margin. Among
choices within 8% of pot EV of the best, call weight is
`1.5 - .5*aggression + .6*vpip`, jam weight `.4 + aggression` (+.7 at <=2,000),
and raise weight `.4 + .8*aggression`. Better-EV jams can still win outside the
near-EV mix. Non-premium continuation caps at .99 for marginal spots, but has
no random fold when best EV >=25% of pot. Premium treatment is unchanged.

A shared isBlind marker uses the actual SB/BB seat IDs, not a postflop position
index. Affordable 22–55 can enter the <=5,000 small-open blind call policy:
incremental cost <=20% of starting chips and positive rake-adjusted realized
call EV are required. Their OOP/IP realization is .85/.92; call frequency is
`min(.85,.45+.60*vpip)`. Additional small-pair entries cannot shove through this
branch. They do not change ordinary non-blind ranges.

All planner decisions now pass through the common final defense stage. Qualified
connector mix folds can reach the existing deeper-stack small-open blind override;
explicit range/price/equity/all-in rejections, failed rare-low gates, and non-trap
limper rejections remain protected. The blanket 50% override remains disabled
for <=5,000: these stacks use their explicit EV policy instead. This preserves
the rare 7% call and <15% limp limits rather than overriding all folds.

## Sizing and public opponent reads (1.11.0)

This table now intentionally uses a house minimum: an unbet street opens at
least 1BB, every full raise targets at least 2x the highest current street total.
A shorter all-in remains allowed. Standard NLHE instead tracks the previous
increment, so e.g. 200 -> 600 -> 1,000 can be legal there; here the third full
wager must reach 1,200. Both live engines and action validation use the shared
helper. Rake is applied at settlement, never added to a raise amount.

The default standard raise is 2x rather than 2.2x. The former 3-BET UI shortcut
was pot-based and was not a 3x multiplier. It is now a shared 3X control: arrows
change an integer-tenth multiplier, minimum 3.0, up to the available stack. Only
the main button commits chips. Its target is a street total including the
actor's existing contribution; when capped it submits only the remaining stack
as all-in. Exact-minimum all-ins and a max below min remain valid.

The original-opener priced three-bet policy now covers deep stacks as well. The
40-opportunity public opponent model records only a player's actions when
facing a single open. It counts each hand at most once; open raises, cold
four-bets, hole cards, and personality parameters do not count as evidence of
wide three-betting. The neutral prior is 1.5/12; fewer than six opportunities
produce no adaptation. Later frequency determines a bounded blend between
the ordinary three-bet range and a wider modeled range. This applies to humans
and bots alike. 128 identities are retained; old action opportunities expire.
Seat/persona replacement creates a fresh identity; server restart resets reads.

A known raiser is modeled separately from flat callers in each contribution
layer: the raiser uses its three-bet range, other live callers use the open
range. This avoids assuming every caller has the same tight range as the
three-bettor. The deterministic equity cache includes the range vector. A loose
read may enable priced 55+/broadways/suited aces, but positive realized EV and
the existing cost gate are still required. All-in situations do not use the
loose-read override; rare low connectors retain their own gate. Nothing alters
actual cards or settlement to force a target win rate. Ranges, realization and
frequency weights remain heuristic estimates.

Private hand audits include the public three-bet read and last-raiser seat.
These are stripped from regular player histories with the other CPU audit
fields. No uploaded raw history or private player identifier is committed.

## Human-specific private call referee (1.12.0)

At the owner's request, an additional balancing rule deliberately uses the
human aggressor's PRIVATE hole cards. This is privileged-information assistance,
not ordinary range-based poker AI: even a boolean derived from private cards
contains hidden information. Existing range estimates remain in place.

After all normal preflop entry, short-stack and trainer gates, a proposed FOLD
may become a CALL when the last raiser is human, the CPU's estimated heads-up
equity against that human is at least 46%, and its projected call EV after 5%
rake is positive. It covers opens, three-bets and subsequent raises, including
OOP human aggressors, at every stack depth. It never changes existing calls or
raises, generates a new raise, targets a CPU raiser, or runs postflop.
A stack-sized call is represented as all-in without increasing the wager.

The referee uses 1,024 bounded deterministic simulated runouts, counts ties as
half a heads-up win, and never reads the real deck or future board. Thus 46%
is a threshold on a sampled estimate, not exact enumerated equity. Other live
opponents' actual cards are ignored: they receive modeled open-range hands,
and conservative projected calls are evaluated separately for each eligible
contribution layer. Uncallable excess and other players' side pots cannot inflate
the CPU's expected award. A favorable heads-up comparison can still fail the
multiway/price check; no postflop winnings are guaranteed by this preflop EV.

Only the referee's boolean is passed to the decision wrapper, not the human
cards or equity. Neither is newly sent to the model, public state, or public
history. The existing protected admin export still contains completed private
hands. A private audit route `human-equity-call-defense` identifies accepted
fallbacks. Both single and server modes use this shared policy. The cache has
at most 128 entries and is in memory only; no training or storage growth occurs.

## Shared compact betting controls (1.12.1)

Single and server modes use the same four-column action grid on mobile and PC:
Fold/Check-or-Call, adjustable Raise, 1/4-and-1/2 Pot, 3/4 Pot-and-All-in.
The multiplier defaults to 2X with a 2X floor. Left arrows adjust by 1X,
right arrows by 0.2X; arrows never submit a wager. The central button commits.

Pot buttons submit immediately and show the actual street-total target.
On an unbet street, target = floor(livePot * fraction). Facing a wager,
target = highestStreetBet + floor((livePot + callCost) * fraction): first call,
then raise by the chosen fraction of the pot after calling. Targets are clamped
to the existing house minimum and available total chips; a capped target is
submitted as all-in using the remaining stack. Fractions are therefore adjusted
when below the legal minimum or above the stack, and rake never enters sizing.
The custom slider remains available below the shared grid.

## Layout and displayed-pot correction (1.12.2)

This supersedes the post-call formula above. Pot shortcuts now use exactly
floor(displayedLivePot * fraction) as the street-total target, without adding
the call or previous wager. A target below the house minimum is disabled and
shows the minimum instead of silently becoming a larger bet. Available-stack
capping remains allowed and is explicitly labeled ALL-IN when it consumes the
actual remaining stack. For a displayed pot of 2,000, the requested totals are
500, 1,000 and 1,500; chips already committed on this street are not charged twice.

Both table modes now use a dynamic-viewport two-row grid. The action panel
occupies its own normal-flow row; the table shrinks into the remaining space,
with vertical seat clearance. This replaces overlapping absolute positioning.
Short viewports can scroll the 480px minimum-height page; mobile bottom safe-area
padding prevents the home indicator covering the action panel.

## Stable table and uploaded button skins (1.12.3)

Both modes reserve the same controls row on every turn: 252px on mobile and
312px on wider screens, plus bottom safe-area clearance. Waiting, pre-actions,
showdown and the full betting panel no longer change the table's dimensions.
The root uses the small viewport height (svh) so mobile address-bar expansion
does not repeatedly grow and shrink the playing area. Short screens retain a
scrollable minimum page height to keep seats and controls readable.

The supplied red, blue and purple PNGs are shared by both action panels. Red
marks fold/all-in, blue marks check/call, and purple marks raises/pot fractions.
Hover only changes brightness; there is no scale or press movement. Existing
action handlers, 2X default, sizing rules and disabled states are preserved.

## 1.13.0 — river-only bluff catching

Shared `decideLiveBot` final fold fallback for single and server play. Applies only
on a complete river board, facing a bet, with exactly two live players. Existing
calls/raises, preflop, flop, turn and multiway decisions are unchanged. The private
preflop human-card referee is never called by this policy.

`poker-river-defense.ts` enumerates the 990 legal opponent hole combinations after
excluding only the CPU's own two cards and the five public cards. It models a
polarized betting range: 65% weight on the strongest 35% of combinations, 35% on
the weakest 35%. This bluff share is an explicit tuning assumption, NOT a measured
human bluff rate or exact win probability. Ties count as half. Opponent cards,
folded cards, deck state and future information are not inputs.

Positive call EV after 5% rake is required. Contribution layers exclude inaccessible
excess bets and account for refunds; calls cap at the actor's stack. Then a 5–40%
probability converts fold to call (or a stack-sized all-in CALL, never a raise).
Frequency interpolates tightness from base VPIP .18–.65 and aggression .20–.82,
weighted 80% base identity and 20% current hand persona. Thus tight characters
catch more frequently *conditional on reaching an eligible river*, not more often
preflop. Range estimates use a 128-entry bounded memory cache.

Private audit adds `riverCatch`: frequency, equity, callEV, cost, eligible, accepted;
actual overrides have `decisionPath: river-bluff-catch`. No new public strategy UI.

Analysis of uploaded 1.12.3 archive: 304 hands / 2800 actions / 77 all-in actions /
3 side-pot hands: replayed chip, legal call, board, rake and settlement checks had
no errors. Observed dealt-hand VPIP: paladin 13/154 (8.4%), alchemist 14/151 (9.3%),
ice queen 26/190 (13.7%), goblin 73/295 (24.7%), pirate 58/235 (24.7%), barbarian
49/159 (30.8%). These are observed rates, not persona parameters or causal estimates.
Hand 105 is CPU-only and ends preflop; it is not the reported human wheel hand.
Only five CPU river folds occur in this archive. Replaying the *original* states
makes 99 and 240 eligible (14.2% and 25.4% catch chance respectively); the other
three remain negative EV. This is eligibility replay, not predicted game outcomes.
