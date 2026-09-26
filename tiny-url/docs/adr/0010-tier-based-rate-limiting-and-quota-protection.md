# 0010: Tier-Based Rate Limiting and Quota Protection Against Key Exhaustion

We introduce an `X-API-Key` authentication layer and a two-tier rate limiter (per-minute sliding window and daily link allocation quota via Redis atomic pipeline) guarding `POST /api/v1/urls`. Requests exceeding limits receive `HTTP 429 Too Many Requests`. When the Redis Key Buffer is exhausted under sustained burst write, the service fails fast with `HTTP 503 Service Unavailable` (with `Retry-After: 1`) instead of falling back to random on-the-fly key generation.

## Status

Accepted

## Considered Options

- **Algorithmic On-the-Fly Fallback (`Math.random` / Snowflake)**: Rejected because it invites hash collisions, degrades write latency, breaks Base62 format consistency, and masks resource exhaustion denial-of-service vulnerabilities.
- **Direct Emergency DB Key Claim**: Rejected because flooding PostgreSQL with lock contention under heavy write spikes induces cascading thundering herd outages.
- **Tier-Based Rate Limiting & Quota (Selected)**: Classifies requests into `Guest` (IP-based, 5 req/min, 20 links/day), `Free Account` (`X-API-Key`, 30 req/min, 500 links/day), and `Paid Account` (`X-API-Key`, 300 req/min, 50,000 links/day). Evaluated via $O(1)$ atomic Redis pipelines.

## Consequences

- Anonymous clients cannot exhaust the pre-generated Key Buffer or PostgreSQL storage pool.
- Key Buffer exhaustion cleanly returns `HTTP 503 Service Unavailable` with `Retry-After`, signaling system backpressure.
- URL creation latency overhead is less than 1ms by checking cached API key metadata and pipelining rate limit counters in Redis.
- Standard RFC 6585 headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`) inform clients of their quota and throttle status.
