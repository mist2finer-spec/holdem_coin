import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { assert, repository, trustedLogins, roles, validateTask, validateDelivery, reduceTask,
  digest, bytesHash, filePath, envelope } from './protocol.mjs';
import { githubClient } from './github.mjs';

export async function verifyDelivery(api, task, delivery) {
  validateDelivery(task, delivery);
  await api.descendant(task.base_sha, delivery.commit);
  for (const artifact of delivery.artifacts)
    assert(await api.artifact(delivery.commit, artifact.path) === artifact.sha256, `Artifact hash mismatch: ${artifact.path}`);
}
export function taskService(api) {
  const cache = new Map();
  async function load(id, trail = []) {
    assert(Number.isSafeInteger(id) && id > 0, 'Positive issue number required');
    assert(!trail.includes(id) && trail.length < 16, 'Dependency cycle/depth limit');
    if (cache.has(id)) return cache.get(id);
    const issue = await api.issue(id);
    const comments = await api.comments(id);
    assert(comments.length >= (issue.comments ?? 0), 'Incomplete/stale comment stream; retry a fresh read');
    const state = reduceTask(issue, comments);
    state.effective_status = state.status;
    state.blockers = [];
    for (const dependency of state.task.depends_on) {
      const dep = await load(dependency, [...trail, id]);
      const pinned = state.dependency_receipts.find(d => d.issue === dependency);
      if (dep.effective_status !== 'ACCEPTED' || (state.status !== 'OPEN' && pinned?.receipt !== dep.receipt))
        state.blockers.push({ issue: dependency, status: dep.effective_status, reason: 'Dependency not accepted or receipt changed' });
    }
    if (state.blockers.length) state.effective_status = 'BLOCKED_DEPENDENCY';
    if (state.delivery && ['DELIVERED', 'ACCEPTED'].includes(state.status)) await verifyDelivery(api, state.task, state.delivery);
    cache.set(id, state); return state;
  }
  async function prepare(id, input) {
    const state = await load(id);
    const event = { ...input, schema: 1, issue: id, id: input.id ?? randomUUID(),
      task_digest: state.packet_digest, expected_version: input.expected_version ?? state.version };
    assert(trustedLogins.includes(event.login), 'Use a configured GitHub writer identity');
    if (['CLAIM', 'RESUME', 'DELIVER', 'ACCEPT'].includes(event.type)) {
      event.dependencies = [];
      for (const dependency of state.task.depends_on) {
        const dep = await load(dependency);
        assert(dep.effective_status === 'ACCEPTED', `Dependency #${dependency} is not accepted`);
        event.dependencies.push({ issue: dependency, receipt: dep.receipt });
      }
      // A changed dependency requires another delivery/review. Acceptance cannot silently refresh it.
      if (event.type === 'ACCEPT') assert(digest(event.dependencies) === digest(state.dependency_receipts), 'Dependencies changed after delivery; request changes first');
    }
    if (event.type === 'DELIVER') await verifyDelivery(api, state.task, event.delivery);
    if (event.type === 'ACCEPT') {
      event.delivery_digest ??= state.delivery_digest;
      await verifyDelivery(api, state.task, state.delivery);
    }
    // Re-read before preparing; if another writer changed the stream, the version check rejects this packet.
    const issue = await api.issue(id), comments = await api.comments(id);
    assert(comments.length >= (issue.comments ?? 0), 'Incomplete/stale comment stream; retry a fresh read');
    const candidate = { id: Math.max(0, ...comments.map(c => c.id)) + 1, user: { login: event.login },
      created_at: 'candidate', updated_at: 'candidate', body: envelope('event', event) };
    const after = reduceTask(issue, [...comments, candidate]);
    assert(after.applied.includes(event.id) && !after.rejected.some(r => r.comment === candidate.id),
      after.rejected.find(r => r.comment === candidate.id)?.reason ?? 'Event rejected');
    return { event, body: envelope('event', event), before: state.version, after: after.status };
  }
  return { load, prepare };
}

