# 1.22.0 — public action lines and bounded cash-game tactical alternatives

## Scope

The user authorized implementing the previously proposed cash-compatible tactics.
Tournament, bubble, payout, ante progression and ICM rules are deliberately NOT
implemented. A future tournament engine can consume this public-action interface
without sharing the cash/rebuy settlement policy. The supplied 16 video summaries
are design inspiration, not verified hand histories, frequency estimates or
ground-truth training labels. Missing cards and unknown stacks are not fabricated.

## Public information and state lifecycle

`PublicLineTracker` retains only actual normalized actions: seat, street, action,
call price, paid chips, street-total wager, pot before action, whether the action
increased the wager. No hole cards, names, personas, hit hints or private audit
objects enter the tracker. Both `usePokerTable` and `HybridHoldemRoom` record every
human/CPU action after normalization/application. Data resets per hand and is
bounded at 1,024 rows. Each read returns isolated snapshots.

Strong-hand induce plans are per seat/street, armed by a selected check, activated
only by an actually recorded check, and cleared on the actor's next non-check.
Different streets/hands cannot reuse them. An induced call still needs current
equity >=62%, own two-pair+/overpair classification, cost <=75% of pot and positive
layer-aware modeled EV exceeding a 2% pot margin. It is not a promise to call any
shove. Existing profitable calls/raises are not replaced by this call safeguard.

## Soft range likelihoods

Postflop trainer equity and called-action EV condition sampled *hypothetical*
opponent hands on their public checks/calls/raises in this hand. Each observation
changes strong/medium/draw/air likelihoods modestly; every category retains positive
weight (0.45–1.65). A check slightly reduces strong-hand weight, but never proves
there is no Ax or trap. These likelihoods are bounded heuristics, not a solver,
measured bluff frequencies or proof that a chosen call is profitable.

Samples remain deterministic/cached and rejection loops bounded. Every side-pot
layer uses only its eligible opponents' profiles. Actual hidden cards, private
showdown exports and UI character identities are never inputs. Bot EV remains
gross of rake; settlement still uses existing threshold rake and refunds.

## One candidate selection, not a sequence of forced overrides

The existing trainer/preflop action remains the baseline. `poker-line-policy`
adds candidates with persona-dependent weights, with total additional selection
mass capped at 35% per decision. The other >=65% retains the original action and
existing policies. The conditional induced-call safeguard is separate and can be
deterministic once all current-price/equity requirements are met.

Selected tactical actions bypass legacy postflop support for that decision, so a
selected induce check cannot be converted immediately back to a value bet or
c-bet. Existing cheap-call and board-defense safeguards remain in the common
finish path. A selected raise is never automatically converted into a shove;
the normal rules normalizer remains authoritative.

| Candidate | Conditions and restrictions |
| --- | --- |
| Induce check | Heads-up, own two-pair+/overpair, >=68% modeled equity, no bet this street; 5% + 20% of persona bluff frequency |
| River thin value | Turn checked through, own pair+, >=56% equity, pot >=10BB; exactly 1BB, positive called EV; only replaces a free baseline check/fold |
| River probe | Turn checked through, real missed own draw or actual nut-flush blocker, equity 18–56%; half-pot |
| Delayed turn barrel | Flop checked through, own draw/nut blocker, equity 25–60%; one-third pot |
| Check-raise | Own prior check, reopened raise rights, incoming <=35% pot; two-pair+ with >=65% equity or actual flop/turn draw with >=28% equity; target >=2.5x facing wager and legal min-raise |
| Preflop squeeze | Exactly one 2–4BB open plus an actual flat caller; both starting/effective stacks >=30BB; baseline already allows call/raise; suitable value range or rare aggressive suited range |

Tactical postflop bets/check-raises risk <=35% remaining stack and never the full
stack; literal pot sizes must satisfy minimum raise rules. No tactical postflop
candidates against all-in opponents or in multiway pots. Existing layer-aware
decisions continue there. No automatic king/queen-high hero calls or strong-hand
exploit folds based on a single "betting story" are added.

Squeeze target: 3.5x in position / 4x otherwise +1BB per flat caller. Incremental
cost must be <=20% effective remaining capacity and below all-in. Existing early
position nonpair flat-only and rejected-entry gates remain intact. Short-stack
reshoves, original-opener three-bet defense and premium sizing remain in their
existing policies. The 30BB minimum is only an eligibility condition; the 20%
commitment limit often requires deeper stacks for a legal squeeze.

Probe/check-raise bluff EV mixes a bounded assumed fold probability with called
downside. This assumption is explicitly a policy prior, not a measured opponent
fold rate. Multiway squeeze fold probability is compounded conservatively. These
priors need subsequent hand-history comparison before claiming a profit gain.

## Diagnostics and checks

Private history audits include the chosen `line-*` path, estimated equity and EV.
They remain outside public DTOs/history. Compare these paths by position, stack
band, opponent count and street; do not interpret counterfactual decision rates
as realized profits.

Tests cover snapshot privacy/lifecycle/caps, nonzero trap likelihoods, exact thin
value sizing and selection cap, real induce-check/response integration, draw and
raise-right restrictions, delayed probes, all-in/multiway/shared-board exclusions,
squeeze gating, contribution-layer EV and both six/eight-seat real server loops.
The full existing suite and 20-hand backend validator run before deployment.
