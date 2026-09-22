# 0003: Negative Caching for Cache Penetration Prevention

When a requested Short Code does not exist in the database, we cache a sentinel negative value (`"__NOT_FOUND__"`) in Redis with a short 60-second TTL rather than leaving it un-cached or maintaining a Redis Bloom filter. This prevents malicious or malformed lookup attacks from causing cache penetration and overwhelming the primary database.

## Status

Accepted

## Considered Options

- **No Negative Caching**: Repeated requests for invalid codes continuously miss the cache and hit PostgreSQL, risking database starvation under scan/brute-force attacks.
- **Redis Bloom Filter (`BF.EXISTS`)**: High memory efficiency for set membership, but requires compiling/loading the proprietary RedisBloom C module and handling false positives and deletions.
- **Negative Caching with Short TTL**: Storing `"__NOT_FOUND__"` for 60s requires zero additional native dependencies and instantly blocks repeated misses at the cache layer.

## Consequences

- If a newly created Custom Alias matches a recently queried non-existent code, there is a maximum propagation window of 60 seconds unless explicitly evicted upon creation.
- Protects database connection pools against massive scans of non-existent keys.
