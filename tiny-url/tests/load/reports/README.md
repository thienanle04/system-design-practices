# Benchmark Master Index

Executive dashboard summarizing the latest performance benchmark runs across all scenarios and network profiles.

## 📊 Latest Benchmark Snapshot

| Scenario | Profile | Last Run | Target | VUs Max | Throughput (RPS) | Latency p95 | Fail Rate | SLA Status | Detailed History | Latest Report |
|---|---|---|---|---|---|---|---|---|---|---|
| **01 - Edge Cache Saturation & Hotkey Benchmark** | `BASELINE` | `2026-09-27T09-27-04` | `Mock CDN (http://mock-cdn)` | 8 | 7096.9 | 0.68ms | 0.00% | `PASS` | [View History](./01-hotkey-cache-hit/history.md) | [`01-hotkey-cache-hit-2026-09-27T09-27-04.html`](./01-hotkey-cache-hit/01-hotkey-cache-hit-2026-09-27T09-27-04.html) |
| **01 - Edge Cache Saturation & Hotkey Benchmark** | `WAN` | `2026-09-27T09-30-26` | `Mock CDN (http://mock-cdn)` | 40 | 781.9 | 34.70ms | 0.00% | `PASS` | [View History](./01-hotkey-cache-hit/history.md) | [`01-hotkey-cache-hit-wan-2026-09-27T09-30-26.html`](./01-hotkey-cache-hit/01-hotkey-cache-hit-wan-2026-09-27T09-30-26.html) |
| **02 - Origin Fastify & Redis Cache-Aside Benchmark** | `BASELINE` | `2026-09-27T09-27-37` | `Load Balancer (http://load-balancer)` | 12 | 1695.8 | 12.23ms | 0.00% | `PASS` | [View History](./02-origin-cache-miss/history.md) | [`02-origin-cache-miss-2026-09-27T09-27-37.html`](./02-origin-cache-miss/02-origin-cache-miss-2026-09-27T09-27-37.html) |
| **02 - Origin Fastify & Redis Cache-Aside Benchmark** | `WAN` | `2026-09-27T09-31-03` | `Load Balancer (http://load-balancer)` | 60 | 295.5 | 114.57ms | 0.00% | `PASS` | [View History](./02-origin-cache-miss/history.md) | [`02-origin-cache-miss-wan-2026-09-27T09-31-03.html`](./02-origin-cache-miss/02-origin-cache-miss-wan-2026-09-27T09-31-03.html) |
| **03 - Cache Penetration Defense (Negative Caching)** | `BASELINE` | `2026-09-27T09-28-07` | `Load Balancer (http://load-balancer)` | 10 | 2927.5 | 3.26ms | 0.00% | `PASS` | [View History](./03-cache-penetration/history.md) | [`03-cache-penetration-2026-09-27T09-28-07.html`](./03-cache-penetration/03-cache-penetration-2026-09-27T09-28-07.html) |
| **03 - Cache Penetration Defense (Negative Caching)** | `WAN` | `2026-09-27T13-36-02` | `Load Balancer (http://load-balancer)` | 40 | 238.7 | 115.06ms | 0.00% | `PASS` | [View History](./03-cache-penetration/history.md) | [`03-cache-penetration-wan-2026-09-27T13-36-02.html`](./03-cache-penetration/03-cache-penetration-wan-2026-09-27T13-36-02.html) |
| **04a - Steady-State Short URL Creation** | `BASELINE` | `2026-09-27T09-35-14` | `Load Balancer (http://load-balancer)` | 80 | 3352.8 | 72.66ms | 0.00% | `PASS` | [View History](./04a-write-steady/history.md) | [`04a-write-steady-2026-09-27T09-35-14.html`](./04a-write-steady/04a-write-steady-2026-09-27T09-35-14.html) |
| **04a - Steady-State Short URL Creation** | `WAN` | `2026-09-27T09-32-13` | `Load Balancer (http://load-balancer)` | 15 | 91.4 | 116.38ms | 0.00% | `PASS` | [View History](./04a-write-steady/history.md) | [`04a-write-steady-wan-2026-09-27T09-32-13.html`](./04a-write-steady/04a-write-steady-wan-2026-09-27T09-32-13.html) |
| **04b - Key Buffer Starvation & KGS Self-Healing** | `BASELINE` | `2026-09-27T13-36-38` | `Load Balancer (http://load-balancer)` | 100 | 2536.8 | 77.05ms | 0.00% | `PASS` | [View History](./04b-write-starvation/history.md) | [`04b-write-starvation-2026-09-27T13-36-38.html`](./04b-write-starvation/04b-write-starvation-2026-09-27T13-36-38.html) |
| **04b - Key Buffer Starvation & KGS Self-Healing** | `WAN` | `2026-09-27T09-32-47` | `Load Balancer (http://load-balancer)` | 60 | 342.9 | 115.05ms | 0.00% | `PASS` | [View History](./04b-write-starvation/history.md) | [`04b-write-starvation-wan-2026-09-27T09-32-47.html`](./04b-write-starvation/04b-write-starvation-wan-2026-09-27T09-32-47.html) |
| **05 - Mixed Pipeline Real-World Stress** | `BASELINE` | `2026-09-27T14-19-37` | `Mock CDN (Read) & Load Balancer (Write)` | 15 | 6742.0 | 1.34ms | 0.00% | `PASS` | [View History](./05-mixed-pipeline-stress/history.md) | [`05-mixed-pipeline-stress-2026-09-27T14-19-37.html`](./05-mixed-pipeline-stress/05-mixed-pipeline-stress-2026-09-27T14-19-37.html) |
| **05 - Mixed Pipeline Real-World Stress** | `WAN` | `2026-09-27T09-33-30` | `Mock CDN (Read) & Load Balancer (Write)` | 50 | 741.9 | 102.18ms | 0.00% | `PASS` | [View History](./05-mixed-pipeline-stress/history.md) | [`05-mixed-pipeline-stress-wan-2026-09-27T09-33-30.html`](./05-mixed-pipeline-stress/05-mixed-pipeline-stress-wan-2026-09-27T09-33-30.html) |

---

## 📁 Scenario Benchmark Directories

- [**01 - Edge Cache Saturation & Hotkey Benchmark**](./01-hotkey-cache-hit/history.md)
- [**02 - Origin Fastify & Redis Cache-Aside Benchmark**](./02-origin-cache-miss/history.md)
- [**03 - Cache Penetration Defense (Negative Caching)**](./03-cache-penetration/history.md)
- [**04a - Steady-State Short URL Creation**](./04a-write-steady/history.md)
- [**04b - Key Buffer Starvation & KGS Self-Healing**](./04b-write-starvation/history.md)
- [**05 - Mixed Pipeline Real-World Stress**](./05-mixed-pipeline-stress/history.md)

