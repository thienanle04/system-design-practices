# Scenario Benchmark History: 03 - Cache Penetration Defense (Negative Caching)

Immutable sequential record of performance benchmark runs and SLA verification for **03 - Cache Penetration Defense (Negative Caching)**.

[⬅️ Back to Benchmark Master Index](../README.md)

| Timestamp | Profile | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency Avg | Latency p95 | Latency p99 | Latency Max | Fail Rate | SLA Status | Report File |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `2026-09-27T09-28-07` | `BASELINE` | `Load Balancer (http://load-balancer)` | 25.0s | 10 | 73,181 | 2927.5 | 2.05ms | 3.26ms | 53.43ms | 65.63ms | 0.00% | `PASS` | [`03-cache-penetration-2026-09-27T09-28-07.html`](./03-cache-penetration-2026-09-27T09-28-07.html) |
| `2026-09-27T09-31-38` | `WAN` | `Load Balancer (http://load-balancer)` | 25.0s | 40 | 5,980 | 238.8 | 100.98ms | 114.73ms | 118.59ms | 168.60ms | 0.00% | **`VIOLATED`** | [`03-cache-penetration-wan-2026-09-27T09-31-38.html`](./03-cache-penetration-wan-2026-09-27T09-31-38.html) |
| `2026-09-27T13-36-02` | `WAN` | `Load Balancer (http://load-balancer)` | 25.0s | 40 | 5,972 | 238.7 | 101.14ms | 115.06ms | 119.42ms | 242.80ms | 0.00% | `PASS` | [`03-cache-penetration-wan-2026-09-27T13-36-02.html`](./03-cache-penetration-wan-2026-09-27T13-36-02.html) |
