// One public origin for Next.js and the existing Socket.IO game server.
// Run a single instance: the poker room is intentionally held in memory.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = path.join(root, 'mini-services/poker-server');
const publicPort = Number(process.env.PORT || 8080);
const webPort = Number(process.env.HOLDEM_WEB_PORT || 3000);
const pokerPort = Number(process.env.POKER_PORT || 3003);
const ports = [publicPort, webPort, pokerPort];
if (ports.some(p => !Number.isInteger(p) || p < 1 || p > 65535) || new Set(ports).size !== 3) {
  throw new Error('Public, web and poker ports must be valid and distinct');
}

const children = [];
let stopping = false;
const proxy = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/healthz') {
    try {
      const checks = await Promise.all([
        fetch(`http://127.0.0.1:${webPort}/`, { signal: AbortSignal.timeout(3000) }),
        fetch(`http://127.0.0.1:${pokerPort}/health`, { signal: AbortSignal.timeout(3000) }),
      ]);
      if (checks.some(r => !r.ok)) throw new Error('A service is not ready');
      await Promise.all(checks.map(r => r.body?.cancel()));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"status":"ok","web":true,"poker":true}');
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end('{"status":"starting"}');
    }
    return;
  }
  const targetPort = pathname.startsWith('/socket.io/') || pathname === '/health' ? pokerPort : webPort;
  const upstream = http.request({
    hostname: '127.0.0.1', port: targetPort, path: req.url,
    method: req.method, headers: req.headers,
  }, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
    response.on('error', () => res.destroy());
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Service is starting. Please try again shortly.');
  });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
});

// Current clients use polling; pass upgrades too for compatible future clients.
proxy.on('upgrade', (req, socket, head) => {
  if (new URL(req.url || '/', 'http://localhost').pathname !== '/socket.io/') {
    socket.destroy(); return;
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: pokerPort, path: req.url, headers: req.headers });
  upstream.on('upgrade', (response, peer, upstreamHead) => {
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
    for (const [name, value] of Object.entries(response.headers)) {
      for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) socket.write(`${name}: ${item}\r\n`);
    }
    socket.write('\r\n');
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) peer.write(head);
    peer.on('error', () => socket.destroy());
    socket.on('error', () => peer.destroy());
    peer.on('close', () => socket.destroy());
    socket.on('close', () => peer.destroy());
    peer.pipe(socket); socket.pipe(peer);
  });
  upstream.on('response', response => { response.resume(); socket.destroy(); });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
});

function stop(code) {
  if (stopping) return;
  stopping = true;
  proxy.close();
  for (const child of children) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 5000);
  Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve))))
    .then(() => { clearTimeout(deadline); process.exit(code); });
}

function launch(name, args, cwd, extraEnv) {
  const child = spawn(process.execPath, args, {
    cwd, env: { ...process.env, NODE_ENV: 'production', ...extraEnv }, stdio: 'inherit',
  });
  children.push(child);
  child.on('error', error => { console.error(`[${name}] ${error.message}`); stop(1); });
  child.on('exit', (code, signal) => {
    if (!stopping) { console.error(`[${name}] exited (${signal || code}); restarting requires the hosting supervisor`); stop(1); }
  });
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
proxy.on('error', error => { console.error(error.message); stop(1); });
launch('web', [path.join(root, '.next/standalone/server.js')], root, { PORT: String(webPort), HOSTNAME: '127.0.0.1' });
launch('poker', ['--import', 'tsx', 'index.ts'], service, {
  POKER_PORT: String(pokerPort), POKER_TEST_MODE: '0', POKER_RESTART_INTERVAL_MS: '0',
});
proxy.listen(publicPort, '0.0.0.0', () => console.log(`Holdem public listener: ${publicPort}`));
