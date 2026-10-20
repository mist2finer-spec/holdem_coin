# Server hand history (rules 1.10.0)

The server records every new dealt hand, including CPU-only tables. Participant
counts are frozen at the deal: waiting spectators are not counted as human
participants. IDs combine a server session UUID with the hand number, avoiding
collisions after restarts. Historical rules version and source revision accompany
every hand. Previously played hands cannot be reconstructed retrospectively.

## Recorded data

- Physical seat IDs, names, human/CPU flag, initial chips, BTN/SB/BB positions.
- Actual forced blind payments, including a short all-in blind.
- Street transitions and boards, even when all-ins run out without further bets.
- Ordered actions, timestamps, human/CPU/pre-action/timeout/disconnect source.
- Requested betting amount, actual chips paid, call due, pot and stack before/after,
  current street contribution, raise level, alive/all-in counts before/after,
  and decision latency. A raise amount is a total street target; `paid` is the
  incremental cost. All-in amount is the actual remaining stack.
- Pot layers, winners, rake, uncalled refunds, payouts and net profit.
- Private CPU audit: final per-hand personality values, OOP/effective-stack
  context, original-opener/limper/check history flags, decision path, bluff flag,
  proposed action and whether legality normalization rejected it. Path names
  include preflop-plan, small-open-ev, three-bet-ev, trainer and blind-defense.
  Auditing does not run additional equity simulations or alter decisions.

An aborted hand records contributed-chip refunds, zero rake and an aborted flag;
it does not mark private cards as revealed. An abruptly killed process can lose
the active incomplete hand; completed hands are the unit of the archive.

## Downloads

Server mode has **JSON 저장**, **CSV**, and **관리자 분석** buttons. Standard
JSON/CSV include public actions/results and the requesting player's own cards
when that player identity matches. Other cards appear only if actually revealed
at showdown or by a successful bluff reveal. Private player identifiers and CPU
audit details are stripped from regular events and exports. A reconnect creates
a new server player identity; already received hands remain in that browser's
cache without overwriting previously known cards with masked cards.

JSON preserves nested pot/street/action data. CSV uses one action per row plus a
RESULT/settlement row for each participant, including players who never acted.
Participant-count columns are `humans` and `cpus`; action source is `source`.
CSV quotes cells, includes a UTF-8 BOM and neutralizes spreadsheet formula names.

The administrator download requires `HAND_HISTORY_ADMIN_TOKEN` (at least 24
characters) from the service's Render **Environment** settings. The UI prompts
for it, sends it only in the Authorization header, and does not store it. The
same export is `GET /api/hand-history/admin` with `Authorization: Bearer <token>`.
Without a valid key it returns 401. It includes all private cards and CPU audit
for **completed/aborted archived** hands, never the active hand. Keep this export
private when sharing live table strategy information would matter.

## Retention and restart behavior

- Server: newest 1,000 hands, at most 16 MiB of serialized records.
- Disk: asynchronously replace `data/hand-history/hands.json` atomically after
  completed hands. One temporary file means transient disk use can approach
  32 MiB. File errors retain the bounded memory archive and are reported on
  ordinary download responses. The game loop does not wait for filesystem writes.
- Browser: IndexedDB cache per display name, newest 1,000 received/downloaded
  hands, at most 16 MiB. Browser clearing/private mode/storage limits can remove
  or prevent this cache; downloaded files are the user's explicit backup.
- The server reloads the file when restarting on the **same filesystem**.
  Render's current free service has ephemeral storage: redeploys, instance
  replacements or idle shutdowns may lose server files. Browser public records
  and explicit downloads are independent of server replacement. Download the
  admin archive before redeployment when private analysis data must be retained.
- `HAND_HISTORY_DIR` can point to an already mounted persistent disk. This patch
  does not provision a database/disk or change the service plan.

No raw Socket.IO objects, IP addresses, authentication tokens or socket IDs are
written into hand records. The archive path is ignored by git and is not exposed
by a static-file route.
