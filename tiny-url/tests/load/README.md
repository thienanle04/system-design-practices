# TinyURL Performance Testing & Benchmark Suite

Bộ công cụ kiểm thử hiệu năng phân tán (Distributed Load Testing Harness) dành cho hệ thống TinyURL, được xây dựng dựa trên **Grafana k6** chạy hoàn toàn trong mạng Docker Compose (`tiny-url_default`). 

Bộ công cụ này đo lường năng lực chịu tải của từng tầng kiến trúc riêng biệt (Edge Cache, Load Balancer, Service Nodes, Redis Cache-Aside, Key Buffer, Kafka Event Streaming và PostgreSQL), tích hợp cơ chế **xuất báo cáo HTML/JSON không bị ghi đè** và **script đối soát dữ liệu pipeline** theo quyết định [ADR-0007](../../docs/adr/0007-containerized-load-testing-and-pipeline-reconciliation.md).

---

## 🏛️ Kiến Trúc Thực Thi (Test Execution Topology)

```mermaid
flowchart TD
    subgraph Test Engine
        K6["k6 Container (grafana/k6:latest)"]
    end

    subgraph Docker Network: tiny-url_default
        CDN["Mock CDN Edge (http://mock-cdn)"]
        LB["Load Balancer (http://load-balancer)"]
        API1["url-service-1:3000"]
        API2["url-service-2:3000"]
        Redis["Redis (Cache & Key Buffer)"]
        Postgres[("PostgreSQL")]
        Kafka["Kafka Broker (Topic: url-clicks)"]
        Analytics["Analytics Consumer"]
    end

    K6 -- "Scenarios 01, 05 (HTTP 302 Edge)" --> CDN
    K6 -- "Scenarios 02, 03, 04a, 04b (Bypass CDN)" --> LB
    CDN -- "Cache Miss" --> LB
    LB --> API1 & API2
    API1 & API2 --> Redis
    API1 & API2 --> Postgres
    API1 & API2 -.->|"Async Click Events"| Kafka
    Kafka --> Analytics --> Postgres

    K6 -- "Mount Volumes" --> Reports["tests/load/reports/<br/>• Benchmark Master Index (README.md)<br/>• Scenario Subdirectories"]
```

---

## ⚡ Bảng Ánh Xạ Kiến Trúc (Architecture & ADR Mapping)

Mỗi kịch bản kiểm thử đóng vai trò là bằng chứng thực nghiệm trực tiếp (Living Evidence) kiểm chứng các quyết định thiết kế đã được tài liệu hóa:

| Kịch bản | Lệnh thực thi | Target Ingress | Tầng kiến trúc kiểm thử | Quyết định ADR liên quan |
|---|---|---|---|---|
| **01-hotkey-cache-hit** | `npm run test:load:hotkey` | Mock CDN (`:80`) | Nginx Edge Caching (HTTP 302, `s-maxage=30`) | [ADR-0002](../../docs/adr/0002-edge-caching-for-temporary-redirects.md) |
| **02-origin-cache-miss** | `npm run test:load:origin` | Load Balancer (`:80`) | Fastify Service Nodes + Redis URL Cache-Aside | [ADR-0006](../../docs/adr/0006-sse-and-snapshot-caching-for-observability.md) |
| **03-cache-penetration** | `npm run test:load:penetration` | Load Balancer (`:80`) | Redis Negative Cache (`__NOT_FOUND__`) | [ADR-0003](../../docs/adr/0003-negative-caching-for-penetration-prevention.md) |
| **04a-write-steady** | `npm run test:load:write` | Load Balancer (`:80`) | Key Buffer `LPOP` + Postgres URL Insertion | [ADR-0001](../../docs/adr/0001-offline-key-pre-generation.md) |
| **04b-write-starvation** | `npm run test:load:starvation` | Load Balancer (`:80`) | Key Buffer Starvation & KGS Self-Healing | [ADR-0001](../../docs/adr/0001-offline-key-pre-generation.md), [ADR-0006](../../docs/adr/0006-sse-and-snapshot-caching-for-observability.md) |
| **05-mixed-pipeline** | `npm run test:load:mixed` | CDN + LB | 90% Read + 10% Write + Kafka Event Stream | [ADR-0004](../../docs/adr/0004-kafka-event-streaming-for-click-analytics.md) |
| **Pipeline Audit** | `npm run test:load:verify` | Docker host | Kafka Consumer Lag & Postgres Click Counts | [ADR-0007](../../docs/adr/0007-containerized-load-testing-and-pipeline-reconciliation.md) |

