Status: ready-for-agent

# Specification: Distributed URL Shortener System

## Problem Statement

Users and client applications require a reliable, high-throughput service to convert long, unwieldy Target URLs into compact Short URLs. Under heavy traffic spikes and viral link usage, naive implementations suffer from database lock contention during token generation, slow redirection latency, vulnerability to cache penetration attacks from random non-existent keys, and high database write amplification caused by synchronous click logging. Furthermore, engineers studying and testing distributed system patterns need a reproducible, self-contained local environment that accurately simulates real-world tiered infrastructure—including Edge Caching, Load Balancing, Key Generation Services, in-memory caching, and asynchronous event streaming.

## Solution

A containerized distributed URL Shortener system running entirely via Docker Compose, architected with realistic production tiers:
1. An **Edge Cache** (simulating a CDN) that serves static frontend assets, absorbs viral redirect traffic with HTTP 302 caching and exposes cache hit/miss status.
2. An internal **Load Balancer** that distributes requests across multiple application server instances using round-robin scheduling.
3. An independent **Key Generation Service (KGS)** that pre-computes unique Base62 tokens offline in PostgreSQL and continuously replenishes a fast-access in-memory **Key Buffer** in Redis to guarantee $O(1)$ collision-free key allocation.
4. An application tier supporting both machine-generated Short Codes and user-defined Custom Aliases, optional Link Expiration, and Cache-Aside lookup with negative caching against cache penetration.
5. An asynchronous event-driven **Analytics Pipeline** using Apache Kafka (KRaft mode) and a micro-batching consumer that tracks Click Events without degrading redirect latency.
6. An interactive **Web Dashboard** (React + Tailwind CSS) enabling users to create links, inspect redirect headers, test edge latency, and view real-time click metrics.

---

## User Stories

1. As a user, I want to paste a long Target URL into a web form, so that I receive a compact Short URL that is easy to share.
2. As a user, I want to specify an optional Custom Alias for my Short URL, so that the link is memorable and branded.
3. As a user, I want the system to reject a Custom Alias if it is already in use, so that existing link mappings are never accidentally overwritten.
4. As a user, I want the system to validate that my Custom Alias contains only URL-safe alphanumeric characters, hyphens, and underscores, so that the link behaves predictably across all web clients.
5. As a user, I want to set an optional Link Expiration date on my Short URL, so that the link automatically deactivates after a designated time window.
6. As a user, I want to access a Short URL in my browser or HTTP client and be immediately redirected via HTTP 302 to the Target URL, so that I reach the destination quickly.
7. As a user, I want an expired Short URL to return an HTTP 410 Gone or 404 Not Found error, so that I know the link is no longer valid.
8. As a user, I want to copy the generated Short URL to my clipboard with a single click in the web dashboard, so that I can easily distribute it.
9. As a systems engineer, I want short link redirects to be temporarily cached at the Edge Cache with HTTP 302 responses, so that subsequent viral clicks do not overwhelm the application origin servers.
10. As a systems engineer, I want the Edge Cache to return an `X-Cache-Status` response header indicating `HIT` or `MISS`, so that I can observe and verify edge caching behavior locally.
11. As a systems engineer, I want the internal Load Balancer to round-robin incoming requests across multiple URL Service replicas, so that server load is evenly distributed.
12. As a systems engineer, I want the response to include an `X-Server-Instance` header identifying which application replica served the request, so that I can verify load balancing distribution.
13. As a systems engineer, I want the system to protect PostgreSQL against cache penetration by caching non-existent Short Code lookups with a short TTL, so that malicious scanning cannot starve database resources.
14. As a systems engineer, I want the Key Generation Service to run as a separate autonomous worker that pre-generates unique 7-character Base62 keys in batches, so that the URL creation path never blocks on random collisions or database write locks.
15. As a systems engineer, I want the Key Generation Service to monitor the Redis Key Buffer and automatically replenish it when the available key count drops below a threshold, so that the system never runs out of available keys.
16. As an analytics viewer, I want every click on an active Short URL to asynchronously record a Click Event with timestamp, IP, User-Agent, and Referer, so that I can track engagement without adding latency to the redirect.
17. As an analytics viewer, I want the Analytics Consumer to batch Click Events before writing to PostgreSQL, so that database write operations remain efficient during traffic surges.
18. As an analytics viewer, I want to query the analytics endpoint or dashboard for a given Short Code, so that I can view total click counts, daily click trends, and breakdowns by browser and device type.
19. As a developer, I want to launch the entire multi-service stack with a single `docker compose up` command, so that I can run, test, and demonstrate the full system locally without manual setup.
20. As a developer, I want all backend services and consumers to communicate cleanly using shared type definitions and database schemas, so that contracts remain consistent across services.

---

## Implementation Decisions

### Architectural Topology

