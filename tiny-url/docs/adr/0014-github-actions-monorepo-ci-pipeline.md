# 0014: GitHub Actions Monorepo CI Pipeline with Ephemeral Cluster Testing

We implement an automated Continuous Integration (CI) pipeline using GitHub Actions for the TinyURL system design workspace, featuring path-filtered execution, parallel fast-feedback static/unit verification, and containerized E2E integration testing with strict Resource Budget Profile constraints and anti-log overflow protections.

## Status

Accepted

## Context

The `system-design-practices` repository is structured as a multi-practice monorepo where `tiny-url` contains multiple microservices (`url-service`, `kgs-service`, `analytics-service`), a web frontend (`web`), a shared library (`packages/shared`), and backing infrastructure (PostgreSQL, Redis, Apache Kafka, Nginx CDN, Nginx Load Balancer). 

Without an automated CI pipeline:
1. Regressions in TypeScript compilation across workspaces or breaking changes in shared utilities are only caught manually before merging.
2. Changes to Dockerfile definitions can silently break container image builds.
3. Multi-service integration flows (Edge CDN -> Load Balancer -> URL Service -> PostgreSQL/Redis/Kafka) require manual Docker Compose cluster spinning and verification.
4. Unconstrained workflow triggers in a monorepo would trigger costly full-cluster integration runs even for unrelated directory changes.

## Considered Options

- **Single Monolithic Sequential Job**: Rejected because running full Docker Compose startup, cluster health polling, and containerized tests alongside static analysis on every run introduces high latency (3-5 minutes) for trivial code typos or unit test failures.
- **Mock-Only Integration Testing**: Rejected because validating complex distributed systems behaviors (Kafka click-stream ingestion, Redis Key Buffer depletion, CDN cache hit/miss behavior) against in-memory mocks conceals genuine driver, protocol, or networking bugs.
- **Unconstrained Docker Compose Integration**: Rejected because running cluster containers without CPU/memory limits in shared GitHub Actions runners can cause non-deterministic CFS CPU throttling, out-of-memory (OOM) kills, and test flakiness.
- **Dual-Job Monorepo CI with Resource Profile and Bounded Diagnostics (Selected)**:
  - **Monorepo Path Filtering**: Triggered only on pushes or pull requests affecting `tiny-url/**` or `.github/workflows/tiny-url-ci.yml`.
  - **Concurrency Cancellation**: Cancels superseded runs (`cancel-in-progress: true`) for rapid subsequent commits on the same branch or PR to conserve runner minutes.
  - **Job 1 (`code-quality`)**: Fast (~1 min) execution verifying:
    - Node 20 LTS environment with cached NPM dependencies (`tiny-url/package-lock.json`).
    - Full monorepo TypeScript compilation (`npm run build`).
    - Fast in-memory unit tests (`npm test`).
    - Multi-stage Dockerfile build validation (`docker build` syntax check for services).
  - **Job 2 (`integration-tests`)**: Runs concurrently:
    - Deploys live microservice cluster applying the Resource Budget Profile overlay (`docker compose -f docker-compose.yml -f docker-compose.resources.yml up -d --build`).
    - Ensures total test stack resource allocation remains strictly bounded (~4.3 GB RAM, ~5.5 vCPUs) within the runner's capacity.
    - Probes `http://localhost:8080/health` with bounded retry polling before dispatching `npm run test:integration`.
    - **Anti-Log Overflow Protection**: In the event of a failure (`if: failure()`), collects container logs bounded to `--tail=200` per container with timestamps into `docker-compose-failed.log` and uploads as a 7-day retention artifact, preventing workflow stdout truncation and log flooding.
    - Guarantees complete cluster teardown and volume cleanup (`docker compose down -v`) via `if: always()`.

## Consequences

- Pull requests receive instant (~60s) feedback on code quality, type soundness, and unit tests, while simultaneously verifying distributed end-to-end integration against a live container cluster.
- Prevents GitHub Actions runner resource exhaustion by enforcing the established Resource Budget Profile (`docker-compose.resources.yml`).
- Failures in distributed components (e.g. Kafka startup timeouts or database connectivity) are readily debuggable via compact, bounded diagnostic artifacts without spamming the workflow console output.
