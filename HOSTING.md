# Deploy the complete game on a Node.js host

The web UI and live multiplayer room share one public origin. The existing
Socket.IO protocol and poker rules are unchanged. No Z.ai reverse proxy is needed.

## Render

Use `render.yaml` from the repository root. It declares one free Node web service.
Connect the GitHub repository to Render and deploy its `main` branch. The service's
actual HTTPS URL is assigned by Render; do not assume a hostname before creation.

The build installs the web and game dependencies and builds the existing Next.js
standalone application. `node scripts/start-hosted.mjs` launches both processes
and forwards `/socket.io/` and `/health` to the game server. Other requests go to
Next.js. `/healthz` returns 200 only when both services respond successfully.

The public listener binds `0.0.0.0:$PORT` (8080 locally). Internal defaults are
3000 for Next.js and 3003 for poker. `HOLDEM_WEB_PORT` and `POKER_PORT` may override
these; all three ports must differ. The current browser client uses same-origin
polling on hosted URLs and remains compatible with the older Z.ai query parameter.

The launcher terminates both children if either exits. Let Render supervise the
launcher. It disables the optional hourly game-process restart using
`POKER_RESTART_INTERVAL_MS=0`; older startup commands retain their previous default.

Keep one instance. Room state and stacks are in memory and reset on restart or
deployment. Horizontal scaling requires shared room ownership before it is safe.
Server-side self-play training remains disabled and this launcher does not create
growing log or training files.

Render's free services sleep after idle periods, so this configuration is suitable
for a playable prototype, not a guarantee of uninterrupted 24-hour operation.
See <https://render.com/docs/free>. No paid plan is selected by this configuration.

## Local production verification

```bash
npm install --legacy-peer-deps
npm ci --prefix mini-services/poker-server --include=dev
npm run build
POKER_SMOKE_HOSTED=1 node scripts/test-server-smoke.mjs
```

The hosted smoke test starts the actual launcher, requests the page and a compiled
JavaScript asset, checks the combined health endpoint, and exercises two Socket.IO
clients through the public proxy. It checks seating, game progression, and card
privacy including intentional successful-bluff reveals.
