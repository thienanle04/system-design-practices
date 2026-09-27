# Scenario Benchmark History: 05 - Mixed Pipeline Real-World Stress

Immutable sequential record of performance benchmark runs and SLA verification for **05 - Mixed Pipeline Real-World Stress**.

[⬅️ Back to Benchmark Master Index](../README.md)

| Timestamp | Profile | Target | Duration | VUs Max | Total Reqs | Throughput (RPS) | Latency Avg | Latency p95 | Latency p99 | Latency Max | Fail Rate | SLA Status | Report File |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `2026-09-27T09-29-46` | `BASELINE` | `Mock CDN (Read) & Load Balancer (Write)` | 30.1s | 15 | 195,973 | 6502.4 | 1.40ms | 1.37ms | 68.14ms | 89.59ms | 0.00% | `PASS` | [`05-mixed-pipeline-stress-2026-09-27T09-29-46.html`](./05-mixed-pipeline-stress-2026-09-27T09-29-46.html) |
| `2026-09-27T09-33-30` | `WAN` | `Mock CDN (Read) & Load Balancer (Write)` | 33.3s | 50 | 24,693 | 741.9 | 37.99ms | 102.18ms | 114.38ms | 310.26ms | 0.00% | `PASS` | [`05-mixed-pipeline-stress-wan-2026-09-27T09-33-30.html`](./05-mixed-pipeline-stress-wan-2026-09-27T09-33-30.html) |
| `2026-09-27T09-36-22` | `BASELINE` | `Mock CDN (Read) & Load Balancer (Write)` | 30.1s | 50 | 205,441 | 6829.9 | 4.47ms | 6.78ms | 86.44ms | 511.49ms | 0.00% | `PASS` | [`05-mixed-pipeline-stress-2026-09-27T09-36-22.html`](./05-mixed-pipeline-stress-2026-09-27T09-36-22.html) |
| `2026-09-27T09-37-02` | `BASELINE` | `Mock CDN (Read) & Load Balancer (Write)` | 30.1s | 120 | 226,167 | 7519.7 | 9.84ms | 87.08ms | 93.45ms | 710.34ms | 0.00% | `PASS` | [`05-mixed-pipeline-stress-2026-09-27T09-37-02.html`](./05-mixed-pipeline-stress-2026-09-27T09-37-02.html) |
| `2026-09-27T14-13-55` | `BASELINE` | `Mock CDN (Read) & Load Balancer (Write)` | 0.3s | N/A | 30 | 118.8 | 8.26ms | 10.60ms | 19.75ms | 23.00ms | 100.00% | **`VIOLATED`** | [`05-mixed-pipeline-stress-2026-09-27T14-13-55.html`](./05-mixed-pipeline-stress-2026-09-27T14-13-55.html) |
| `2026-09-27T14-19-37` | `BASELINE` | `Mock CDN (Read) & Load Balancer (Write)` | 30.1s | 15 | 203,063 | 6742.0 | 1.35ms | 1.34ms | 67.79ms | 86.89ms | 0.00% | `PASS` | [`05-mixed-pipeline-stress-2026-09-27T14-19-37.html`](./05-mixed-pipeline-stress-2026-09-27T14-19-37.html) |
