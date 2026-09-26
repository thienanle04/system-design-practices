# URL Shortener

A high-throughput distributed system that creates compact URL aliases, resolves redirects at low latency, and captures click stream analytics.

## Language

### Core Entities

**Short URL**:
A compact web address that resolves and redirects a client to a Target URL.
_Avoid_: Tiny URL, shortened link, mini link

**Short Code**:
The unique alphanumeric identifier segment within a Short URL that maps to the Target URL.
_Avoid_: Slug, token, hash, key (when referring to the public identifier)

**Target URL**:
The original, full destination web address that a Short URL redirects to.
_Avoid_: Long URL, original URL, destination URL

**Custom Alias**:
A user-specified Short Code chosen explicitly in place of a machine-generated code.
_Avoid_: Vanity URL, custom slug, vanity code

**Link Expiration**:
The predefined timestamp after which a Short URL ceases to redirect and becomes inactive.
_Avoid_: Link TTL, dead link, timeout

**Reserved Short Code**:
A predefined, protected Short Code reserved for system routes and operational endpoints that cannot be allocated or claimed as a Custom Alias.
_Avoid_: Blacklisted alias, banned slug, system path

**Deactivated Link**:
A Short URL that has been disabled by an operator, halting redirection and returning an HTTP 410 Gone response while retaining historical Click Events.
_Avoid_: Deleted link, dead URL, killed alias

### Key Generation & Allocation

**Pre-generated Key**:
A unique, pre-computed alphanumeric token stored in reserve to be assigned as a Short Code.
_Avoid_: Seed token, pool key, raw key

**Key Buffer**:
An in-memory or fast-access queue of Pre-generated Keys ready for immediate allocation without database locks.
_Avoid_: Token cache, key cache

### Client Entitlements & Rate Limiting

**Account Tier**:
The entitlement level (`Guest`, `Free Account`, `Paid Account`) assigned to a client determining creation rate limits and daily link allocation quotas.
_Avoid_: User level, subscription plan, client type

**Creation Rate Limit**:
The sliding time-window threshold governing how many Short URLs a client can create per minute to protect the Key Buffer.
_Avoid_: Request throttle, write velocity limit, write rate

**Daily Link Quota**:
The cumulative maximum count of Short URLs a client may allocate within a calendar day.
_Avoid_: Link allowance, key ceiling, daily cap

### Traffic & Analytics

**Click Event**:
An immutable record of a client accessing a Short URL prior to redirection.
_Avoid_: Visit, hit, pageview, tap

**Click Velocity**:
The rate of incoming Click Events measured over a sliding time window (e.g. clicks per second).
_Avoid_: Click speed, hit rate, traffic pulse

**Edge Cache**:
A caching proxy deployed at the network perimeter that serves cached redirection responses without hitting origin servers.
_Avoid_: CDN cache, reverse cache

### System Observability & Health

**System Health Status**:
The computed operational condition of the overall platform or an individual dependency (`Operational`, `Degraded`, `Outage`).
_Avoid_: System state, ping status, uptime tag

**Service Node**:
An individual container or runtime instance of an application service (e.g. `url-service-1`, `url-service-2`).
_Avoid_: Pod, worker container, cluster box

**Key Buffer Depth**:
The total count of ready-to-assign Pre-generated Keys currently stocked in the fast-access buffer (Redis).
_Avoid_: Key inventory, pool size, cache count

### Performance & Reliability Testing

**Baseline Performance Profile**:
The zero-synthetic-latency benchmarking mode used to verify raw application throughput and identify code or database regressions.
_Avoid_: Localhost test, zero-delay benchmark, bare test

**Emulated WAN Latency**:
Synthetic network round-trip delay and jitter injected at the network interface layer to model realistic Internet edge and backbone transit times.
_Avoid_: Simulated lag, network delay mock, artificial delay

**Connection Holding Time**:
The duration over which a TCP or HTTP connection remains open during request-response cycles under network transit delay, stressing concurrency limits and connection pools.
_Avoid_: Socket duration, connection retention, idle window

**Resource Budget Profile**:
A deterministic allocation of vCPU compute quotas and memory limits assigned to Service Nodes and backing datastores to ensure reproducible and objective performance benchmarks.
_Avoid_: Hardware cap, container throttling config, resource clamp, machine sizing

**Nominal Capacity Envelope**:
The bounded concurrency and request throughput range within which a Service Node consistently satisfies SLA thresholds under a Resource Budget Profile without triggering CFS CPU throttling.
_Avoid_: Safe load, average traffic, soft cap, normal load

**Scenario Benchmark History**:
An isolated, sequential record of performance benchmark runs and SLA verification for a specific test scenario over time.
_Avoid_: Scenario log, test history file, benchmark dump

**Benchmark Master Index**:
The centralized index and executive dashboard at the root of the performance reports directory, summarizing the latest benchmark run across all scenarios and linking to individual scenario histories.
_Avoid_: Central history, master log, root report