export async function inbox(role, { api = githubClient(), offset = 0 } = {}) {
  assert(roles.includes(role), 'Unknown role');
  assert(Number.isSafeInteger(offset) && offset >= 0, 'Invalid offset');
  const candidates = (await api.issues()).filter(issue => !issue.pull_request && issue.title.startsWith('[agent-task:'));
  const service = taskService(api), pending = [], errors = [];
  for (const issue of candidates) {
    try {
      // Issue body is small routing metadata. Full histories stay in the tool, never in the context pack.
      const raw = reduceTask(issue, []);
      if (![raw.task.from, raw.task.to, raw.task.reviewer].includes(role)) continue;
      const state = await service.load(issue.number);
      if (state.effective_status === 'ACCEPTED') continue;
      pending.push({ issue: issue.number, url: issue.html_url, status: state.effective_status, version: state.version,
        goal: state.task.goal.slice(0, 180), from: state.task.from, to: state.task.to, reviewer: state.task.reviewer,
        owner: state.owner?.instance ?? null, branch: state.task.branch, base_sha: state.task.base_sha,
        summary: state.checkpoint?.summary.slice(0, 250) ?? 'Awaiting CLAIM/ACK',
        next_step: state.checkpoint?.next_step?.slice(0, 180) ?? null, github_state: state.github_state,
        rejected_events: state.rejected.length, blockers: state.blockers.map(b => b.issue) });
    } catch (error) { errors.push({ issue: issue.number, reason: error.message.slice(0, 250) }); }
  }
  pending.sort((a, b) => a.issue - b.issue);
  const result = { result: errors.length ? 'UNAVAILABLE' : 'PASS', role, total_pending: pending.length,
    items: pending.slice(offset, offset + 3), next_offset: pending.length > offset + 3 ? offset + 3 : null,
    errors: errors.slice(0, 3), error_count: errors.length };
  // Korean/Unicode summaries can fill the byte budget before the item limit.
  while (Buffer.byteLength(JSON.stringify(result)) > 4096 && result.items.length > 1) result.items.pop();
  while (Buffer.byteLength(JSON.stringify(result)) > 4096 && result.errors.length > 1) result.errors.pop();
  result.next_offset = pending.length > offset + result.items.length ? offset + result.items.length : null;
  assert(Buffer.byteLength(JSON.stringify(result)) <= 4096, 'Inbox summary exceeds 4KiB');
  return result;
}

const jsonFile = path => JSON.parse(readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, ''));
export async function main(args) {
  const api = githubClient(), service = taskService(api);
  const [command, first, second] = args;
  switch (command) {
    case 'init': case 'create': {
      const task = validateTask(jsonFile(first));
      const packet = { title: `[agent-task:${task.to}] ${task.goal}`, body: envelope('task', task) };
      return command === 'init' ? packet : await api.create(packet);
    }
    case 'inbox': return inbox(first, { api, offset: second ? Number(second) : 0 });
    case 'show': case 'verify': {
      const state = await service.load(Number(first));
      return { ...state, applied: undefined, result: state.blockers.length ? 'BLOCKED' : 'PASS' };
    }
    case 'prepare': case 'send': {
      const id = Number(first), prepared = await service.prepare(id, jsonFile(second));
      if (command === 'prepare') return prepared;
      const comment = await api.comment(id, prepared.body);
      const actual = await taskService(api).load(id);
      assert(actual.applied.includes(prepared.event.id), `Command was rejected: inspect #${id}, comment ${comment.id}; do not start work`);
      return { result: 'PASS', issue: id, comment: comment.html_url, status: actual.effective_status, version: actual.version };
    }
    case 'manifest': {
      assert(/^[0-9a-f]{40}$/.test(first ?? '') && args.length > 2, 'manifest needs a full commit SHA and paths');
      const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
      return args.slice(2).map(path => {
        assert(filePath(path), 'Invalid artifact path');
        const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, 'show', `${first}:${path}`],
          { timeout: 15000, maxBuffer: 1024 * 1024 });
        assert(result.status === 0 && result.stdout?.length, `Cannot read committed artifact: ${path}`);
        return { path, sha256: bytesHash(result.stdout) };
      });
    }
    default: throw new Error('Usage: tasks.mjs inbox ROLE [OFFSET] | show/verify ISSUE | init/create TASK.json | prepare/send ISSUE EVENT.json | manifest SHA PATH...');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await main(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (result.result === 'UNAVAILABLE' || result.result === 'BLOCKED') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ result: 'UNAVAILABLE', error: error.message })); process.exitCode = 1;
  }
}
