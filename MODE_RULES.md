# Single-player / multiplayer rule parity (1.2.0)

Both live modes now call `src/lib/poker-live.ts` for action normalization, chip
updates, blind posting/positions and AI decision post-processing. Both already
share settlement in `poker-rules.ts`, successful-bluff detection in
`poker-bluff.ts`, and live AI scoring in `self-play-trainer.ts`.

- 100/200 blinds, 20,000 buy-in, 8 seats, 10-second human action window.
- 5% contested-pot rake; untaxed uncalled refunds; separate main/side-pot winners;
  winner results and logs show net profit after the player's own contribution.
- A covering call locks further betting if only one solvent player remains;
  two solvent opponents continue side-pot betting normally. Runout deals 3/1/1.
- Existing strategy rotation, rake-aware AI scoring, traps and aggressive bluff
  mixture are shared. The 50% conditional blind-defence override now uses the same
  helper in both modes. Successful bluff reveals only the winner's cards.
- Bot replacement below 400 or at 100,000 is retained. Humans below the 200-chip
  participation threshold sit out and explicitly request a 20,000-chip rebuy.
  Multiplayer no longer automatically replenishes human stacks below 400.
- Rebuys are queued until the next hand in both modes; an all-in player cannot
  top up before settlement. Duplicate requests cannot add repeated buy-ins.
- Busted seats are skipped for blinds/action order, including heads-up ordering.
  Posting the last chip as a blind sets all-in immediately.
- Multiplayer shows the same ten-second timer and rebuy flow and publishes the
  same net-win/rake messages as single player. Server actions remain authoritative.

Server-specific joining/disconnecting and hidden-card masking are retained.
Browser-local training is not a shared online training service. The server does
not run continuous self-play training.

Validation: 37 rule/server regressions, scoped server typecheck, changed client
ESLint, Next.js production build, an actual single-player hook simulation of
bluff reveal and queued rebuy, and the hosted two-client smoke test.

A production deploy resets the in-memory room and its stacks. `/health` exposes
`rulesVersion` to identify the deployed common-rule revision.
