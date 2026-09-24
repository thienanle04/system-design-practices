# 0007: Containerized Load Testing and Pipeline Reconciliation

We implement a containerized performance testing harness using Grafana k6 within the Docker network, accompanied by an end-to-end event reconciliation pipeline and immutable timestamped test reporting, instead of relying on host-level ad-hoc load generators or HTTP-only metric collection. This guarantees reproducible network conditions, measures true distributed system behavior across Edge CDN and Origin tiers, validates background event streaming consistency, and retains an auditable history of performance runs.

## Status

Accepted

## Considered Options

- **Host-Machine Ad-hoc Load Generation (Autocannon / curl scripts)**: Run Node.js or curl benchmarking tools directly on the developer host machine. Rejected due to host OS port exhaustion, interference from local network stacks, inability to target internal Docker service hostnames (e.g. `load-balancer`, `url-service-1`) directly without exposing host ports, and lack of reproducible virtual user ramp-up metrics.
- **HTTP-Only Benchmark Assertions**: Measure solely HTTP status codes, throughput (RPS), and client-side latency (p95/p99). Rejected because URL Shortener redirects trigger asynchronous Kafka Click Events processed in micro-batches; an HTTP 302 success does not verify that analytics ingestion succeeded without message drops, consumer lag, or database contention.
- **Containerized k6 Harness with Pipeline Reconciliation & Timestamped Reports**:
  - Run k6 as an ephemeral service inside the Docker Compose network, allowing configurable ingress targeting (Mock CDN Edge vs internal Load Balancer).
  - Segregate write tests into steady-state capacity benchmarks and Key Buffer starvation resilience benchmarks.
  - Implement an automated post-test reconciliation hook (`verify-pipeline.ts`) that asserts Kafka consumer lag is zero and reconciles redirect counts against PostgreSQL analytics records.
  - Export self-contained HTML and JSON reports stamped with ISO timestamps into a dedicated persistent directory (`tests/load/reports/`) accompanied by an append-only historical run log (`history.md`).

## Consequences

- Load tests run identically across developer workstations and CI environments with zero host dependencies other than Docker.
- Engineers can benchmark Edge Cache hit performance independently from Origin Service Node and Database saturation.
- Test runs never overwrite prior reports; performance regressions and improvements across architectural iterations can be audited and compared historically.
- The pipeline reconciliation step validates both data integrity and latency under concurrent stress, ensuring asynchronous streaming bottlenecks in Kafka or PostgreSQL are detected early.