- **Edge Tier (Mock CDN)**: A dedicated Nginx container acting as the primary perimeter entrypoint on host port `8080`. It serves compiled static Single-Page Application assets from disk, proxies `/api/` directly to the Load Balancer without caching, and proxies Short Code redirects `/{short_code}` to the Load Balancer with an active `proxy_cache` (caching 302/307 redirects for 30 seconds as decided in ADR-0002).
- **Load Balancing Tier**: An internal Nginx container routing traffic across two replicas of the URL Shortener service (`url-service-1` and `url-service-2`) using round-robin load balancing. It sets `X-Server-Instance` for observability.
- **Application Tier (URL Service)**: Fastify-based TypeScript service instances providing REST endpoints for URL creation, link resolution, and analytics retrieval.
- **Key Generation Service (KGS)**: An autonomous background daemon that ensures a pool of pre-generated 7-character Base62 keys exists in PostgreSQL with status `AVAILABLE`. When the Redis list `kgs:available_keys` drops below 1,000 keys, KGS atomically claims a batch of 5,000 keys using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` and pushes them into Redis (`RPUSH`).
- **Caching & Key Buffer Tier**: Redis container maintaining:
  - `kgs:available_keys`: List of Pre-generated Keys allocated for immediate assignment (`LPOP`).
  - `url:{short_code}`: Cached Target URL mappings with a 24-hour TTL (Cache-Aside).
  - `url:{short_code}` = `"__NOT_FOUND__"`: Negative cache sentinel with a 60-second TTL to defend against cache penetration (ADR-0003).
- **Event Streaming & Analytics Tier**: Single-node Apache Kafka running in KRaft mode (no Zookeeper). The URL Service publishes a Click Event to topic `url-clicks` (3 partitions, keyed by `short_code`) asynchronously on every non-cached redirect. A dedicated Analytics Consumer micro-batches events (flushing every 50 events or 2 seconds) and bulk-upserts metrics into PostgreSQL (ADR-0004).
- **Storage Tier**: PostgreSQL 16 maintaining tables for `urls`, `kgs_keys`, `url_clicks`, and `url_analytics_daily`, accessed via Drizzle ORM.
- **Client Presentation Tier**: React Single-Page Application with Tailwind CSS and Lucide icons, built into static assets and served by the Edge Cache Nginx container.

### Module Contracts & APIs

- **URL Creation**: `POST /api/v1/urls`
  - Input: `{ original_url: string, custom_alias?: string, expires_in_days?: number }`
  - Output: `{ short_code: string, short_url: string, original_url: string, is_custom: boolean, expires_at: string | null, created_at: string }`
  - Behavior: If `custom_alias` provided, validate regex `^[a-zA-Z0-9_-]{3,30}$` and verify non-existence in `urls`. If not provided, fetch next key via Redis `LPOP kgs:available_keys`. Insert into `urls` and warm `url:{short_code}` in Redis.
- **URL Redirection**: `GET /{short_code}`
  - Output: HTTP `302 Found` with `Location: <target_url>`, `Cache-Control: public, s-maxage=30`.
  - Edge Cases:
    - Code is `"__NOT_FOUND__"` in Redis -> return `404 Not Found`.
    - Code in Redis has expired timestamp -> return `410 Gone`.
    - Code not in Redis -> query PostgreSQL. If absent, set Redis `"__NOT_FOUND__"` (TTL 60s) and return `404`. If present, write to Redis and proceed.
    - On valid redirect: asynchronously dispatch Click Event to Kafka topic `url-clicks`.
- **Analytics Retrieval**: `GET /api/v1/urls/{short_code}/analytics`
  - Output: `{ short_code: string, total_clicks: number, daily_clicks: [{ date: string, clicks: number }], browsers: [{ browser: string, count: number }], devices: [{ device: string, count: number }], recent_clicks: [...] }`
- **Health Check**: `GET /health` -> `{ status: "ok", timestamp: string }`

---

## Testing Decisions

- **Primary Seam (External HTTP at Edge)**:
  - All automated black-box acceptance tests run against `http://localhost:8080`.
  - Testing at this highest possible boundary verifies the entire chain: Client -> Edge Cache (Nginx) -> Load Balancer (Nginx) -> Fastify App -> Redis -> PostgreSQL and Kafka.
- **Edge Caching Verification**:
  - Sending initial `GET /{short_code}` must yield `X-Cache-Status: MISS` with HTTP 302.
  - Sending identical `GET /{short_code}` within 30 seconds must yield `X-Cache-Status: HIT` with response time under 10ms.
- **Load Balancing Verification**:
  - Sequential requests to `GET /health` or `POST /api/v1/urls` must alternate the `X-Server-Instance` header between the two upstream application replicas.
- **Negative Caching Verification**:
  - Requesting an invalid Short Code (e.g. `GET /invalid_key_999`) must return HTTP 404 on first request, and inspect Redis to verify `"__NOT_FOUND__"` is stored with TTL <= 60s.
- **KGS Autonomous Pool Verification**:
  - Inspecting Redis list length `LLEN kgs:available_keys` after service boot must verify that keys have been pre-allocated without human intervention.
- **Analytics Ingestion Verification**:
  - Performing repeated clicks on a Short URL must verify that the consumer ingests Kafka events, flushes micro-batches, and increments `url_analytics_daily` counts.

---

## Out of Scope

- Multi-region Geo-DNS routing and BGP Anycast routing (simulated via single-machine local Docker Compose).
- User authentication, account management, and multi-tenancy (URLs are created anonymously).
- QR code generation and link password protection.
- Distributed tracing (Jaeger/Zipkin) and APM monitoring.

---

## Further Notes

- Single command startup: `docker compose up -d --build`.
- All environment variables are documented with clear defaults in `.env.example`.
- Architectural decisions adhere strictly to `ADR-0001` (KGS), `ADR-0002` (Edge Caching 302), `ADR-0003` (Negative Caching), and `ADR-0004` (Kafka Streaming Analytics).
- Vocabulary follows [`CONTEXT.md`](file:///c:/Code/system-design-practices/tiny-url/CONTEXT.md).
