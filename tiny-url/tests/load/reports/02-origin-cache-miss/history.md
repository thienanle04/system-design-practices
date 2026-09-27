# Scenario Benchmark History: 02 - Origin Fastify & Redis Cache-Aside Benchmark

Immutable sequential record of performance benchmark runs and SLA verification for **02 - Origin Fastify & Redis Cache-Aside Benchmark**.

[⬅️ Back to Benchmark Master Index](../README.md)

| Timestamp | Profile | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency Avg | Latency p95 | Latency p99 | Latency Max | Fail Rate | SLA Status | Report File |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `2026-09-27T09-27-37` | `BASELINE` | `Load Balancer (http://load-balancer)` | 25.2s | 12 | 42,795 | 1695.8 | 4.23ms | 12.23ms | 60.93ms | 98.37ms | 0.00% | `PASS` | [`02-origin-cache-miss-2026-09-27T09-27-37.html`](./02-origin-cache-miss-2026-09-27T09-27-37.html) |
| `2026-09-27T09-31-03` | `WAN` | `Load Balancer (http://load-balancer)` | 30.5s | 60 | 9,002 | 295.5 | 101.04ms | 114.57ms | 118.52ms | 175.54ms | 0.00% | `PASS` | [`02-origin-cache-miss-wan-2026-09-27T09-31-03.html`](./02-origin-cache-miss-wan-2026-09-27T09-31-03.html) |
