# 0002: Edge Caching for Temporary Redirects

We use HTTP `302 Found` status codes with short Edge Cache directives (`Cache-Control: public, s-maxage=30`) rather than permanent redirects (`301 Moved Permanently`) or un-cached redirects. This strikes a balance between shielding the backend origin from viral link spikes and preserving the ongoing fidelity of Kafka click stream analytics.

## Status

Accepted

## Considered Options

- **HTTP 301 Moved Permanently**: Browsers aggressively cache the destination locally indefinitely. Subsequent clicks bypass both edge proxies and backend servers, permanently blinding the analytics pipeline.
- **HTTP 302 Without Edge Caching**: Every single click hits the origin cluster. High click accuracy, but sudden viral traffic spikes directly hammer the application servers and database.
- **HTTP 302 With 30s Edge Cache (`s-maxage=30`)**: Browsers still revalidate via the network, but the Edge Cache absorbs massive bursts for hot links within 30-second windows.

## Consequences

- Viral link traffic is absorbed at the Edge tier with sub-5ms latency and `X-Cache-Status: HIT`.
- Analytics sampling will omit clicks that hit the 30-second Edge Cache window during intense traffic spikes, which is an accepted engineering trade-off for origin survival.
