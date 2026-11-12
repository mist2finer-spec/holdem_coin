import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const roles = ['director', 'tech-director', 'design-lead', 'art-lead', 'qa-release-lead',
  'gameplay-dev', 'network-server-dev', 'ui-ux-dev', 'systems-level-designer',
  'technical-artist', 'tools-perf-engineer', 'qa-tester', 'reverse_eng_designer'];
const limit = 12 * 1024;
const common = ['AGENTS.md', 'docs/agents/CURRENT.md'];
const unityRules = 'unity/IslandGame/AGENTS.md';
const read = path => readFileSync(resolve(root, path), 'utf8');
const packPaths = (role, unity) => [...common, `.agents/roles/${role}.md`, ...(unity ? [unityRules] : [])];
const pack = (role, unity) => packPaths(role, unity).map(path => `FILE: ${path}\n${read(path).trim()}\n`).join('\n');

function check() {
  const errors = [];
  const sizes = roles.map(role => {
    const bytes = Buffer.byteLength(pack(role, false));
    const unityBytes = Buffer.byteLength(pack(role, true));
    if (unityBytes > limit) errors.push(`${role}: ${unityBytes} bytes exceeds ${limit}`);
    if (!read(`.agents/roles/${role}.md`).startsWith(`# ${role}\n`)) errors.push(`${role}: wrong role title`);
    return { role, bytes, unityBytes };
  });
  const docs = [...new Set([...common, unityRules, 'README.md', 'CODEX.md',
    'docs/agents/README.md', 'docs/agents/HANDOFF.md', 'docs/agents/WORK_RULES.md',
    'docs/agents/REFERENCES.md', ...roles.map(role => `.agents/roles/${role}.md`)])];
  const targets = new Map();
  for (const path of docs) {
    for (const match of read(path).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^(https?:|mailto:)/.test(link)) continue;
      const target = relative(root, resolve(root, dirname(path), decodeURIComponent(link))).split(sep).join('/');
      if (target.startsWith('../') || target === '..') errors.push(`${path}: link escapes repository: ${link}`);
      else if (!existsSync(resolve(root, target))) targets.set(target, path);
    }
  }
  // Sparse checkouts omit source files; check only referenced paths in Git objects.
  const missing = [...targets.keys()];
  const refs = ['HEAD'];
  if (missing.length) {
    const requests = missing.flatMap(path => refs.map(ref => `${ref}:${path}`));
    const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root,
      'cat-file', '--batch-check=%(objecttype)'], { input: requests.join('\n') + '\n', encoding: 'utf8', timeout: 15000 });
    if (result.status !== 0) errors.push(`Git path check failed: ${result.error?.message ?? result.stderr.trim()}`);
    else {
      const output = result.stdout.trim().split(/\r?\n/);
      missing.forEach((path, index) => {
        if (!output.slice(index * refs.length, (index + 1) * refs.length).some(value => /^(blob|tree)$/.test(value)))
          errors.push(`${targets.get(path)}: missing link target ${path}`);
      });
    }
  }
  console.log(JSON.stringify({ result: errors.length ? 'FAIL' : 'PASS', roleCount: roles.length,
    limitBytes: limit, sourceRefs: refs, sizes, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--list') console.log(roles.join('\n'));
  else if (args.length === 1 && args[0] === '--check') check();
  else if (roles.includes(args[0]) && (args.length === 1 || (args.length === 2 && args[1] === '--unity'))) {
    const content = pack(args[0], args[1] === '--unity');
    if (Buffer.byteLength(content) > limit) throw new Error(`Context exceeds ${limit} bytes; shorten its documents.`);
    process.stdout.write(content);
  } else {
    console.error('Usage: node scripts/agents/context.mjs <role> [--unity] | --list | --check');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
