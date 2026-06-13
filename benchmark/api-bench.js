#!/usr/bin/env node
/**
 * api-bench.js - Measures real HTTP latency and throughput of the running
 * backend using autocannon. Logs in first to obtain the HttpOnly JWT cookie,
 * then benchmarks the read endpoints under a configurable concurrency.
 *
 * Reports p50 / p90 / p99 latency and requests-per-second per endpoint, and
 * writes results/api-bench.csv for charting in Chapter 5.
 *
 * USAGE (from the benchmark/ directory):
 *   npm install            # installs autocannon (see package.json in this folder)
 *   # ensure the backend is running on :3001 and a test user exists
 *   EMAIL=user@corp.com PASSWORD=Cloud@2026 node api-bench.js
 *   EMAIL=... PASSWORD=... node api-bench.js --connections 20 --duration 15
 *
 * NOTES:
 *   - Use a NON-ADMIN seeded user: the /api/files endpoints intentionally block
 *     Administrators, which would show up as non2xx responses.
 *   - Upload/download throughput is best measured separately with the crypto
 *     micro-benchmark (crypto-bench.js) plus a small number of manual UI uploads,
 *     because multipart upload bodies are awkward to drive from autocannon and
 *     are dominated by the same crypto cost measured there.
 *   - This script only exercises GET endpoints, so it is safe to run repeatedly.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const autocannon = require('autocannon');

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const CONNECTIONS = parseInt(arg('connections', '10'), 10);
const DURATION = parseInt(arg('duration', '10'), 10);

if (!EMAIL || !PASSWORD) {
  console.error('Set EMAIL and PASSWORD env vars for a seeded non-admin test user.');
  console.error('Example: EMAIL=user@corp.com PASSWORD=Cloud@2026 node api-bench.js');
  process.exit(1);
}

// ---- Log in and capture the Set-Cookie header -------------------------------
function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
    const url = new URL(BASE + '/api/auth/login');
    const req = http.request(
      {
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          if (res.statusCode !== 200 || !setCookie) {
            return reject(new Error(`Login failed (HTTP ${res.statusCode}): ${data}`));
          }
          // Take the token cookie's "name=value" pair only
          const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
          resolve(cookie);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---- Benchmark a single endpoint --------------------------------------------
function bench(title, requestPath, cookie) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: BASE + requestPath,
        connections: CONNECTIONS,
        duration: DURATION,
        headers: { cookie },
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ title, requestPath, result });
      }
    );
  });
}

(async () => {
  console.log(`\nAPI benchmark - ${CONNECTIONS} connections, ${DURATION}s/endpoint, base ${BASE}\n`);
  const cookie = await login();
  console.log('Authenticated; cookie acquired.\n');

  const targets = [
    ['Auth check (/api/auth/me)', '/api/auth/me'],
    ['File listing (/api/files)', '/api/files'],
    ['Shared files (/api/files/shared)', '/api/files/shared'],
    ['Storage stats (/api/files/storage)', '/api/files/storage'],
    ['Search (/api/files/search?q=report)', '/api/files/search?q=report'],
  ];

  const header = ['endpoint', 'path', 'rps_mean', 'lat_p50_ms', 'lat_p90_ms', 'lat_p99_ms', 'lat_max_ms', 'non2xx'];
  const rows = [header.join(',')];

  console.log(
    'Endpoint'.padEnd(34) + 'RPS'.padStart(9) + 'p50'.padStart(8) +
    'p90'.padStart(8) + 'p99'.padStart(8) + 'max'.padStart(8) + 'non2xx'.padStart(8)
  );
  console.log('-'.repeat(83));

  for (const [title, p] of targets) {
    const { result } = await bench(title, p, cookie);
    const lat = result.latency;     // ms percentiles
    const rps = result.requests;    // req/sec
    const non2xx = result.non2xx || 0;
    rows.push([title, p, rps.mean, lat.p50, lat.p90, lat.p99, lat.max, non2xx].join(','));
    console.log(
      title.slice(0, 33).padEnd(34) +
      String(rps.mean).padStart(9) +
      String(lat.p50).padStart(8) + String(lat.p90).padStart(8) +
      String(lat.p99).padStart(8) + String(lat.max).padStart(8) +
      String(non2xx).padStart(8)
    );
  }

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const out = path.join(__dirname, 'results', 'api-bench.csv');
  fs.writeFileSync(out, rows.join('\n') + '\n');
  console.log(`\nCSV written to ${out}`);
  console.log('Report p50/p90/p99 (not just mean) in Chapter 5; mention non2xx should be 0.\n');
})().catch((e) => {
  console.error('\nBenchmark error:', e.message, '\n');
  process.exit(1);
});
