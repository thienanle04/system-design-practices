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

### Key Generation & Allocation

**Pre-generated Key**:
An unused, pre-computed alphanumeric token stored in reserve to be assigned as a Short Code.
_Avoid_: Seed token, pool key, raw key

**Key Buffer**:
An in-memory or fast-access queue of Pre-generated Keys ready for immediate allocation without database locks.
_Avoid_: Token cache, key cache

### Traffic & Analytics

**Click Event**:
An immutable record of a client accessing a Short URL prior to redirection.
_Avoid_: Visit, hit, pageview, tap

**Edge Cache**:
A caching proxy deployed at the network perimeter that serves cached redirection responses without hitting origin servers.
_Avoid_: CDN cache, reverse cache
