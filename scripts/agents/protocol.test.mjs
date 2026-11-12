import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceTask, envelope, digest, bytesHash, validateTask } from './protocol.mjs';
import { taskService, inbox, verifyDelivery } from './tasks.mjs';
import { githubClient } from './github.mjs';

const sha = 'a'.repeat(40), resultSha = 'b'.repeat(40), artifact = 'docs/agents/evidence/result.md';
const task = { schema: 1, from: 'tech-director', to: 'tools-perf-engineer', reviewer: 'qa-tester',
  goal: 'Verify delivery', scope: 'Protocol only', branch: 'main', base_sha: sha,
  paths: ['scripts/agents/tasks.mjs'], acceptance: ['Receipts are reproducible'],
  expected_artifacts: [artifact], depends_on: [], sources: [] };
const issue = (number = 10, packet = task) => ({ number, title: `[agent-task:${packet.to}] ${packet.goal}`,
  body: envelope('task', packet), user: { login: 'mist2finer-spec' }, state: 'open', html_url: `https://github.com/test/repo/issues/${number}` });
const delivery = { commit: resultSha, summary: 'Implemented', artifacts: [{ path: artifact, sha256: bytesHash('evidence') }],
  validation: 'Protocol regressions passed', limitations: 'No art quality review' };
const event = (type, version, extra = {}, packet = task) => ({ schema: 1, issue: 10, id: `event-${type}-${version}`, type,
  login: 'mist2finer-spec', role: 'tools-perf-engineer', instance: 'worker-1', summary: type,
  task_digest: digest(packet), expected_version: version, dependencies: [], ...extra });
