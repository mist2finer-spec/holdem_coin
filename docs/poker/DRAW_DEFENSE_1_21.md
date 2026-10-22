# 1.21.0 — priced rivers and draw-board defense

## Uploaded history, before this patch

108 completed hands, all 1.20.0 / e1f2acc; 67 CPU-only, 41 with one human.
75 ended preflop. 530 folds, 87 raises, 56 calls, 49 checks, 26 bets, 19 all-ins.
These counts are not proof that a particular fold is wrong or the bettor bluffed.

Independent PokerKit replay identified three canRaiseBefore mismatches: #2/2,
#23/10, #72/5. In each, no remaining opponent could contribute above the current
price, even though some still had chips to make a partial/full call. No illegal
raise occurred in these records. A diagnostic copy changing only those three
flags replays all 108 hands without other errors, including chip conservation,
threshold rake, legal actions and pot/showdown winners. Uploaded data is unchanged.

The shared responder test now requires currentBet + stack > highest wager,
including a full-BB bring-in when a blind is short. Rights to reopen and actual
responder capacity are independent. This corrects both maximum raise availability
and the recorded flag in server, solo play and self-play.

## Previous AT river

Previous 1.19.1 #8/14 had AT on A-9-K-2-3 (three spades), facing 250 into 13,750.
The old locked-all-in guard required a contribution in the current street (or a
stack-consuming call), so it returned null despite large earlier investment.
The old river catcher estimated 68.34% against its public polarized prior but
only called with a 25.28% mixture. Its roll declined. No opponent card was needed
for this diagnosis. The new fixture retains own cards and public seats only.

A separate cheap-river rescue uses actual stack-capped call / eligible post-call
pot <= 8%, own showdown contribution and positive incremental EV above a 1% pot
margin. Accepted cheap rivers call deterministically, regardless of current-street
investment. Missing draws/board-only hands do not gain the new automatic rescue.
Refunds and inaccessible side pots are excluded. Opponent future bets are absent.

## Draw-board mixture

- Public texture: two-suit flop or >=3 same-suit cards on turn/river; or >=3 unique
  ranks in a five-rank straight window, including the A-2-3-4-5 wheel.
- Own eligible hand: own pair or better, or a real four-card draw before the river.
  Air/backdoors and missed river draws do not qualify for this added mechanism.
- Additional call frequency on a proposed fold: 40% to 60%, monotonic with
  aggression. 80% base aggression + 20% effective hand mood/stack aggression;
  .20 aggression -> 40%, .51 -> 50%, .82 or higher -> 60%.
- EV must remain positive by max(1 chip, 1% eligible pot). Future-street realization
  is .82 OOP / .90 IP unless stack-capped or all remaining opponents are all-in.
- Flop/turn equity: 128 cached public-range runouts, range conditioned on raise
  pressure. River: existing polarized value/bluff prior, conservatively powered
  by eligible opponent count for multiway layers. This is a heuristic assumption,
  not measured actual bluff frequency or a solver-certified multiway equity.
- Never read opponent hole cards, hit flags or true winning status. Both humans
  and CPUs are defended by the same policy, using eligible contribution layers.

This is a single added fold-rescue roll, not a guaranteed 40–60% overall call
rate. A handled draw-board decision does not reroll the legacy river or Pro
rescue; wet-board tight-range catches defer to this same mechanism. Existing
raises/calls remain, and the cheap locked-all-in price guard remains separately
valid. Cheap river calls intentionally bypass the probability cap at 100%.

## Snapshot diagnosis (counterfactual, not new hands)

On 28 observed postflop CPU folds, 15 boards meet the texture definition.
The added policy finds 7 eligible defenses and rejects/excludes the others.
Examples: #12/12 66 with 6-spade draw: ~48.6% mix; #16/11 JJ on Q-Q-8-2 with
three clubs: ~51.3%; #79/9 TT on A-6-2 with two hearts: ~49.3%.
#13/12 78 on K-2-4-6 with three clubs has negative modeled call EV and still
folds. Positive estimates depend on public-range assumptions; these snapshots
are not proof the actual opponent was bluffing or that every call wins.

## Validation

Regression fixtures cover the historical AT rescue, public textures, 40/50/60%
frequency, real draw eligibility, negative-EV folds, inaccessible side pots,
private-card invariance, no compounded Pro/river rolls, preservation of raises,
responder capacity, and full bring-in against short blinds. Full pipeline also
checks types and 20 real 8-seat server hands with action/hand timeouts and joins.