### 🌐 Mô Hình Kiểm Thử Hai Chế Độ (Dual-Profile Architecture - ADR-0009)

Hệ thống hỗ trợ 2 profile hiệu năng độc lập theo [ADR-0009](../../docs/adr/0009-dual-profile-performance-testing-and-wan-emulation.md), được hiệu chuẩn theo **Nominal Capacity Envelope** ([ADR-0011](../../docs/adr/0011-deterministic-resource-budget-profiling.md)):

1. **Profile A (Baseline - Mặc định)**: Không có trễ mạng nhân tạo. Số VUs và SLA được cân chỉnh theo ngân sách `0.5 vCPU` để đo lường hiệu năng thực chất, tránh hiện tượng CFS CPU Throttling làm méo mó đuôi p95/p99:

| Kịch bản Baseline (Profile A) | Lệnh thực thi | Target Ingress | VUs Peak | Ngưỡng SLA Baseline (`p95` / `p99`) |
|---|---|---|---|---|
| **01-hotkey-cache-hit** | `npm run test:load:hotkey` | Mock CDN | 40 | `p(95) < 10ms`, `p(99) < 25ms` |
| **02-origin-cache-miss** | `npm run test:load:origin` | Load Balancer | 50 | `p(95) < 40ms`, `p(99) < 70ms` |
| **03-cache-penetration** | `npm run test:load:penetration` | Load Balancer | 40 | `p(95) < 25ms`, `p(99) < 50ms` |
| **04a-write-steady** | `npm run test:load:write` | Load Balancer | 20 | `p(95) < 120ms`, `p(99) < 250ms` |
| **04b-write-starvation** | `npm run test:load:starvation` | Load Balancer | 80 | `p(95) < 350ms` |
| **05-mixed-pipeline** | `npm run test:load:mixed` | CDN + LB | 40 | `p(95) < 90ms`, `p(99) < 220ms` |

2. **Profile B (Emulated WAN)**: Sử dụng Linux kernel traffic shaping (`tc netem`) để tiêm độ trễ mạng thực tế:
   - **Client $\leftrightarrow$ Edge Cache**: 30ms ($\pm$5ms jitter) trên interface `tinyurl-cdn`.
   - **Edge Cache $\leftrightarrow$ Origin**: 50ms ($\pm$10ms jitter) trên interface `tinyurl-lb`.
   - Vòng đời được tự động hóa hoàn toàn: runner tiêm rule trước khi k6 chạy và tự động dọn sạch trong khối `finally`.

| Kịch bản WAN (Profile B) | Lệnh thực thi | Target Ingress | VUs Peak | Ngưỡng SLA WAN (`p95` / `p99`) |
|---|---|---|---|---|
| **01-hotkey-cache-hit (WAN)** | `npm run test:load:wan:hotkey` | Mock CDN | 120 | `p(95) < 70ms`, `p(99) < 85ms` |
| **02-origin-cache-miss (WAN)** | `npm run test:load:wan:origin` | Load Balancer | 150 | `p(95) < 200ms`, `p(99) < 250ms` |
| **03-cache-penetration (WAN)** | `npm run test:load:wan:penetration` | Load Balancer | 120 | `p(95) < 90ms`, `p(99) < 120ms` |
| **04a-write-steady (WAN)** | `npm run test:load:wan:write` | Load Balancer | 60 | `p(95) < 220ms`, `p(99) < 300ms` |
| **04b-write-starvation (WAN)** | `npm run test:load:wan:starvation` | Load Balancer | 180 | `p(95) < 450ms` |
| **05-mixed-pipeline (WAN)** | `npm run test:load:wan:mixed` | CDN + LB | 120 | `p(95) < 200ms`, `p(99) < 280ms` |

