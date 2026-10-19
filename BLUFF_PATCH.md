# Bluff reveal patch

Applies to single player and Socket.IO multiplayer.

- Aggressive effective personas (`aggression > 0.7`, after the existing strategy rotation) attempt a bluff at least 20% of eligible weak-hand decisions. Existing higher frequencies remain. This is a per-decision mix, not a guaranteed fraction of hands or wins.
- Eligible decisions require a legal raise, a solvent opponent, and less than maximum betting pressure. Explicit bluffs prefer the standard raise size. Normal strong-hand decisions retain rake-aware EV scoring.
- Track the last actual aggressive action after action validation. All-in calls do not replace it; value raises do. A successful bluff requires a non-showdown win by that bot after every other player folds.
- During the existing five-second result display, reveal only the successful bluffer's cards and show a taunting message. Reset the marker and reveal before the next hand. No bluff announcements are sent while opponents are deciding.

Validation: 31 server/rule regressions; server TypeScript check; changed client-file ESLint; production build; single-player hook simulation for bluff/fold/reveal/taunt/reset; two-client Socket.IO smoke test.
