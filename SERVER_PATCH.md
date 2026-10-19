# Poker server patch 1.0.1

This patch fixes the first spectator render, server startup, per-player state,
action validation and side-pot settlement. It restores the live policy decision
path without running background self-play training in the server.

## Start and verify

From the repository root:

```bash
npm ci --prefix mini-services/poker-server
npm start --prefix mini-services/poker-server
```

Run the existing Next.js application separately. In the Z.ai environment, use
the existing full-stack launcher/redeploy so the web application, mini-service
and Caddy configuration are loaded together. Do not start a second server or
second restart loop while one is running. `start.sh` remains in the foreground
and does not kill processes holding a port; the hosting service owns restarts.
A port conflict fails with a nonzero exit instead of silently connecting users
to a stale instance. `POKER_PORT` defaults to 3003.

```bash
curl --max-time 5 'http://127.0.0.1:3003/health'
curl --max-time 5 'http://127.0.0.1:81/health?XTransformPort=3003'
curl --max-time 5 'http://127.0.0.1:81/socket.io/?EIO=4&transport=polling&XTransformPort=3003'
```

The health endpoints return JSON. A Socket.IO handshake starts with `0{"sid":`.
If direct port 3003 works but port 81 fails, inspect the running Caddy config.
If both internal requests work but the public URL returns 502, inspect the
hosting platform's upstream routing. A GitHub source update alone does not
prove that an already running preview has redeployed.

## Tests

```bash
npm test --prefix mini-services/poker-server
node scripts/test-server-smoke.mjs
```

The smoke test starts the real startup script on port 13003, joins two clients,
checks duplicate JOIN_ROOM handling, hidden opponent cards, stable seats and
three observed hand numbers, then terminates its own server. It does not kill
unrelated processes. It requires the service's development dependencies.

## Settlement and blind defence

Folded contributions are included at each contribution level; folded players
are never eligible to win a pot. The regression suite calls the actual room
methods, including payout and chip conservation, rather than copying their
implementation into a test.

SB/BB defence can override a policy fold with a 50% call chance against a
limped pot or one 2–3BB open, only preflop. It excludes reraises, all-in calls,
call costs above 10% of the remaining stack, and raw-equity deficits above 0.10
relative to pot odds. It does not mean that every blind hand calls 50% overall.

## Deployment limit

The source patch cannot inspect or restart the separate Z.ai hosting account.
After deploying it, verify the public handshake and two browser clients. Do not
classify an HTTP 502 or browser render exception as a proven runtime segfault.