> [!TIP]
> **Quy mô Concurrency động theo Định luật Little (Little's Law)**:
> Khi kích hoạt Profile WAN, hệ thống tự động scale số VUs tối đa từ 40 lên **120 VUs** để giữ hàng trăm kết nối mở đồng thời (High Connection Holding Time). Bạn có thể tùy biến mức tải này theo 2 cách:
> ```bash
> # Cách 1 (Khuyên dùng - chạy trên cả PowerShell và Bash):
> npm run test:load:wan:hotkey -- 200
>
> # Cách 2 (Qua biến môi trường):
> # Trên Windows PowerShell:
> $env:VUS=200; npm run test:load:wan:hotkey
> # Trên Linux / macOS Bash:
> VUS=200 npm run test:load:wan:hotkey
> ```

### ⚖️ Hồ Sơ Ngân Sách Tài Nguyên (Resource Budget Profile - ADR-0011)

Để đảm bảo kết quả benchmark diễn ra **khách quan, có thể tái lập (reproducible)** và không phụ thuộc vào số core CPU hay dung lượng RAM khác nhau giữa các máy dev / CI, hệ thống cung cấp file overlay [docker-compose.resources.yml](../../docker-compose.resources.yml) theo [ADR-0011](../../docs/adr/0011-deterministic-resource-budget-profiling.md).

#### Phân bổ định mức vCPU và Memory:
- **Gateway & CDN**: `mock-cdn` (0.5 vCPU, 256MB), `load-balancer` (0.5 vCPU, 256MB).
- **Compute Services**: `url-service-1` (0.5 vCPU, 512MB), `url-service-2` (0.5 vCPU, 512MB), `kgs-service` (0.5 vCPU, 256MB), `analytics-service` (0.5 vCPU, 512MB).
- **Datastores**: `redis` (0.5 vCPU, 256MB), `postgres` (1.0 vCPU, 512MB), `kafka` (1.0 vCPU, 1024MB).
- **k6 Load Generator**: Không giới hạn (unconstrained) để tránh client-side bottleneck làm lệch kết quả đo.
- **Tổng ngân sách stack**: `~5.5 vCPU` và `~4GB RAM` (hoạt động an toàn trên Windows WSL2 và Linux CI).

#### Lệnh khởi chạy:
```bash
# Khởi động hệ thống với Resource Budget Profile (Khuyên dùng khi đo hiệu năng):
npm run docker:perf:up

# Dừng stack:
npm run docker:perf:down
```

Khi chạy benchmark qua `npm run test:load:*` hoặc `npm run test:load:wan:*`, test runner sẽ tự động kiểm tra `HostConfig.NanoCpus` và hiển thị trạng thái `[Resource Budget Profile: ACTIVE]`.

---

## 🎯 Phân Tích Chuyên Sâu Các Kịch Bản (Scenario Deep-Dive)

### 1. `01-hotkey-cache-hit.js` — Edge Cache Saturation
- **Mục tiêu**: Đo trần thông lượng tối đa của tầng Edge Cache (Mock CDN Nginx) khi link trở nên viral.
- **Cơ chế**:
  - `setup()`: Gọi API tạo 1 Short URL mới và gửi 1 request đầu tiên để prime cache (`X-Cache-Status: MISS`).
  - VUs: Bắn tải 100 VUs liên tục trong 25 giây nhắm vào `http://mock-cdn/{code}` với cờ `{ redirects: 0 }`.
  - Kiểm tra (Checks): Header `X-Cache-Status === 'HIT'`, HTTP Status 302, Header `Location` hợp lệ.
- **Baseline thực nghiệm**:
  - **Throughput**: `~96,400 req/s`
  - **Latency p95**: `1.68 ms` | **Tỷ lệ lỗi**: `0.00%`

### 2. `02-origin-cache-miss.js` — Origin Fastify & Cache-Aside Benchmark
- **Mục tiêu**: Bỏ qua hoàn toàn Edge CDN để ép tải trực tiếp vào Load Balancer nội bộ và 2 Service Nodes (`url-service-1`, `url-service-2`), kiểm tra tầng đệm Redis Cache-Aside.
- **Cơ chế**:
  - `setup()`: Tạo trước 50 Short URL ngẫu nhiên và lưu vào danh sách `codes`.
  - VUs: 150 VUs bốc ngẫu nhiên Short Code từ pool để gọi `http://load-balancer/{code}`.
  - Kiểm tra (Checks): HTTP Status 302, Header `X-Server-Instance` hiện diện (xác nhận Round-Robin hoạt động).

### 3. `03-cache-penetration.js` — Cache Penetration Defense
- **Mục tiêu**: Mô phỏng cuộc tấn công dò quét hàng loạt Short Code không tồn tại nhằm làm tê liệt cơ sở dữ liệu PostgreSQL.
- **Cơ chế**:
  - Bắn một tập lặp lại gồm các mã rác (`ghost_key_*`).
  - Lần truy vấn đầu tiên tìm kiếm trong DB không thấy và ghi nhận giá trị `__NOT_FOUND__` vào Redis với TTL 60s.
  - Hàng trăm nghìn request tiếp theo bị chặn đứng ngay tại Redis trong vài mili-giây mà không sinh câu lệnh `SELECT` xuống PostgreSQL.
- **Baseline thực nghiệm**:
  - **Throughput**: `~20,100 req/s`
  - **Latency p95**: `6.03 ms` | **Lỗi 5xx Database**: `0.00%`

### 4. `04a-write-steady.js` — Steady-State Short URL Creation
- **Mục tiêu**: Đo thông lượng tạo Short URL ổn định (`POST /api/v1/urls`) khi **Key Buffer** trong Redis luôn ở trạng thái dồi dào.
- **Cơ chế**:
  - 40 VUs đồng thời gửi payload URL duy nhất.
  - URL Service thực hiện atomic `LPOP` từ Redis `kgs:available_keys` $O(1)$ và insert vào PostgreSQL `urls`.
- **Baseline thực nghiệm**:
  - **Throughput**: `~3,200 req/s` (tạo hơn 80.000 link trong 25 giây)
  - **Latency p95**: `10.26 ms` | **Tỷ lệ lỗi**: `0.00%`

### 5. `04b-write-starvation.js` — Key Buffer Exhaustion & Resilience
- **Mục tiêu**: Bắn tải ghi cực hạn với 120 VUs nhằm rút cạn Key Buffer nhanh hơn chu kỳ nạp 5 giây của KGS Worker, kiểm chứng khả năng tự phục hồi (Self-Healing).
- **Cơ chế**:
  - Khi Key Buffer Depth tụt về 0, URL Service chuyển sang cơ chế fallback sinh chuỗi ngẫu nhiên an toàn mà không làm sập API.
  - `teardown()`: Tự động truy vấn `/api/v1/system/status` để kiểm tra trạng thái phục hồi của KGS Worker.
- **Baseline thực nghiệm**:
  - **Throughput**: `~3,000 req/s`
  - **Hậu kiểm**: KGS tự động kích hoạt `SELECT ... FOR UPDATE SKIP LOCKED` và nạp bù đầy đủ trở lại `~5,000 keys` trong Redis.

### 6. `05-mixed-pipeline-stress.js` — Real-world Traffic & Event Streaming
- **Mục tiêu**: Mô phỏng lưu lượng thực tế theo tỷ lệ **90% Đọc (Redirect) + 10% Ghi (Tạo URL)**, đồng thời đẩy hàng chục nghìn Click Events vào Kafka Broker.
- **Cơ chế**:
  - 10% request tạo link mới qua Load Balancer.
  - 90% request redirect qua Mock CDN kèm User-Agent ngẫu nhiên, kích hoạt `publishClickEvent()` vào Kafka topic `url-clicks`.

---

## 📊 Hệ Thống Báo Cáo Không Bị Ghi Đè (Immutable Reporting)

Mỗi lần thực thi k6, hệ thống **không bao giờ ghi đè** lên kết quả cũ. Thay vào đó:

1. **Báo cáo Giao diện HTML Độc Lập**:
   - Được lưu tại `tests/load/reports/<scenario>/<scenario>-<timestamp>.html`.
   - Tự chứa 100% (nhúng inline CSS, font, không phụ thuộc internet).
   - Hiển thị các thẻ chỉ số KPI, phân phối chi tiết độ trễ HTTP (`min`, `p50`, `avg`, `p90`, `p95`, `p99`, `max`), tỷ lệ lỗi và danh sách Assertions.

2. **Báo cáo Dữ liệu JSON Raw**:
   - Được lưu tại `tests/load/reports/<scenario>/<scenario>-<timestamp>.json`.
   - Chứa toàn bộ time-series metrics dùng cho việc vẽ biểu đồ hoặc import vào các công cụ phân tích khác.

3. **Lịch Sử Kiểm Thử Riêng Biệt Từng Kịch Bản (Scenario Benchmark History)**:
   - Được lưu tại `tests/load/reports/<scenario>/history.md`.
   - Mỗi kịch bản sở hữu một bảng lịch sử chuyên biệt, cô lập các lần chạy và so sánh trực tiếp cả hai cấu hình `BASELINE` và `WAN` của riêng kịch bản đó mà không bị pha lẫn với các bài test khác.

4. **Bảng Điều Phối Trung Tâm ([Benchmark Master Index](./reports/README.md))**:
   - Được duy trì tự động tại [tests/load/reports/README.md](./reports/README.md) theo [ADR-0012](../../docs/adr/0012-per-scenario-performance-reports-and-benchmark-indexing.md).
   - Tự động hiển thị snapshot lần chạy gần nhất của **Latest Baseline** và **Latest WAN** cho mọi kịch bản, đóng vai trò executive dashboard toàn diện cho cả test harness.

---

## 🔍 Đối Soát Pipeline & Khử Lag Kafka (`npm run test:load:verify`)

Sau khi chạy các bài test Read hoặc Mixed Workload, hàng chục nghìn Click Events được chuyển vào Kafka. Để kiểm tra xem Analytics Consumer có bị thất thoát dữ liệu hoặc tích tụ độ trễ (Lag) hay không, hãy chạy:

```bash
npm run test:load:verify
```

### Script thực hiện các kiểm tra:
1. **Kiểm tra PostgreSQL**: Đếm tổng số Short URLs trong bảng `urls`, tổng số sự kiện thô trong `url_clicks`, và tổng số click đã được gom nhóm tổng hợp trong `url_analytics_daily`.
2. **Kiểm tra Redis Key Buffer**: Kiểm tra độ sâu `Key Buffer Depth` hiện có trong danh sách `kgs:available_keys`.
3. **Kiểm tra Kafka Consumer Lag**: Gọi trực tiếp công cụ `kafka-consumer-groups.sh` bên trong container `tinyurl-kafka`, kiểm tra Lag trên từng partition (0, 1, 2) của topic `url-clicks` thuộc nhóm `analytics-consumer-group`.

**Mẫu kết quả chuẩn (Tất cả hàng đợi đã xả sạch và dữ liệu nhất quán 100%)**:
```
================================================================================
🔍 PIPELINE DATA RECONCILIATION & LAG AUDIT
================================================================================

📊 DATABASE & STORAGE AUDIT
--------------------------------------------------------------------------------
Total Short URLs in DB      : 80,029
Raw Click Events Recorded   : 21
Aggregated Daily Clicks     : 21
Current Key Buffer Depth    : 5,000 keys

⚡ KAFKA CONSUMER LAG AUDIT (Topic: url-clicks, Group: analytics-consumer-group)
--------------------------------------------------------------------------------
Partition 0 : Current=8  | LogEnd=8  | Lag=0
Partition 1 : Current=12 | LogEnd=12 | Lag=0
Partition 2 : Current=1  | LogEnd=1  | Lag=0
--------------------------------------------------------------------------------
Total Consumer Lag : 0 pending events

🛡️  INTEGRITY VERIFICATION RESULT
--------------------------------------------------------------------------------
Pipeline Queue Drained (Lag = 0)       : ✅ PASS
Analytics Aggregation Consistency     : ✅ CONSISTENT
================================================================================
```

---

## 🚀 Hướng Dẫn Vận Hành Nhanh (Quick Start)

### 1. Khởi động toàn bộ cụm TinyURL:
```bash
docker compose up -d
```

### 2. Chạy từng kịch bản kiểm thử:
```bash
# Kiểm tra Edge Cache Hit
npm run test:load:hotkey

# Kiểm tra Origin Fastify & Redis Cache-Aside
npm run test:load:origin

# Kiểm tra Phòng thủ Thâm nhập Cache (Negative Caching)
npm run test:load:penetration

# Kiểm tra Tạo Short URL Ổn định
npm run test:load:write

# Kiểm tra Cạn kiệt Key Buffer & Khả năng Tự phục hồi
npm run test:load:starvation

# Kiểm tra Lưu lượng Hỗn hợp Thực tế & Kafka Streaming
npm run test:load:mixed
```

### 3. Kiểm tra tính toàn vẹn dữ liệu:
```bash
npm run test:load:verify
```

### 4. Xem báo cáo & Lịch sử kiểm thử:
- Truy cập [Benchmark Master Index](./reports/README.md) để xem bảng điều phối tổng thể và snapshot mới nhất (cả Baseline và WAN) của tất cả kịch bản.
- Mở trực tiếp các file `.html` trong từng thư mục kịch bản `tests/load/reports/<scenario>/` trên trình duyệt để phân tích:
  - **Khối thông số bài test (Test Specification & Workload Profile)**: Điểm tiếp nhận tải (Target Ingress), tầng kiến trúc kiểm thử, mã ADR đối chiếu, các giai đoạn tải (Stages/VUs), thời lượng chạy và phân loại tải.
  - **Bảng đối soát tiêu chuẩn SLA (SLA & Threshold Criteria)**: Trạng thái Đạt/Vi phạm (`PASS` / `VIOLATED`) của từng ngưỡng hiệu năng (`p95`, `p99`, `fail_rate`).
  - Biểu đồ phân phối độ trễ và các chỉ số đo lường chi tiết.
- File `tests/load/reports/<scenario>/history.md` tự động lập chỉ mục lịch sử chạy của riêng kịch bản đó với đầy đủ các cột: `Timestamp`, `Profile`, `Target`, `Duration`, `VUs Max`, `Total Reqs`, `Throughput (RPS)`, `Latency Avg`, `Latency p95`, `Latency p99`, `Latency Max`, `Fail Rate`, `SLA Status`, `Report File`.

