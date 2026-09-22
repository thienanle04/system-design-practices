# 0004: Kafka Event Streaming with Micro-batching for Analytics

We capture click events asynchronously by publishing them to an Apache Kafka topic partitioned by Short Code, then consume and micro-batch database writes in a background consumer service, rather than synchronously writing click logs to the database during request handling. This guarantees sub-millisecond redirection response times and insulates the relational database from write-amplification spikes.

## Status

Accepted

## Considered Options

- **Synchronous Write in Redirect Handler**: Writing to `url_clicks` directly in the HTTP request cycle adds 10-50ms to redirect latency and introduces database deadlocks under high concurrency.
- **In-Memory Fire-and-Forget Thread Pool**: Low latency, but click events are lost if the Node.js process restarts or crashes during a traffic spike.
- **Kafka KRaft Streaming + Micro-batching Consumer**: Kafka persists click events reliably across 3 partitions keyed by `short_code`. The consumer flushes in micro-batches (e.g., 50 events or 2 seconds), slashing database write transactions by over 90%.

## Consequences

- Analytics metrics in PostgreSQL have a small eventual-consistency delay of 1-2 seconds.
- Single-node Kafka in KRaft mode runs without Zookeeper overhead, keeping local Docker Compose resource usage under 500MB RAM.
