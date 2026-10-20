# Live bot position policy (rules 1.4.0)

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
is labeled as table atmosphere rather than every character's identity.
