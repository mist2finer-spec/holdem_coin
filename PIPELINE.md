# Local automatic patch pipeline

## Bootstrap

Requires Node 22+ and Git. Python/aider are not required. `npm run ai-bootstrap`
installs locked npm dependencies only if TypeScript/tsx are missing; the agent uses
Node fetch, TypeScript AST context extraction, and node:test (no extra SDK).

Copy only the missing settings from `.env.example` to your ignored `.env`:
one API key, `AI_PROVIDER` (openai/anthropic/gemini), and `AI_MODEL` supported by
that account. ChatGPT subscription/authentication is not an API credential.
Configure Git's credential helper or an ignored `GITHUB_TOKEN` with repository
write access. Tokens are never printed or committed. No model name is guessed.

```sh
npm run ai-bootstrap
npm run ai-task -- --dry-run "Verify Dry-Run"
npm run ai-task -- --target 'src/lib/poker-live.ts#decideLiveBot' "Requested change"
npm run validate:holdem
npm run ai-web
```

Targets can repeat (function/method/variable symbol after `#`). Without a target,
a code path in the task is selected; otherwise `decideLiveBot` is the default.
At most 16,000 source-context characters plus 5,000 path-map characters are sent.
Large functions require a smaller target. New files/config/dependencies/pipeline
files cannot be modified by the generated patch; use a reviewed change for those.
The LLM must return exact unique SEARCH/REPLACE blocks, not entire rewritten files.

## Execution and failure behavior

Normal runs require a clean checkout, expected origin, and credentials. The worker
fetches main, creates a separate worktree/branch from origin/main, and links existing
node_modules. It validates with secrets removed from child environments. It stages
only that isolated worktree (`git add -A`), commits `auto: <task>`, and performs a
normal fast-forward push to main. Concurrent remote changes cause a push failure,
never a force push. The original checkout is not reset or merged automatically;
fetch/pull it when ready. Concurrent local workers are locked. A failed task retains
its recovery branch; no commit is made for an invalid patch. A push failure retains
the already validated commit. No automatic deployment is triggered by this worker
beyond the repository's existing auto-deploy settings.

At most three model calls: initial patch and two repairs. Repair requests include
only the preceding diff and the last 15 error lines. Validation uses no LLM calls:
TypeScript syntax/import/type checks for application entry points and server,
existing regressions, and 20 real eight-seat CPU hands with sleep delays removed.
The parent process enforces a five-second deadline per hand even when JavaScript
is synchronously stuck. Tests check finite pot/odds, nonnegative integer chips,
hand completion, and duplicate join/disconnect during active play. Eight-seat
simulation runs even while public eight-seat entry is Under Repair.
The validator emits exactly `VALIDATION_PASSED` on success; on failure it emits
only the final 15 diagnostic lines and exits 1. Simulation/regression game logs
are buffered and discarded on success. This is regression coverage, not proof of
all possible poker states or a security sandbox.

## Authenticated local web interface

The receiver binds **127.0.0.1:8787** only. `.env` needs a random
`AUTO_PIPELINE_WEB_TOKEN` of at least 32 characters. It is separate from game admin
and LLM tokens. A local token was generated during initial setup without printing it.
This endpoint executes trusted-owner coding requests; do not expose it publicly.
Run untrusted generated code in an OS/container sandbox on a dedicated runner.
The local worktree boundary is not an OS security boundary.

POST `/tasks`, header `Authorization: Bearer <AUTO_PIPELINE_WEB_TOKEN>`, body:

```json
{"command":"Verify Dry-Run","dryRun":true}
```

Real task:

```json
{"command":"Your change","targets":["src/lib/poker-live.ts#decideLiveBot"]}
```

Response 202 gives `id`; GET `/tasks/<id>` with the same authorization returns
running/passed/failed and exitCode. Only one job runs at a time (409 otherwise).
Job metadata is bounded to 100 in memory; source, prompts, keys and logs are not
returned over HTTP. No CORS allowance or game-site integration is installed.

## Tests / known bootstrap limits

`node --test scripts/pipeline/test-core.mjs` tests strict patch application.
`node scripts/pipeline/test-web.mjs` tests rejection without auth and a real
HTTP -> CLI dry run -> 20-hand validation roundtrip. Dry run never calls an LLM,
commits, or pushes. Missing API keys deliberately block real patch requests.
A successful dry run therefore does not claim API access or an AI-generated patch
has been exercised. Supply API configuration to activate the real patch stage.
