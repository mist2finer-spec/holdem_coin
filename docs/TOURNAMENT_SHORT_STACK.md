# Tournament short-stack policy

Tournament CPUs use a separate, persona-independent policy at hand-start stacks
of <=3BB, <=5BB and <=10BB. Stacks and call prices use the actual current blind
and integer chips, before the cash game's 200-chip normalization. Cash/single
player decisions and human actions are unchanged.

- Unopened heads-up <=3BB: shove any two when raising is legal.
- Other <=3BB and <=5BB opens: broad pairs/Ax/high-card/selected suited ranges;
  ranges widen with 2–4 surviving entrants. Eligible opens shove.
- >5–10BB: broader short-handed opening range, normally 2.5BB subject to legal
  minimum/stack cap; facing aggression, price calls and premium reshoves.
- All bands: preflop calls <=0.1BB cannot fold; <=0.5BB calls cannot fold when
  required pot equity is <=12%. A free option checks unless opening aggressively.
- Other preflop continuations compare deterministic sampled equity against a
  public range and actual eligible contribution layers. No private opponent cards,
  persona tightness or arbitrary cash-stack penalties are used. Bad-price/multiway
  weak hands can still fold; this is a chip-EV heuristic, not an ICM/Nash solver.
- Postflop only rescues an existing fold at <=0.5BB and <=15% required equity,
  with a board-value-conditioned equity margin of 2 percentage points. Value
  raises remain intact; zero-equity hands are not forced to call.
- Street raising-rights caps, all-in-only opponents and side-pot eligibility are
  honored. No new betting occurs against an already locked all-in runout.

History privateAudit.tournamentShortStack records band, current BB stack, price,
eligible pot, equity where evaluated and selected path. This makes the previously
unavailable overfold diagnosis measurable in later hand exports.

Validation: 244 poker regressions, server TypeScript check and production build.
The source of the reported folds could not be proven without the original logs;
this patch addresses the shared cash-policy path and adds the missing audit.
