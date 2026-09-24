# 0006: Server-Sent Events and Snapshot Caching for Real-Time Observability

We use Server-Sent Events (SSE) backed by a Redis Pub/Sub event bus for live Click Event streaming to the Dashboard, and aggregate platform telemetry into a cached Redis health snapshot every 5 seconds instead of polling full-duplex WebSockets or probing dependencies on every incoming client request. This keeps proxy infrastructure simple across Edge CDN and Load Balancer layers while preventing cascading health check load.

## Status

Accepted

## Considered Options

- **Full-Duplex WebSockets**: Setup WebSocket connections from browser clients to Fastify nodes. Rejected due to additional proxy upgrade configuration required on both Mock CDN and Load Balancer, connection state tracking across distributed instances, and the fact that click notifications and telemetry flow strictly unidirectionally (Server to Client).
- **Client-Driven Short Polling for All Telemetry**: Dashboard polls REST endpoints every 1-2 seconds for both click streams and health checks. Rejected because high-frequency polling introduces unnecessary HTTP overhead, latency in receiving clicks, and risks thundering-herd load on backend services.
- **Server-Sent Events (SSE) with Redis Pub/Sub & Snapshot Caching**: Dashboard establishes an SSE stream (`/api/v1/events/live`) for click stream events. Nodes forward incoming clicks to a lightweight Redis Pub/Sub channel (`channel:live_clicks`), fanning out to all active SSE subscribers across multiple Service Nodes. A dedicated background probe captures component health (Postgres, Redis, Kafka, Key Buffer Depth, Service Node heartbeats) and writes a pre-computed JSON snapshot to Redis with a 5-second TTL.

## Consequences

- The browser receives real-time click notifications with sub-second latency using native browser `EventSource`.
- Nginx CDN and Load Balancer proxy SSE traffic cleanly with `proxy_buffering off;` and `X-Accel-Buffering: no` without requiring WebSocket upgrades.
- Multiple dashboard administrators querying `/api/v1/system/status` read the cached snapshot directly from Redis in sub-millisecond time, avoiding cascading probe spikes to PostgreSQL and Kafka.
- SSE requires persistent HTTP connections; in containerized environments, keepalive timeouts and browser reconnection logic are handled naturally by SSE specifications.
