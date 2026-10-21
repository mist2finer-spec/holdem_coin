#!/usr/bin/env node
/**
 * holdem_coin :: UI-Only Validation Pipeline
 * ─────────────────────────────────────────────────────────────────────────
 * Performs ONLY two checks:
 *   1) Frontend build error check   (npm run build:ui || npm run build)
 *   2) CSS / Tailwind style sanity   (directives, config scope, dup selectors)
 *
 * Strictly NEVER runs:
 *   - Backend simulations (e.g. 20-hand bot validation)
 *   - Database / socket / wallet integration tests
 *   - Anything under src/server/ or src/lib/poker-* / src/lib/game/
 *
 * Exit codes:
 *   0  →  all checks passed
 *   1  →  one or more checks failed (last 15 lines of error log printed to stderr)
 *
 * Usage:
 *   node scripts/validate_ui.mjs
 *   npm run validate:ui
 * ─────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const TAIL = 15;                                  // last N lines of error log
const BUILD_TIMEOUT_MS = 180_000;                 // 3 min hard cap
const ERR_LOG = join(tmpdir(), `holdem_ui_validate_${process.pid}.log`);

// ── logging helpers ──────────────────────────────────────────────────────────
function log(msg)  { process.stderr.write(`[validate_ui] ${msg}\n`); }
function warn(msg) { process.stderr.write(`[validate_ui] WARN: ${msg}\n`); }

/**
 * Capture an error buffer, write full log to ERR_LOG, print last 15 lines,
 * and exit(1).
 */
function fail(label, errOrStderr) {
  const raw =
    typeof errOrStderr === 'string'
      ? errOrStderr
      : errOrStderr?.stderr?.toString?.()
        || errOrStderr?.stdout?.toString?.()
        || errOrStderr?.message
        || String(errOrStderr);

  writeFileSync(ERR_LOG, raw);
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const tail  = lines.slice(-TAIL).join('\n');

  console.error(`\n❌ ${label} FAILED — last ${TAIL} lines of error log:\n`);
  console.error(tail || '(no output captured)');
  console.error(`\nFull log: ${ERR_LOG}`);
  process.exit(1);
}

/**
 * Run a shell command synchronously, capturing output. Fail-fast on non-zero.
 */
function run(cmd, { label, timeoutMs = BUILD_TIMEOUT_MS, env = {} } = {}) {
  log(`${label}: ${cmd}`);
  const r = spawnSync(cmd, {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: timeoutMs,
  });
  if (r.error || r.status !== 0) {
    fail(label, r.stderr || r.stdout || r.error || `(no output, status=${r.status})`);
  }
  return r.stdout;
}

// ── 1. Frontend build ───────────────────────────────────────────────────────
function pickBuildScript(scripts) {
  if (scripts['build:ui']) return 'build:ui';
  if (scripts['build'])    return 'build';
  return null;
}

function runFrontendBuild() {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) fail('frontend-build', 'package.json not found in project root');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const key = pickBuildScript(scripts);
  if (!key) fail('frontend-build', 'No "build" or "build:ui" script declared in package.json');

  // CI=true so warnings don't accidentally fail the build; bump node memory.
  run(`npm run ${key}`, {
    label: `frontend-build (${key})`,
    env: { CI: 'true', NODE_OPTIONS: '--max-old-space-size=4096' },
  });
}

