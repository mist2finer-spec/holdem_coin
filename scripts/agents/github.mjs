import { assert, repository, bytesHash } from './protocol.mjs';

export function githubClient({ token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  const prefix = `/repos/${repository}`;
  async function request(path, { method = 'GET', body } = {}) {
    assert(path.startsWith(prefix + '/') || path === '/user', 'Unexpected API path');
    if (method !== 'GET') assert(token, 'Write requires GH_TOKEN/GITHUB_TOKEN, or use the connected GitHub tool with prepared JSON');
    const response = await fetchImpl(`https://api.github.com${path}`, { method, redirect: 'error',
      signal: AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'holdem-agent-protocol',
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    assert(response.ok, `GitHub ${response.status} for ${path}; inbox is UNAVAILABLE, not empty`);
    return { data: await response.json(), link: response.headers.get('link') ?? '' };
  }
  async function pages(path, maxPages = 20) {
    const result = [];
    for (let page = 1; page <= maxPages; page++) {
      const { data, link } = await request(`${prefix}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      assert(Array.isArray(data), 'Expected paginated array'); result.push(...data);
      if (!/rel="next"/.test(link)) return result;
    }
    throw new Error('Pagination limit reached; result incomplete, not an empty inbox');
  }
  return {
    issue: async id => (await request(`${prefix}/issues/${id}`)).data,
    comments: id => pages(`/issues/${id}/comments`),
    issues: () => pages('/issues?state=all&sort=created&direction=desc'),
    create: async body => (await request(`${prefix}/issues`, { method: 'POST', body })).data,
    comment: async (id, body) => (await request(`${prefix}/issues/${id}/comments`, { method: 'POST', body: { body } })).data,
    async artifact(commit, path) {
      const { data } = await request(`${prefix}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`);
      assert(data.type === 'file' && data.encoding === 'base64' && data.size <= 1024 * 1024 && data.content,
        `Artifact ${path}: use a committed summary under 1MiB (not a directory, LFS payload or local path)`);
      const bytes = Buffer.from(data.content, 'base64');
      assert(bytes.length === data.size, `Truncated artifact ${path}`);
      assert(!bytes.toString('utf8', 0, 100).startsWith('version https://git-lfs.github.com/spec/'), `LFS pointer is not the artifact: ${path}`);
      return bytesHash(bytes);
    },
    async descendant(base, result) {
      const { data } = await request(`${prefix}/compare/${base}...${result}`);
      assert(['ahead', 'identical'].includes(data.status), 'Delivery commit is not based on task base SHA');
    },
  };
}
