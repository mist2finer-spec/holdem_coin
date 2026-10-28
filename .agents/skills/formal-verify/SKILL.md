---
name: formal-verify
description: Selectively verify high-risk concurrency, cancellation, restart, duplicate execution, protocol or mathematical invariants when ordinary tests are insufficient. Never run by default for UI, styling, documentation or adequately tested changes. Apply the repository AGENTS.md policy first.
---

# Selective formal verification

Read the repository's AGENTS.md policy first. Assess real risk and the adequacy of existing unit, integration and regression tests. Record a short reason when skipping. Do not generate a model merely because a state-related file changed.

When justified, run `npm run formal:setup` from the project root to prepare the pinned upstream skill, then read `.tools/agent-formal-verify/skills/formal-verify/SKILL.md` and the relevant reference in full. The upstream source and revision are recorded in `scripts/formal-verify-source.json`.

Use upstream TLA+/TLC helpers for ordering/state conflicts and Lean 4 helpers for mathematical invariants. Reuse existing models; map states and actions to actual code; state assumptions and bounds; test relevant mutations and reproduce reachable counterexamples in production-code tests. Keep ordinary tests and defensive code.

Use `npm run formal:doctor -- --tool tla` or `--tool lean` before checking. If unavailable, report NOT CHECKED with the remedy. Tool readiness, smoke tests and bounded model results never establish whole-program correctness. Follow `docs/verification/README.md` for scoped reports. Analysis-only requests do not authorize production-code fixes.
