import { createHash } from 'node:crypto';

export const repository = 'mist2finer-spec/holdem_coin';
// GitHub identities, not role names. Add another writer only after repository review.
export const trustedLogins = ['mist2finer-spec'];
export const roles = ['director', 'tech-director', 'design-lead', 'art-lead', 'qa-release-lead',
  'gameplay-dev', 'network-server-dev', 'ui-ux-dev', 'systems-level-designer',
  'technical-artist', 'tools-perf-engineer', 'qa-tester', 'reverse_eng_designer'];
export const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export const filePath = value => text(value, 240) && value.trim() === value && !/[:\\\x00-\x1f?#]/.test(value) &&
  !value.startsWith('/') && value.split('/').every(part => part && part !== '..' && part !== '.');
const unique = values => new Set(values).size === values.length;
const list = (value, max, predicate, min = 1) => Array.isArray(value) && value.length >= min &&
  value.length <= max && value.every(predicate);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
export const envelope = (kind, value) => `<!-- agent-${kind}:v1 -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
export function parseEnvelope(kind, body) {
  const marker = `<!-- agent-${kind}:v1 -->`;
  if (!body?.includes(marker)) return null;
  assert(body.length < 18000, 'Packet exceeds 18KB characters');
  const rest = body.slice(body.indexOf(marker) + marker.length).trim();
  const match = /^```json\s*\n([\s\S]*?)\n```\s*$/.exec(rest);
  assert(match, `Malformed ${kind} packet`);
  return JSON.parse(match[1]);
}
export function validateTask(task) {
  assert(task?.schema === 1, 'Task schema must be 1');
  for (const key of ['from', 'to', 'reviewer']) assert(roles.includes(task[key]), `Unknown ${key} role`);
  assert(text(task.goal, 180) && text(task.scope), 'Goal (max 180 characters)/scope required');
  assert(text(task.branch, 150) && sha(task.base_sha), 'Branch and full base SHA required');
  assert(list(task.paths, 5, filePath) && unique(task.paths), 'Provide 1-5 unique relative paths');
  assert(list(task.acceptance, 8, value => text(value, 500)), 'Provide 1-8 acceptance criteria');
  assert(list(task.expected_artifacts, 5, filePath) && unique(task.expected_artifacts), 'Provide 1-5 expected artifact paths');
  assert(list(task.depends_on, 8, value => Number.isSafeInteger(value) && value > 0, 0) && unique(task.depends_on), 'Invalid dependencies');
  assert(list(task.sources, 5, source => text(source.summary, 500) &&
    /^https:\/\//.test(source.url ?? '') && !/https:\/\/(localhost|127\.|\[::1\])/i.test(source.url), 0), 'Sources must have shared HTTPS URLs and summaries');
  return task;
}
export function validateDelivery(task, delivery) {
  assert(delivery && sha(delivery.commit) && text(delivery.summary), 'Delivery commit/summary required');
  assert(list(delivery.artifacts, 5, artifact => filePath(artifact.path) && hash(artifact.sha256)), 'Invalid artifact manifest');
  assert(unique(delivery.artifacts.map(a => a.path)) &&
    JSON.stringify(delivery.artifacts.map(a => a.path).sort()) === JSON.stringify([...task.expected_artifacts].sort()), 'Artifact paths must match expected_artifacts');
  assert(text(delivery.validation) && text(delivery.limitations), 'Validation and limitations required');
}
function receiptChecks(task, event, delivery) {
  assert(event.delivery_digest === digest(delivery), 'Review is for a different delivery');
  assert(list(event.checks, 8, check => Number.isInteger(check.criterion) && check.result === 'PASS' &&
    delivery.artifacts.some(a => a.path === check.evidence)), 'Every criterion needs PASS and an artifact evidence path');
  assert(event.checks.length === task.acceptance.length && unique(event.checks.map(c => c.criterion)) &&
    event.checks.every(c => c.criterion >= 0 && c.criterion < task.acceptance.length), 'Every acceptance criterion must be reviewed');
}

// GitHub comment IDs define a deterministic order. First valid claim wins; stale commands never overwrite it.
// This is a cooperative protocol, not a security boundary against repository administrators editing history.
export function reduceTask(issue, comments) {
  assert(!issue.pull_request && trustedLogins.includes(issue.user?.login), 'Task author is not a configured writer');
  const task = validateTask(parseEnvelope('task', issue.body));
  assert(issue.title.startsWith(`[agent-task:${task.to}] `), 'Task title/receiver mismatch');
  const packetDigest = digest(task);
  const state = { issue: issue.number, url: issue.html_url, task, packet_digest: packetDigest,
    status: 'OPEN', version: 0, owner: null, delivery: null, receipt: null, checkpoint: null,
    dependency_receipts: [], applied: [], rejected: [] };
  const seen = new Set();
  for (const comment of [...comments].sort((a, b) => a.id - b.id)) {
    if (!comment.body?.includes('<!-- agent-event:v1 -->')) continue;
    if (!trustedLogins.includes(comment.user?.login)) { state.rejected.push({ comment: comment.id, reason: 'Untrusted author' }); continue; }
    // Editing an old packet can rewrite downstream meaning. Fail closed; use a new corrective event instead.
    assert(comment.created_at === comment.updated_at, `Edited protocol comment ${comment.id}; inspect history`);
    const event = parseEnvelope('event', comment.body);
    assert(event.task_digest === packetDigest, `Task body changed after publication (comment ${comment.id})`);
    try {
      assert(event.schema === 1 && text(event.id, 100), 'Event schema/id required');
      assert(event.issue === issue.number, 'Event targets a different issue');
      assert(!seen.has(event.id), 'Duplicate event id');
      seen.add(event.id);
      assert(event.login === comment.user.login, 'Event login/author mismatch');
      assert(roles.includes(event.role) && text(event.instance, 100), 'Role and unique execution instance required');
      assert(event.expected_version === state.version, `Stale version: expected ${state.version}`);
      assert(text(event.summary), 'Summary required');
      const sameOwner = state.owner?.login === event.login && state.owner?.instance === event.instance && state.owner?.role === event.role;
      const reviewer = event.role === task.reviewer && !(state.owner?.login === event.login && state.owner?.instance === event.instance);
      const producer = event.role === task.from;
      if (['CLAIM', 'RESUME', 'DELIVER', 'ACCEPT'].includes(event.type)) {
        assert(list(event.dependencies, 8, d => Number.isSafeInteger(d.issue) && hash(d.receipt), 0), 'Dependency receipts required');
        assert(unique(event.dependencies.map(d => d.issue)) && JSON.stringify(event.dependencies.map(d => d.issue).sort((a,b)=>a-b)) ===
          JSON.stringify([...task.depends_on].sort((a,b)=>a-b)), 'Dependency receipt set mismatch');
      }
      switch (event.type) {
        case 'CLAIM':
          assert(state.status === 'OPEN' && event.role === task.to, 'Task is already claimed or role is wrong');
          assert(event.checkout?.branch === task.branch && event.checkout?.sha === task.base_sha, 'Checkout differs from task branch/base SHA');
          state.owner = { login: event.login, instance: event.instance, role: event.role };
          state.status = 'CLAIMED'; break;
        case 'CHECKPOINT':
          assert(sameOwner && ['CLAIMED', 'BLOCKED', 'CHANGES_REQUESTED'].includes(state.status), 'Only active owner can checkpoint');
          assert(text(event.next_step, 500), 'Next step required'); break;
        case 'BLOCK':
          assert(sameOwner && ['CLAIMED', 'CHANGES_REQUESTED'].includes(state.status), 'Only active owner can block');
          assert(text(event.next_step, 500), 'Unblock action required'); state.status = 'BLOCKED'; break;
        case 'RESUME':
          assert(sameOwner && state.status === 'BLOCKED', 'Only blocked owner can resume'); state.status = 'CLAIMED'; break;
        case 'RELEASE':
          assert(sameOwner && ['CLAIMED', 'BLOCKED', 'CHANGES_REQUESTED'].includes(state.status), 'Only owner can release');
          state.owner = null; state.status = 'OPEN'; state.delivery = null; state.receipt = null; break;
        case 'DELIVER':
          assert(sameOwner && ['CLAIMED', 'CHANGES_REQUESTED'].includes(state.status), 'Claim/ACK required before delivery');
          validateDelivery(task, event.delivery);
          state.delivery = event.delivery; state.status = 'DELIVERED'; state.receipt = null; break;
        case 'ACCEPT':
          assert(state.status === 'DELIVERED' && reviewer, 'Designated reviewer must be a different execution instance');
          assert(digest(event.dependencies) === digest(state.dependency_receipts), 'Dependencies changed after delivery');
          receiptChecks(task, event, state.delivery);
          state.status = 'ACCEPTED'; state.receipt = digest({ task: packetDigest, delivery: state.delivery, event }); break;
        case 'REQUEST_CHANGES':
          assert(state.status === 'DELIVERED' && reviewer, 'Only designated reviewer can request changes');
          state.status = 'CHANGES_REQUESTED'; state.receipt = null; break;
        case 'REOPEN':
          assert(state.status === 'ACCEPTED' && (reviewer || producer), 'Only producer/reviewer can reopen accepted work');
          state.status = 'CHANGES_REQUESTED'; state.receipt = null; break;
        default: throw new Error('Unknown event type');
      }
      if (event.dependencies) state.dependency_receipts = event.dependencies;
      state.checkpoint = { summary: event.summary, next_step: event.next_step ?? null, at: comment.created_at };
      state.version++; state.applied.push(event.id);
    } catch (error) { state.rejected.push({ comment: comment.id, event: event.id, reason: error.message }); }
  }
  state.delivery_digest = state.delivery ? digest(state.delivery) : null;
  state.github_state = issue.state;
  // GitHub's Close button does not constitute acceptance. Closed unfinished tasks remain visible in the inbox.
  return state;
}
