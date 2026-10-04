// Runs `expo start` with the browser talking to a deployed backend through a reverse proxy on
// localhost:8082. Hitting Cloud Run directly from localhost:8081 fails twice over: its CORS_ORIGINS
// does not list localhost, and better-auth's SameSite=Lax cookie is never stored cross-site.
// Ports do not count for SameSite, so localhost:8081 → localhost:8082 is same-site and the cookie
// flows; the proxy answers CORS for local origins only.
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';

const PROXY_PORT = 8082;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('usage: node scripts/dev-cloud-web.mjs <backend-url>');
  process.exit(1);
}
const target = new URL(targetArg);
const transport = target.protocol === 'https:' ? https : http;

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
}

const proxy = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const allowed = origin !== undefined && LOCAL_ORIGIN.test(origin);

  if (req.method === 'OPTIONS' && allowed) {
    res.writeHead(204, {
      ...corsHeaders(origin),
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }

  const headers = { ...req.headers, host: target.host };
  delete headers.referer;
  // better-auth trusts its own origin. A foreign origin is forwarded as-is so the backend still
  // rejects it — this rewrite must never apply to anything but a local dev origin.
  if (allowed) headers.origin = target.origin;

  const upstream = transport.request(
    new URL(req.url ?? '/', target),
    { method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, {
        ...upstreamRes.headers,
        ...(allowed ? corsHeaders(origin) : {}),
      });
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    console.error(`[proxy] ${req.method} ${req.url}: ${error.message}`);
    if (!res.headersSent) res.writeHead(502, allowed ? corsHeaders(origin) : {});
    res.end();
  });
  req.pipe(upstream);
});

proxy.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[proxy] http://localhost:${PROXY_PORT} → ${target.origin}`);

  const expo = spawn('npx', ['expo', 'start'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_BASE_URL: `http://localhost:${PROXY_PORT}`,
      // Phones keep talking to the backend directly: a LAN-rewritten localhost:8082 would hit a
      // listener bound to 127.0.0.1 that the phone cannot reach.
      EXPO_PUBLIC_API_BASE_URL_NATIVE: target.origin,
    },
  });
  process.on('SIGINT', () => expo.kill('SIGINT'));
  expo.on('exit', (code) => {
    proxy.close();
    process.exit(code ?? 0);
  });
});
