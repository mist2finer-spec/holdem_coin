# Rake / net-profit / all-in patch 1.1.0

Base: `3938b37a24e081a1eadf60d59df365f7582a4b50`.
Applies to both local single-player and the Socket.IO server. No live deployment
or remote GitHub write is performed by distributing this patch.

## Rules

- Charge 5% once on each contested main/side pot at hand settlement, including
  preflop fold wins. No cap and no no-flop-no-drop exemption.
- Integer chips: floor each pot's rake. The rake leaves the game economy.
- Return uncalled excess before rake. A refund is not a win and is never taxed.
- Include folded contributions at their correct pot levels. Split net pots and
  award odd chips clockwise from the first seat after the button.
- Stack credit is payout = award + refund. Display net profit = payout minus
  the player's complete hand contribution, never add opponent bets again.
  A split-pot winner can display a negative net profit because of rake.
- No betting when at most one surviving player has chips and that player has
  matched the outstanding bet. An unmatched covering player still calls/folds.
- Two or more players with chips may continue to bet into side pots.
- Deal remaining streets as FLOP(3), TURN(1), RIVER(1), with one burn per street.

## AI and training

The shared AI uses 48 deterministic uniform-opponent rollout samples based only
on its own cards and the public board. Cache is bounded to 256 entries. It is an
approximate equity estimator, not a GTO solver or an opponent-range model.
Called-action EV includes rake, each opponent's public stack/contribution,
eligible side pots and uncalled refunds. Negative called EV reduces aggressive
anchor logits, particularly oversized all-ins. This does not establish that the
new policy outperforms a benchmark; no win-rate claim is made.

The browser self-play simulator now uses the same raked side-pot settlement,
split-pot rewards, contribution accounting and locked-betting rule. Old browser
weights are reset using versioned v4_rake05 localStorage keys. Server background
training remains disabled. Self-play's four-action network remains separate
from the live five-action mixed anchor/equity policy.

The single-player view publishes immutable render snapshots from its existing
imperative loop. React compiler immutability lint is scoped off for this legacy
hook; the mutable trainer and cross-referencing post-render callbacks remain.

## Apply

From a clean checkout at the base commit, after downloading the patch:

```bash
git am /path/to/holdem_coin_rake_allin_1.1.0.patch
npm ci --prefix mini-services/poker-server
npm test --prefix mini-services/poker-server
npm run typecheck --prefix mini-services/poker-server
node scripts/test-server-smoke.mjs
```

Use the existing frontend dependency installation, then `npm run build`.
Restart/redeploy both the web application and poker mini-service together so the
new result DTO and banners match. Do not apply the earlier 1.0.1 patch again;
it is already included in this base. With later upstream changes, use a branch
and resolve conflicts instead of force-overwriting newer code.

## Optional PokerKit reference

PokerKit is used as an independent Python rules/settlement reference, not a
mandatory browser dependency or a pre-trained CPU opponent.

```bash
python -m pip install -r scripts/pokerkit/requirements.txt
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/export-pokerkit-fixtures.ts > pokerkit-fixtures.json
python scripts/pokerkit/verify_settlement.py < pokerkit-fixtures.json
```

This checks four full PokerKit all-in games, including unequal stacks, side
pots and uncalled returns, against the production TypeScript settlement's
stacks and net profits. Gameplay works without Python or PokerKit installed.
