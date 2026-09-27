---
name: system-load-audit
description: Run end-to-end load testing, dual-profile benchmarking (Baseline & Emulated WAN), breakpoint stress hunting, and pipeline reconciliation for the TinyURL platform.
---

# System Load & Capacity Audit

Comprehensive harness workflow for running reproducible performance benchmarks, emulating real-world WAN latency, finding system saturation limits, and auditing event pipelines.

## Prerequisites & Resource Budget

Always ensure the target containers run under the deterministic **Resource Budget Profile** ([ADR-0011](../../docs/adr/0011-deterministic-resource-budget-profiling.md)):

```bash
# Start containers with resource limits (0.5 vCPU, 512MB RAM on service nodes)
npm run docker:perf:up
```

Verify active limits before testing:
```bash
docker inspect tinyurl-api-1 --format "vCPU: {{.HostConfig.NanoCpus}}, RAM: {{.HostConfig.Memory}}"
```

---

## Step 1: State Reset

Clear rate-limiting keys to ensure clean initial conditions without residual penalties:

```bash
docker exec tinyurl-redis redis-cli EVAL "for _,k in ipairs(redis.call('keys','ratelimit:*')) do redis.call('del',k) end" 0
```

---

## Step 2: Nominal SLA Verification (Dual Profile)

Execute the 6 architectural scenarios across both network profiles:

### 1. Profile A: Zero-Delay Baseline
```bash
npm run test:load:hotkey       # 01: Edge Cache Saturation (Mock CDN)
npm run test:load:origin       # 02: Fastify + Redis Cache-Aside
npm run test:load:penetration  # 03: Negative Caching Defense (__NOT_FOUND__)
npm run test:load:write        # 04a: Key Buffer LPOP + Postgres Insert
npm run test:load:starvation   # 04b: Key Buffer Burst & 429/503 Backpressure
npm run test:load:mixed        # 05: Mixed 90% Read + 10% Write + Kafka Stream
```

### 2. Profile B: Emulated WAN Latency (tc netem)
```bash
npm run test:load:wan:hotkey
npm run test:load:wan:origin
npm run test:load:wan:penetration
npm run test:load:wan:write
npm run test:load:wan:starvation
npm run test:load:wan:mixed
```

*Note: WAN runner automatically injects 30ms on CDN and 50ms on LB interfaces, and cleans up rules in `finally`.*

---

## Step 3: Pipeline Audit & Reconciliation

Immediately after scenario 05, audit event delivery and Kafka lag:

```bash
npm run test:load:verify
```

**Checklist**:
- Total Consumer Lag must be `0`.
- Aggregated Daily Clicks must equal Raw Click Events in PostgreSQL (100% consistency).

---

## Step 4: Adaptive Breakpoint Stress Hunting

To discover true saturation limits and the CFS throttling knee, ramp up Virtual Users (VUs) on key scenarios:

### 1. Write Throughput Limit (`04a`)
```bash
npm run test:load:write -- 15   # 3x baseline
npm run test:load:write -- 40   # Peak throughput (~4,000 RPS)
npm run test:load:write -- 80   # CFS saturation point (throughput drops, latency increases)
```

### 2. Key Buffer Starvation & KGS Recovery (`04b`)
```bash
npm run test:load:starvation -- 100 # High burst to test buffer drain speed
```

### 3. Mixed Traffic Ceiling (`05`)
```bash
npm run test:load:mixed -- 50   # Medium stress
npm run test:load:mixed -- 120  # Extreme stress (p95 approaches 90ms boundary)
```

**Stop / Breakpoint Criteria**:
- HTTP Failure rate $\ge 5\%$
- Latency $p95 > 1000\text{ms}$
- Container CFS CPU Throttling causing severe degradation.

---

## Step 5: Telemetry & Report Verification

Inspect the automatically generated reports and master index:
- Root index: `tests/load/reports/README.md`
- Scenario history: `tests/load/reports/<scenario-name>/history.md`
- Interactive HTML reports: `tests/load/reports/<scenario-name>/*.html`