const comment = (id, packet) => ({ id, body: envelope('event', packet), user: { login: packet.login },
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z' });
const claim = event('CLAIM', 0, { checkout: { branch: 'main', sha } });
const deliver = event('DELIVER', 1, { delivery });
const accept = event('ACCEPT', 2, { role: 'qa-tester', instance: 'reviewer-1', delivery_digest: digest(delivery),
  checks: [{ criterion: 0, result: 'PASS', evidence: artifact }] });
const history = [comment(1, claim), comment(2, deliver), comment(3, accept)];
function mockApi(issues = [issue()], histories = new Map([[10, []]])) {
  return { issue: async id => { const found = issues.find(i => i.number === id); assert.ok(found); return found; },
    comments: async id => histories.get(id) ?? [], issues: async () => issues,
    artifact: async () => bytesHash('evidence'), descendant: async () => {} };
}

test('only an ACK, delivery and separate reviewer produce acceptance; restart replays same receipt', () => {
  const first = reduceTask(issue(), history), restart = reduceTask(issue(), [...history].reverse());
  assert.equal(first.status, 'ACCEPTED'); assert.equal(first.version, 3); assert.equal(first.receipt, restart.receipt);
});
test('concurrent claims: first comment ID wins, stale claim cannot take ownership', () => {
  const loser = event('CLAIM', 0, { ...claim, id: 'second', instance: 'worker-2' });
  const state = reduceTask(issue(), [comment(2, loser), comment(1, claim)]);
  assert.equal(state.owner.instance, 'worker-1'); assert.equal(state.rejected.length, 1);
});
test('delivery without receipt/claim is rejected', () => {
  const state = reduceTask(issue(), [comment(1, { ...deliver, expected_version: 0 })]);
  assert.equal(state.status, 'OPEN'); assert.match(state.rejected[0].reason, /ACK/);
});
test('same execution cannot self-accept by changing its role', () => {
  const state = reduceTask(issue(), [...history.slice(0, 2), comment(3, { ...accept, instance: 'worker-1' })]);
  assert.equal(state.status, 'DELIVERED'); assert.equal(state.rejected.length, 1);
});
test('stale review hash rejected even at current version', () => {
  const state = reduceTask(issue(), [...history.slice(0, 2), comment(3, { ...accept, delivery_digest: '0'.repeat(64) })]);
  assert.equal(state.status, 'DELIVERED');
});
test('every acceptance criterion must have evidence', () => {
  const state = reduceTask(issue(), [...history.slice(0, 2), comment(3, { ...accept, checks: [] })]);
  assert.equal(state.status, 'DELIVERED');
});
test('edited issue invalidates receipt instead of silently resetting state', () => {
  assert.throws(() => reduceTask(issue(10, { ...task, scope: 'changed' }), history), /body changed/);
});
test('edited protocol comment fails closed', () => {
  assert.throws(() => reduceTask(issue(), [{ ...history[0], updated_at: 'later' }]), /Edited/);
});
test('duplicate event is idempotent and recorded as rejected', () => {
  const state = reduceTask(issue(), [history[0], comment(5, claim)]);
  assert.equal(state.version, 1); assert.match(state.rejected[0].reason, /Duplicate/);
});
test('untrusted author cannot claim', () => {
  const state = reduceTask(issue(), [{ ...history[0], user: { login: 'stranger' } }]);
  assert.equal(state.status, 'OPEN');
});
test('wrong branch/base cannot claim', () => {
  const state = reduceTask(issue(), [comment(1, { ...claim, checkout: { branch: 'other', sha } })]);
  assert.equal(state.status, 'OPEN');
});
test('block checkpoint resumes without losing ownership', () => {
  const state = reduceTask(issue(), [history[0], comment(2, event('BLOCK', 1, { next_step: 'Wait for evidence' })),
    comment(3, event('RESUME', 2))]);
  assert.equal(state.status, 'CLAIMED'); assert.equal(state.owner.instance, 'worker-1');
});
test('release permits next instance to claim', () => {
  const state = reduceTask(issue(), [history[0], comment(2, event('RELEASE', 1)),
    comment(3, { ...claim, id: 'new-claim', expected_version: 2, instance: 'worker-2' })]);
  assert.equal(state.owner.instance, 'worker-2');
});
test('changes requested must be redelivered before acceptance', () => {
  const state = reduceTask(issue(), [...history.slice(0, 2), comment(3, event('REQUEST_CHANGES', 2, { role: 'qa-tester', instance: 'qa' })),
    comment(4, { ...accept, expected_version: 3 })]);
  assert.equal(state.status, 'CHANGES_REQUESTED');
});
test('reopening invalidates acceptance receipt', () => {
  const state = reduceTask(issue(), [...history, comment(4, event('REOPEN', 3, { role: 'tech-director' }))]);
  assert.equal(state.status, 'CHANGES_REQUESTED'); assert.equal(state.receipt, null);
});
test('local-only artifacts and malformed SHA are rejected', () => {
  assert.throws(() => validateTask({ ...task, expected_artifacts: ['G:/local/out.png'] }), /artifact/);
  assert.throws(() => validateTask({ ...task, sources: [{ summary: 'local', url: 'http://localhost:8188' }] }), /HTTPS/);
  assert.throws(() => validateTask({ ...task, base_sha: 'main' }), /SHA/);
});
test('missing file and hash mismatch prevent delivery verification', async () => {
  const api = mockApi(); api.artifact = async () => { throw new Error('404 missing artifact'); };
  await assert.rejects(verifyDelivery(api, task, delivery), /missing artifact/);
  api.artifact = async () => '0'.repeat(64);
  await assert.rejects(verifyDelivery(api, task, delivery), /hash mismatch/);
});
test('dependency must be accepted before preparing claim', async () => {
  const child = { ...task, depends_on: [10] };
  const api = mockApi([issue(), issue(11, child)]);
  await assert.rejects(taskService(api).prepare(11, { ...claim, task_digest: digest(child) }), /not accepted/);
});
test('dependency receipt change marks downstream task blocked', async () => {
  const parent = reduceTask(issue(), history);
  const child = { ...task, depends_on: [10] };
  const childClaim = { ...claim, issue: 11, task_digest: digest(child), dependencies: [{ issue: 10, receipt: parent.receipt }] };
  const histories = new Map([[10, history], [11, [comment(4, childClaim)]]]);
  const api = mockApi([issue(), issue(11, child)], histories);
  assert.equal((await taskService(api).load(11)).effective_status, 'CLAIMED');
  histories.set(10, [...history, comment(5, event('REOPEN', 3, { role: 'tech-director' }))]);
  assert.equal((await taskService(api).load(11)).effective_status, 'BLOCKED_DEPENDENCY');
});
test('dependency cycles fail instead of hanging', async () => {
  const api = mockApi([issue(10, { ...task, depends_on: [11] }), issue(11, { ...task, depends_on: [10] })]);
  await assert.rejects(taskService(api).load(10), /cycle/);
});
test('closed unaccepted work remains in inbox; only three summaries returned', async () => {
  const issues = Array.from({ length: 4 }, (_, i) => ({ ...issue(10 + i), state: 'closed' }));
  const result = await inbox(task.to, { api: mockApi(issues) });
  assert.equal(result.total_pending, 4); assert.equal(result.items.length, 3); assert.equal(result.next_offset, 3);
});
test('accepted work absent from pending inbox; sender can still find unacknowledged work', async () => {
  const api = mockApi([issue()], new Map([[10, history]]));
  assert.equal((await inbox(task.to, { api })).total_pending, 0);
  assert.equal((await inbox(task.from, { api: mockApi() })).total_pending, 1);
});
test('corrupt packet makes inbox UNAVAILABLE, never silently empty', async () => {
  const api = mockApi([{ ...issue(), body: '<!-- agent-task:v1 --> broken' }]);
  assert.equal((await inbox(task.to, { api })).result, 'UNAVAILABLE');
});
test('GitHub pagination reads later pages and API failures are explicit', async () => {
  let calls = 0;
  const client = githubClient({ token: '', fetchImpl: async () => {
    calls++; return new Response(JSON.stringify([{ number: calls }]), { headers: { link: calls === 1 ? '<next>; rel="next"' : '' } });
  } });
  assert.equal((await client.issues()).length, 2);
  const failed = githubClient({ token: '', fetchImpl: async () => new Response('{}', { status: 403 }) });
  await assert.rejects(failed.issues(), /UNAVAILABLE/);
});
test('preparing a stale revision is rejected after another writer advances state', async () => {
  const api = mockApi([issue()], new Map([[10, [history[0]]]]));
  await assert.rejects(taskService(api).prepare(10, { ...claim, id: 'stale-second-claim' }), /Stale/);
});
test('packet addressed to another issue cannot claim an identical request', () => {
  const state = reduceTask(issue(11), [history[0]]);
  assert.equal(state.status, 'OPEN'); assert.match(state.rejected[0].reason, /different issue/);
});
test('Unicode inbox summaries stay within byte budget without losing pagination', async () => {
  const largeTask = { ...task, goal: '가'.repeat(180) };
  const issues = Array.from({ length: 5 }, (_, i) => issue(10 + i, largeTask));
  const histories = new Map(issues.map(i => [i.number, [comment(i.number, {
    ...claim, issue: i.number, task_digest: digest(largeTask), summary: '결과'.repeat(120)
  })]]));
  const result = await inbox(task.to, { api: mockApi(issues, histories) });
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 4096);
  assert.equal(result.next_offset, result.items.length);
  assert.equal(result.total_pending, 5);
});
