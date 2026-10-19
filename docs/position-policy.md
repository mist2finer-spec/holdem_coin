# Live bot position policy (rules 1.3.0)

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

Add 10 percentage points when more than one betting opponent remains. The
remaining branch can still select a check, so these are mixture probabilities,
not exact final observed check frequencies. Facing a bet never uses this free
check branch. Value betting remains possible with every strong hand.

Each betting round keeps a separate set of players whose last action was a
check. A raise resetting `hasActed` does not erase that history. When a checker
faces a moderate bet, strong value hands receive a check-raise weight increase;
top pair receives a smaller increase heads-up and none multiway. Large pressure
continues through the existing equity and rake policy. Non-check actions clear
that player's marker; every new street starts with a fresh set.

OOP preflop equity requirements receive up to +7 percentage points, graded by
relative position. OOP raise weights and explicit weak-hand bluff frequency
are reduced (bluff multiplier 0.55). The existing guarded 50% small-open/limped
blind-defense override remains in effect. IP retains its existing policy.

These are adjustable game heuristics, not a GTO solver or a PokerKit integration.
Only the acting player's cards and public board/state enter the policy. Existing
action validation, side pots, rake and all-in runout rules still apply.

Run `npm test --prefix mini-services/poker-server` for seeded distribution,
position, real server check-history and existing gameplay regression tests.
