# 0005: Reserved Namespaces and Soft Deactivation Policy

We protect operational and client application routes using a strict reserved keyword registry at the edge and API layers, and adopt a soft deactivation lifecycle (`HTTP 410 Gone`) for Short URLs instead of hard row deletions. This eliminates routing collisions with single-segment Short URL redirection paths while preserving click telemetry and analytics integrity across the distributed pipeline.

## Status

Accepted

## Considered Options

- **Mandatory Redirection Prefix (`/r/:code`)**: Force all Short URLs to live under `/r/`. Rejected because brief root-level URLs (`/:code`) are a core requirement of short link user experience.
- **Hash-based Client Routing (`/#/dashboard`)**: Use URL fragment identifiers for SPA views. Rejected because hash URLs are visually undesirable, problematic for analytics tracking, and leak client routing concerns.
- **Hard Deletions**: Deleting rows from `urls` and cascading deletions into `url_clicks`. Rejected because it irreversibly destroys historical business analytics, breaks Kafka event log lineage, and returns ambiguous 404 Not Found to clients.
- **Reserved Namespaces with Soft Deactivation**:
  - Reserved keywords (`dashboard`, `admin`, `api`, `health`, `metrics`, `static`, `assets`, `favicon.ico`, `r`, `docs`) blocked from Custom Alias allocation with a forbidden error.
  - Nginx priority rule for `/dashboard` routing directly to the SPA bundle.
  - Soft deactivation (`is_active = false`) returning HTTP 410 Gone with immediate Redis cache eviction and negative caching.

## Consequences

- Frontend routes like `/dashboard` and backend services (`/api/`, `/health`) can safely coexist at the root domain without Short Code conflicts.
- Deactivating a link retains all historical Kafka click metrics and daily aggregate charts for auditing and business reporting.
- Redirection requests for deactivated Short URLs bypass PostgreSQL once negative-cached in Redis, preventing database strain on high-traffic revoked links.
