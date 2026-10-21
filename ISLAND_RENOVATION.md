# Island Hold’em 1.14.0

- New entrance and Hong lobby based on guid.pptx; uploaded environment art and static assembled character portraits. Parts/animation deferred.
- Single player, independent six-seat and eight-seat server rooms; tournament shows Under Repair.
- Shared seat rendering: inward hole cards, larger own cards, lower labels, fixed compact mobile pieces and readable preactions.
- Modern character names and portraits; stable persona IDs and individual strategy parameters retained.
- Tight personas (base VPIP <= .30, aggression <= .55) use a bounded recent-100-hand participation window. Below .15, eligible priced hands can open or call a small open. This is a target, not a guaranteed realized VPIP: weak short-stack entries, 3-bet folds, expensive calls and dry-side-pot raises are not overridden. Final preflop calls are counted, including existing defensive fallbacks.
- Per-room Socket.IO notifications, history archives and user actions; admin export combines both rooms. Existing eight-seat clients remain compatible.
- Correct original-seat lookup for bluff reveals after rotating the table.

Validation: 106 regression tests; server TypeScript check; production build; actual three-client Socket.IO test spanning three hands in both rooms, with private-card masking and mixed human/CPU archive checks. Root-wide tsc still includes unrelated legacy test/Prisma generation errors; changed UI card types corrected.

## 1.14.1 mobile and postflop patch

- Mobile removes the 830px minimum height, reserves a fixed 232px control row, and compacts seats/cards by available height. Hong moves to the upper left; the lobby controls shrink. Fold overlays the portrait; own name/stack move lower and own wager moves off the hole cards.
- Eight-seat mode is temporarily Under Repair, with both lobby and server join guards. Existing eight-seat history remains available for admin export; its game loop is paused.
- Effective aggression >= .65: on the flop only, the last preflop aggressor with a missed hand and no bet facing it makes a quarter-pot C-bet at 65%. The remaining 35% checks. A previous check, no betting opponent, or a probe requiring a shove blocks this overlay. Made hands retain the original value policy; legal minimum bets still apply.
- Tight base personas can use private aggregate human hit/miss booleans. No ranks, hole cards, matchup equity or future cards enter this policy. A pair involving a hole card (including pocket pairs), or a made straight/flush+ counts as a hit; draws alone do not. Any active human hit blocks the all-miss branch. Other CPU cards remain unknown.
- Tight IP flop aggressors may probe after all humans miss (50% mix, uniform 1/3–3/4 pot), preserving existing value actions. Affordable fold-to-call catches additionally require their own made hand/draw, unknown-range equity covering rake-adjusted odds, 40% mix, call <= half pot and <=20% remaining stack, and a missed human bettor. A miss never guarantees a bluff or victory.
- Shared policy is invoked by both single and server modes; private hints are never emitted in public DTOs/history. Regression coverage includes exact 65% sampling, value preservation, multiple humans, OOP, dry side pots and expensive calls.
