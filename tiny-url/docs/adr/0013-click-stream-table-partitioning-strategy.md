# 0013: Click Stream Table Partitioning Strategy

We establish a declarative Range Partitioning roadmap for the `url_clicks` event table in PostgreSQL by month (`clicked_at`), paired with an immediate Composite Index `(short_code, clicked_at DESC)` to optimize high-throughput click analytics retrieval and data lifecycle retention.

## Status

Accepted

## Considered Options

- **Unpartitioned Table with Single-Column Indexes (Baseline)**: Rejected for long-term production. While adequate for local development and initial workloads, having unpartitioned `url_clicks` with individual indexes on `short_code` and `clicked_at` causes index bloat, expensive sorting during recent click queries (`ORDER BY clicked_at DESC LIMIT 20`), and extremely slow `DELETE` operations during data retention cleanups.
- **Physical Partitioning Migration Immediately (Premature Migration)**: Rejected for current stage. Altering existing local tables and migrations to declarative partitioning requires breaking table recreation (`DROP TABLE` / recreate as `PARTITION BY RANGE`), which disrupts active developer databases and testing fixtures.
- **Immediate Composite Index with Documented Declarative Range Partitioning Roadmap (Selected)**:
  - **Immediate Index Optimization**: Add a composite B-tree index `idx_url_clicks_code_clicked ON url_clicks (short_code, clicked_at DESC)` in `init.sql` and Drizzle ORM schema. This allows queries for recent clicks to scan directly in index order without sorting in memory.
  - **Declarative Range Partitioning Architecture**: For enterprise scale (> 10M events), migrate `url_clicks` to PostgreSQL Native Range Partitioning:
    ```sql
    CREATE TABLE url_clicks (
        id BIGSERIAL,
        short_code VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        browser VARCHAR(50),
        os VARCHAR(50),
        device VARCHAR(50),
        referer TEXT,
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (id, clicked_at)
    ) PARTITION BY RANGE (clicked_at);

    CREATE TABLE url_clicks_y2026m09 PARTITION OF url_clicks
        FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
    ```
  - **Data Retention & Archival**: Old partitions can be dropped via `DROP TABLE url_clicks_y2026m01;` in milliseconds without write locks or table fragmentation, or archived to cold storage / columnar analytical engines (ClickHouse / Parquet).

## Consequences

- Immediate performance boost for the `/api/v1/urls/:code/analytics` endpoint with zero breaking changes to existing data structures.
- Clear, standardized architectural roadmap for scaling PostgreSQL event streaming to hundreds of millions of click events.
- Easy integration with pg_partman or automated cron retention workers when scaling to production.
