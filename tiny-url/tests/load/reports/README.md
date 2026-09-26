# Benchmark Master Index

Executive dashboard summarizing the latest performance benchmark runs across all scenarios and network profiles.

## 📊 Latest Benchmark Snapshot

| Scenario | Profile | Last Run | Target | VUs Max | Throughput (RPS) | Latency p95 | Fail Rate | SLA Status | Detailed History | Latest Report |
|---|---|---|---|---|---|---|---|---|---|---|
| **01 - Edge Cache Saturation & Hotkey Benchmark** | `BASELINE` | `2026-09-26T16-55-56` | `Mock CDN (http://mock-cdn)` | 10 | 5951.3 | 0.79ms | 0.00% | **`VIOLATED`** | [View History](./01-hotkey-cache-hit/history.md) | [`01-hotkey-cache-hit-2026-09-26T16-55-56.html`](./01-hotkey-cache-hit/01-hotkey-cache-hit-2026-09-26T16-55-56.html) |
| **01 - Edge Cache Saturation & Hotkey Benchmark** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./01-hotkey-cache-hit/history.md) | - |
| **02 - Origin Fastify & Redis Cache-Aside Benchmark** | `BASELINE` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./02-origin-cache-miss/history.md) | - |
| **02 - Origin Fastify & Redis Cache-Aside Benchmark** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./02-origin-cache-miss/history.md) | - |
| **03 - Cache Penetration Defense (Negative Caching)** | `BASELINE` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./03-cache-penetration/history.md) | - |
| **03 - Cache Penetration Defense (Negative Caching)** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./03-cache-penetration/history.md) | - |
| **04a - Steady-State Short URL Creation** | `BASELINE` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./04a-write-steady/history.md) | - |
| **04a - Steady-State Short URL Creation** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./04a-write-steady/history.md) | - |
| **04b - Key Buffer Starvation & KGS Self-Healing** | `BASELINE` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./04b-write-starvation/history.md) | - |
| **04b - Key Buffer Starvation & KGS Self-Healing** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./04b-write-starvation/history.md) | - |
| **05 - Mixed Pipeline Real-World Stress** | `BASELINE` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./05-mixed-pipeline-stress/history.md) | - |
| **05 - Mixed Pipeline Real-World Stress** | `WAN` | _Not executed_ | - | - | - | - | - | `PENDING` | [View History](./05-mixed-pipeline-stress/history.md) | - |

---

## 📁 Scenario Benchmark Directories

- [**01 - Edge Cache Saturation & Hotkey Benchmark**](./01-hotkey-cache-hit/history.md)
- [**02 - Origin Fastify & Redis Cache-Aside Benchmark**](./02-origin-cache-miss/history.md)
- [**03 - Cache Penetration Defense (Negative Caching)**](./03-cache-penetration/history.md)
- [**04a - Steady-State Short URL Creation**](./04a-write-steady/history.md)
- [**04b - Key Buffer Starvation & KGS Self-Healing**](./04b-write-starvation/history.md)
- [**05 - Mixed Pipeline Real-World Stress**](./05-mixed-pipeline-stress/history.md)

