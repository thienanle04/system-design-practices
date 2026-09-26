# 0009: Dual-Profile Performance Testing and WAN Emulation

We adopt a dual-profile performance testing architecture that decouples raw application throughput benchmarks from wide-area network concurrency validation. We tighten the zero-latency Baseline Performance Profile thresholds in Docker to catch application and database regressions, while establishing a dedicated Emulated WAN Latency profile using Linux kernel traffic shaping (`tc netem`) with automated lifecycle teardown to evaluate connection pool saturation and high Connection Holding Time.

## Status

Accepted

## Considered Options

- **Single Loosely-Bounded Benchmark Suite**: Maintain a single set of k6 test runs with relaxed latency thresholds (e.g. p95 < 60ms) to accommodate varying host conditions without simulating network delays. Rejected because generous thresholds conceal severe microservice regressions (e.g. 5x slowdown in Edge Cache hits still passes), while failing to stress test server concurrency under prolonged TCP connection holding times.
- **Application/Proxy-Level Artificial Delay (`echo_sleep` / Fastify middleware)**: Inject simulated sleep timers directly within Nginx directives or Node.js request hooks. Rejected because application-level delays alter internal runtime event-loop semantics and do not emulate transport-layer TCP handshakes, kernel socket buffers, or true packet jitter.
- **Toxiproxy Chaos Sidecar**: Route k6 traffic through an intermediate layer-4 proxy container. Rejected due to the operational overhead of dual-endpoint routing and DNS redirection when testing multi-hop paths (Edge-to-Origin and Client-to-Edge).
- **Dual-Profile Architecture with Linux `tc netem` & Automated Lifecycle**:
  - **Baseline Profile (Profile A)**: Zero synthetic delay with tightened SLA thresholds (`EDGE_HIT`: p95 < 6ms, `ORIGIN_READ`: p95 < 35ms) to guard against code and database regressions.
  - **WAN Profile (Profile B)**: Independent two-hop network latency injection (Client-to-Edge: 30ms ± 5ms RTT; Edge-to-Origin: 50ms ± 10ms RTT) via Linux kernel `tc netem` with dedicated WAN thresholds (`EDGE_HIT`: p95 < 70ms, `ORIGIN_READ`: p95 < 200ms).
  - **Automated Lifecycle Isolation**: Managed by a test runner wrapper that applies kernel `tc qdisc` rules prior to execution and guarantees rule teardown in a `try...finally` block upon completion or interruption.

## Consequences

- Zero interference between raw performance profiling and WAN chaos benchmarking.
- Microservice performance regressions at the Edge CDN or database query layer are caught immediately by tightened Baseline thresholds.
- System resilience against high Connection Holding Time, Nginx worker exhaustion, and downstream slow-client starvation can be systematically benchmarked in CI/CD without polluting local development environments.
