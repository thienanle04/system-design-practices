# 0011: Deterministic Resource Budget Profiling for Performance Benchmarking

We introduce a deterministic Resource Budget Profile implemented via a composable Docker Compose overlay (`docker-compose.resources.yml`) that enforces strict vCPU CFS quotas and memory limits across all infrastructure and application tiers during performance testing, while leaving local development unconstrained and the k6 load generator unthrottled.

## Status

Accepted

## Considered Options

- **Direct Hardcoded Limits in Base `docker-compose.yml`**: Rejected because restricting container resources globally slows down local build times, TypeScript hot-reloads, and container initialization during ordinary day-to-day development.
- **Unconstrained Execution with Host-Dependent Scheduling**: Rejected because benchmark throughput and latency metrics vary unpredictably across developer workstations (e.g. 4-core laptops vs 16-core workstations) and conceal concurrency bottlenecks such as Node.js event-loop starvation, thread-pool exhaustion, or database connection contention.
- **CPU Core Pinning (`cpuset`)**: Rejected because hardcoding specific CPU core IDs (e.g. `cpuset: "0,1"`) is non-portable across differing host CPU topologies, virtualized environments (such as Windows WSL2), and CI runners.
- **Composable Resource Budget Profile Overlay (Selected)**:
  - Defines tier-appropriate CFS CPU limits (`deploy.resources.limits.cpus`) and memory limits (`deploy.resources.limits.memory`) in `docker-compose.resources.yml`:
    - **Edge & Gateway**: `mock-cdn` (0.5 vCPU, 256MB), `load-balancer` (0.5 vCPU, 256MB).
    - **Compute Services**: `url-service-1` (0.5 vCPU, 512MB), `url-service-2` (0.5 vCPU, 512MB), `kgs-service` (0.5 vCPU, 256MB), `analytics-service` (0.5 vCPU, 512MB).
    - **Datastores**: `redis` (0.5 vCPU, 256MB), `postgres` (1.0 vCPU, 512MB), `kafka` (1.0 vCPU, 1024MB).
    - **Load Generator**: `k6` remains unconstrained to prevent client-side saturation from skewing latency metrics.
  - Integrated via `npm run docker:perf:up` and verified programmatically within `run.mjs` and `run-wan.mjs`.
  - **Nominal Capacity Envelope Calibration**:
    - Centralizes workload sizing (`VUS_PROFILE`) and acceptance criteria (`THRESHOLDS_BASELINE`) in `config.js`.
    - Scales baseline VUs to fit the 0.5 vCPU budget without triggering Linux kernel CFS period freeze (`mock-cdn`: 8 VUs, `url-service`: 12 VUs, `negative-cache`: 10 VUs, `postgres`: 5 VUs).
    - Calibrates baseline SLA thresholds (`EDGE_HIT`: p95 < 10ms, `ORIGIN_READ`: p95 < 40ms) to ensure objective, reproducible gating.

## Consequences

- Performance benchmarks across Baseline (zero-delay) and Emulated WAN profiles are reproducible, consistent, and directly comparable across different machines and over time in `tests/load/reports/README.md` and Scenario Benchmark Histories.
- Prevents local developer machines from being overwhelmed by capping total test stack consumption to ~5.5 vCPU and ~4GB RAM.
- Uncovers genuine microservice concurrency and memory pressure regressions early before production deployment without false-positive failures from CPU quota exhaustion.
