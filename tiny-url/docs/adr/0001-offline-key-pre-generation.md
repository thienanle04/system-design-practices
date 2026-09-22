# 0001: Offline Key Pre-generation (KGS)

We pre-generate unique 7-character Base62 keys offline via a background Key Generation Service (KGS), store them in PostgreSQL, and replenish a Redis list buffer instead of generating keys on-the-fly or computing MD5/SHA256 hashes at request time. This avoids write collisions, eliminates database lock contention under high concurrent creation load, and guarantees $O(1)$ token allocation latency.

## Status

Accepted

## Considered Options

- **On-the-fly Hash + Collision Resolution**: Hash the Target URL (e.g. MD5/MurmurHash) and take 7 chars. Rejected because hash collisions require sequential database lookups and retries, significantly degrading write latency under scale.
- **Distributed Snowflake ID**: Generate 64-bit numeric IDs on the fly and encode to Base62. Rejected because sequential/timestamp-based IDs can be guessed/enumerated, and does not demonstrate the dedicated Key Generation Service (KGS) pattern.
- **Offline Pre-generation with Redis Buffer**: Generate random Base62 tokens in batches, mark them `AVAILABLE` in PostgreSQL, and asynchronously push batches into a Redis list `kgs:available_keys`.

## Consequences

- URL creation instances simply issue atomic `LPOP` from Redis with zero database write locks.
- If Redis keys run low, KGS auto-replenishes using `SELECT ... FOR UPDATE SKIP LOCKED` to safely allocate keys across distributed instances.
- Pre-generated keys consume database disk space (~a few megabytes for hundreds of thousands of keys), which is negligible.
