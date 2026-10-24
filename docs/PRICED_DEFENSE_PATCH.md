# Priced defense follow-up

Based on the 340-hand v1.25.0 audit (revision 5205fa3).

- A postflop actor's previous-street contributions now qualify for committed-runout valuation when every opponent is all-in. The current street no longer needs an existing bet. This does not force arbitrary high-card calls: the existing eligible side-pot EV calculation still must pass. Hand 92 now calls 120 against an eligible final pot of 11,035.
- Heads-up flop/turn first bets may bypass the personality roll when the actor has their own pair or a real draw, the eligible price is <=18%, and realized estimated equity beats that price by at least five percentage points. Positive EV plus its existing margin remains required. Hands 84 and 192 are regression fixtures. Larger bets, raises and multiway spots keep the 40–60% personality mix.
- Against postflop raises, draw-board defense now uses the existing board-strength-conditioned value prior rather than a preflop three-bet range. This is a conservative estimate, not a solver or knowledge of the opponent's hand. Hand 271 covers that route. Ordinary first-bet equity remains range-based and uses 192 deterministic samples.
- The guard maps public betting fields explicitly and never copies opponent hole-card properties. New fixtures contain only the actor's hole cards and public betting state.
- Shared `decideLiveBot` is used in solo and multiplayer. Rules, dealing, rake and RPG content are unchanged.
