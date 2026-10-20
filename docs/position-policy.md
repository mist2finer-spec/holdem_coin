# Live bot position policy (rules 1.6.0)

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
raise percentages. The UI shows each character's base style; the global badge
has no global strategy badge: the five-hand correction stays internal.

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