// ── 2. Style sanity checks ──────────────────────────────────────────────────
function walkCss(dir, out = []) {
  if (!existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build') continue;
      walkCss(join(dir, e.name), out);
    } else if (e.name.endsWith('.css')) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

function allCssFiles() {
  const out = [];
  walkCss(join(ROOT, 'styles'),    out);
  walkCss(join(ROOT, 'src', 'ui'),  out);
  walkCss(join(ROOT, 'public'),     out);
  return out;
}

/** 2-a. Tailwind directives present (or @import "tailwindcss") where referenced */
function checkTailwindDirectives(cssFiles) {
  if (cssFiles.length === 0) return; // nothing to check
  for (const f of cssFiles) {
    const txt = readFileSync(f, 'utf8');
    const hasDirectives = /@tailwind\s+(base|components|utilities)/.test(txt);
    const hasImport     = /@import\s+["']tailwindcss/.test(txt);
    const mentionsTw    = /tailwind/i.test(txt);

    if (mentionsTw && !hasDirectives && !hasImport) {
      fail('tailwind-directives',
        `${relative(ROOT, f)}: references "tailwind" but is missing ` +
        `@tailwind base|components|utilities directives (or @import "tailwindcss").`);
    }
  }
}

/** 2-b. Duplicate top-level class/id selectors (conflict detection) */
function checkDuplicateSelectors(cssFiles) {
  const seen = new Map(); // selector -> first file
  let dups = 0;
  const re = /^([.#][\w-]+)\s*\{?/gm;
  for (const f of cssFiles) {
    const txt = readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(txt))) {
      const sel = m[1];
      if (seen.has(sel)) {
        dups++;
        warn(`duplicate selector "${sel}" in ${relative(ROOT, f)} ` +
             `(first seen in ${relative(ROOT, seen.get(sel))})`);
      } else {
        seen.set(sel, f);
      }
    }
  }
  // Duplicates are warnings, not hard failures — they don't fail the build.
  // Re-enable as a hard failure by uncommenting the next 3 lines if desired:
  // if (dups > 0) {
  //   fail('duplicate-selectors', `${dups} duplicate selector(s) detected — see warnings above.`);
  // }
}

/** 2-c. tailwind.config.* content globs include src/ui (else purge silently strips classes) */
function checkTailwindConfigScope() {
  const cands = [
    'tailwind.config.js', 'tailwind.config.ts',
    'tailwind.config.cjs', 'tailwind.config.mjs',
  ];
  const cfg = cands.find(c => existsSync(join(ROOT, c)));
  if (!cfg) return; // project may not use Tailwind — skip
  const txt = readFileSync(join(ROOT, cfg), 'utf8');
  // Look for "src/ui" anywhere in the content array
  if (!/src\/ui/.test(txt)) {
    fail('tailwind-config',
      `${cfg}: "content" globs do not include "src/ui" — ` +
      `Tailwind will purge classes used by UI components and silently break styles.`);
  }
}

/** 2-d. Orphan `@apply` with unknown class (light heuristic) */
function checkOrphanApply(cssFiles) {
  // Tailwind 3+ allows arbitrary values; we only flag obvious typos like
  // `@apply text-rea-500` (clearly meant `text-red-500`).
  const knownTwPrefixes = [
    'text-','bg-','border-','flex','grid','block','inline','hidden','w-','h-',
    'p-','px-','py-','m-','mx-','my-','rounded-','shadow-','font-','leading-',
    'tracking-','gap-','space-','justify-','items-','absolute','relative','fixed',
  ];
  for (const f of cssFiles) {
    const txt = readFileSync(f, 'utf8');
    const re = /@apply\s+([^;]+);/g;
    let m;
    while ((m = re.exec(txt))) {
      const classes = m[1].trim().split(/\s+/);
      for (const cls of classes) {
        if (cls.startsWith('!')) cls = cls.slice(1);
        const base = cls.replace(/^(.+?)-.*/, '$1');
        // Heuristic: if the prefix part doesn't match any known Tw prefix AND
        // the class contains a hyphen, flag it.
        if (cls.includes('-') && !knownTwPrefixes.includes(base + '-') && !knownTwPrefixes.includes(base)) {
          warn(`possible orphan @apply class "${cls}" in ${relative(ROOT, f)}`);
        }
      }
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  log(`root=${ROOT}`);
  log(`error log (on failure): ${ERR_LOG}`);

  // ── 1. Frontend build (catches syntax / TS / import errors) ───────────────
  runFrontendBuild();

  // ── 2. CSS / Tailwind style sanity ────────────────────────────────────────
  const cssFiles = allCssFiles();
  log(`found ${cssFiles.length} CSS file(s) to inspect`);
  checkTailwindDirectives(cssFiles);
  checkTailwindConfigScope();
  checkOrphanApply(cssFiles);
  checkDuplicateSelectors(cssFiles);

  log('✓ all UI checks passed');
  process.exit(0);
}

try {
  main();
} catch (e) {
  fail('uncaught', e);
}
