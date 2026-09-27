# Scenario Benchmark History: 04b - Key Buffer Starvation & KGS Self-Healing

Immutable sequential record of performance benchmark runs and SLA verification for **04b - Key Buffer Starvation & KGS Self-Healing**.

[⬅️ Back to Benchmark Master Index](../README.md)

| Timestamp | Profile | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency Avg | Latency p95 | Latency p99 | Latency Max | Fail Rate | SLA Status | Report File |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `2026-09-27T09-29-09` | `BASELINE` | `Load Balancer (http://load-balancer)` | 25.0s | 30 | 75,304 | 3011.8 | 5.77ms | 42.30ms | 60.88ms | 324.66ms | 0.00% | `PASS` | [`04b-write-starvation-2026-09-27T09-29-09.html`](./04b-write-starvation-2026-09-27T09-29-09.html) |
| `2026-09-27T09-32-47` | `WAN` | `Load Balancer (http://load-balancer)` | 25.2s | 60 | 8,651 | 342.9 | 101.41ms | 115.05ms | 120.00ms | 175.20ms | 0.00% | `PASS` | [`04b-write-starvation-wan-2026-09-27T09-32-47.html`](./04b-write-starvation-wan-2026-09-27T09-32-47.html) |
| `2026-09-27T09-35-45` | `BASELINE` | `Load Balancer (http://load-balancer)` | 25.0s | 100 | 79,220 | 3168.4 | 18.30ms | 77.40ms | 85.87ms | 175.63ms | 0.00% | `PASS` | [`04b-write-starvation-2026-09-27T09-35-45.html`](./04b-write-starvation-2026-09-27T09-35-45.html) |
| `2026-09-27T13-36-38` | `BASELINE` | `Load Balancer (http://load-balancer)` | 25.0s | 100 | 63,423 | 2536.8 | 22.93ms | 77.05ms | 94.05ms | 343.61ms | 0.00% | `PASS` | [`04b-write-starvation-2026-09-27T13-36-38.html`](./04b-write-starvation-2026-09-27T13-36-38.html) |
