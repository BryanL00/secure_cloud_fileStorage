#!/usr/bin/env node
/**
 * crypto-bench.js - Measures the encryption/decryption overhead of the
 * project's own hybrid scheme (AES-256-CBC + RSA key wrapping), reusing the
 * real functions in backend/src/utils/encryption.js.
 *
 * Produces, for each file size: mean / median / p95 / stddev for
 *   (a) AES encrypt, (b) AES decrypt, (c) RSA key-wrap, (d) RSA key-unwrap.
 * Writes results to results/crypto-bench.csv for charting in Chapter 5.
 *
 * USAGE (from the benchmark/ directory):
 *   node crypto-bench.js
 *   node crypto-bench.js --sizes 1,5,25,50,100 --iters 50
 *
 * REQUIREMENTS:
 *   - Run with the backend RSA keys present at backend/keys/{public,private}.pem
 *   - Adjust ENCRYPTION_MODULE_PATH below if your folder layout differs.
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// ---- Locate the project's encryption module ---------------------------------
// Default assumes:  <repo>/benchmark/crypto-bench.js  and  <repo>/backend/src/utils/encryption.js
const ENCRYPTION_MODULE_PATH =
  process.env.ENCRYPTION_MODULE_PATH ||
  path.resolve(__dirname, '../backend/src/utils/encryption.js');

let crypto;
try {
  crypto = require(ENCRYPTION_MODULE_PATH);
} catch (e) {
  console.error(`\nCould not load encryption module at:\n  ${ENCRYPTION_MODULE_PATH}`);
  console.error('Set ENCRYPTION_MODULE_PATH or run from the benchmark/ folder.');
  console.error('Note: encryption.js reads ../../keys/*.pem relative to itself, so the');
  console.error('RSA key pair must exist under backend/keys/.\n');
  console.error(e.message);
  process.exit(1);
}

const {
  generateAESKey, generateIV,
  encryptFile, decryptFile,
  encryptAESKey, decryptAESKey,
} = crypto;

// ---- CLI args ---------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const SIZES_MB = arg('sizes', '1,5,25,50,100').split(',').map(Number);
const ITERS = parseInt(arg('iters', '30'), 10);
const WARMUP = 3;

// ---- Stats helpers ----------------------------------------------------------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stddev = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const f = (n) => n.toFixed(3);

// ---- Benchmark one size -----------------------------------------------------
function benchSize(mb) {
  const buf = require('crypto').randomBytes(mb * 1024 * 1024);
  const enc = [], dec = [], wrap = [], unwrap = [];

  for (let i = 0; i < WARMUP + ITERS; i++) {
    const key = generateAESKey();
    const iv = generateIV();

    let t = performance.now();
    const cipher = encryptFile(buf, key, iv);
    const tEnc = performance.now() - t;

    t = performance.now();
    const wrapped = encryptAESKey(key);
    const tWrap = performance.now() - t;

    t = performance.now();
    const unwrapped = decryptAESKey(wrapped);
    const tUnwrap = performance.now() - t;

    t = performance.now();
    const plain = decryptFile(cipher, unwrapped, iv);
    const tDec = performance.now() - t;

    // Correctness assertion (round-trip integrity of the test harness itself)
    if (Buffer.compare(plain, buf) !== 0) {
      throw new Error(`Round-trip mismatch at ${mb} MB, iteration ${i}`);
    }

    if (i >= WARMUP) { enc.push(tEnc); dec.push(tDec); wrap.push(tWrap); unwrap.push(tUnwrap); }
  }
  return { enc, dec, wrap, unwrap };
}

// ---- Run --------------------------------------------------------------------
console.log(`\nCrypto micro-benchmark - ${ITERS} iterations/size (after ${WARMUP} warmups)`);
console.log(`Sizes (MB): ${SIZES_MB.join(', ')}\n`);

const header = ['size_mb', 'op', 'mean_ms', 'median_ms', 'p95_ms', 'stddev_ms', 'iterations'];
const rows = [header.join(',')];

console.log(
  'Size'.padEnd(7) + 'Operation'.padEnd(16) +
  'Mean'.padStart(10) + 'Median'.padStart(10) + 'p95'.padStart(10) + 'Stdev'.padStart(10)
);
console.log('-'.repeat(63));

for (const mb of SIZES_MB) {
  const r = benchSize(mb);
  const ops = [
    ['AES_encrypt', r.enc],
    ['AES_decrypt', r.dec],
    ['RSA_wrap', r.wrap],
    ['RSA_unwrap', r.unwrap],
  ];
  for (const [name, samples] of ops) {
    const mn = mean(samples), md = median(samples), p95 = percentile(samples, 95), sd = stddev(samples);
    rows.push([mb, name, f(mn), f(md), f(p95), f(sd), samples.length].join(','));
    console.log(
      `${mb} MB`.padEnd(7) + name.padEnd(16) +
      f(mn).padStart(10) + f(md).padStart(10) + f(p95).padStart(10) + f(sd).padStart(10)
    );
  }
  console.log('-'.repeat(63));
}

fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
const out = path.join(__dirname, 'results', 'crypto-bench.csv');
fs.writeFileSync(out, rows.join('\n') + '\n');
console.log(`\nCSV written to ${out}`);
console.log('Use this CSV to plot "encryption time vs file size" in Chapter 5.\n');
