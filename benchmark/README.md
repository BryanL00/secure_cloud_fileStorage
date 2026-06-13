# CloudFortify Performance Benchmark Suite

A reproducible harness that turns the unsupported numbers in Section 5.7 into measured,
defensible results. Three components:

| Script | Measures | Output |
|---|---|---|
| `crypto-bench.js` | Encryption/decryption overhead of the project's own AES-256-CBC + RSA scheme, across file sizes | `results/crypto-bench.csv` |
| `api-bench.js` | Real HTTP latency (p50/p90/p99) and throughput of the read endpoints under concurrency | `results/api-bench.csv` |
| `explain.sql` | Database query execution time + whether the schema indexes are used | `EXPLAIN ANALYZE` console output |

## Placement

This `benchmark/` folder lives at the **repository root**, next to `backend/` and `frontend/`:

```
secure_cloud_fileStorage/
├── backend/
├── frontend/
└── benchmark/        <- this folder
```

`crypto-bench.js` loads `../backend/src/utils/encryption.js` by default, which in turn reads the
RSA keys from `backend/keys/`. If your layout differs, set `ENCRYPTION_MODULE_PATH`.

## 1. Crypto micro-benchmark (no server needed)

```bash
cd benchmark
node crypto-bench.js                          # default sizes 1,5,25,50,100 MB; 30 iters
node crypto-bench.js --sizes 1,5,25,50,100 --iters 50
```

Requires the RSA key pair at `backend/keys/{public,private}.pem` (the same ones the app uses).
The script asserts a byte-for-byte round trip every iteration, so a successful run is *also*
evidence that the hybrid scheme preserves data.

## 2. API latency / throughput benchmark (server must be running)

```bash
cd benchmark
npm install                                   # installs autocannon
# start MinIO, backend (:3001) and seed a NON-ADMIN test user first
EMAIL=user@corp.com PASSWORD=Cloud@2026 node api-bench.js
EMAIL=user@corp.com PASSWORD=Cloud@2026 node api-bench.js --connections 20 --duration 15
```

It logs in to capture the HttpOnly cookie, then benchmarks only GET endpoints (safe to repeat).
**Use a non-admin user** — the `/api/files` endpoints block Administrators, which would show as
`non2xx` responses. To produce the **concurrency curve** for Chapter 5, run it at several
connection counts and record the rps/p95 each time:

```bash
for c in 1 5 10 20 50; do
  EMAIL=user@corp.com PASSWORD=Cloud@2026 node api-bench.js --connections $c --duration 10
  cp results/api-bench.csv results/api-bench-c$c.csv
done
```

## 3. Database query timing

```bash
# seed representative data first (a few hundred files, a few thousand audit rows)
psql -U postgres -d secure_cloud_storage \
  --set uid="'<a-real-user-uuid>'" \
  --set fid="'<a-real-folder-uuid>'" \
  -f explain.sql
```

Capture the `Execution Time:` line and the scan nodes from each block — the `Index Scan using
idx_files_owner_id` (etc.) lines prove your indexes are actually exercised.

## How to present the results in Chapter 5

1. **Methodology paragraph (mandatory):** state the host hardware, Node/PostgreSQL versions, number
   of iterations, warmup count, and the tools (autocannon version, `EXPLAIN ANALYZE`). Without this,
   the numbers are not reproducible and an examiner will discount them.
2. **Latency table:** report **p50 / p90 / p99 and throughput** per endpoint — not just the mean.
3. **Encryption-overhead chart:** plot mean AES encrypt/decrypt time vs file size from
   `crypto-bench.csv`. This substantiates the "overhead scales approximately linearly and is
   modest" claim with real data.
4. **Concurrency chart:** plot throughput (and p95 latency) vs concurrent connections.
5. **DB timing table:** the five `EXPLAIN ANALYZE` execution times, with a note on index usage.
6. **Evidence:** screenshot each tool's console output into Appendix B.5 and include the CSVs.

## Honesty note on the crypto numbers

`crypto-bench.js` measures the encryption/decryption step **in isolation** (in-memory buffers).
End-to-end upload/download latency also includes multipart parsing, the MinIO round trip, and the
PostgreSQL writes. Report the crypto figure as the *encryption overhead component* and the
end-to-end figure (from a handful of timed manual UI uploads, or from server response-time logging)
as the *total*, and explain the difference. Do not present the in-memory crypto time as the full
upload time.
