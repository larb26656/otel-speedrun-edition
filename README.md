# Observability Speedrun Learning Path

Stack: `grafana/otel-lgtm` (Grafana + Tempo + Loki + Mimir + OTel Collector ใน container เดียว)

- Grafana UI: http://localhost:3000
- OTLP gRPC: `localhost:4317`
- OTLP HTTP: `http://localhost:4318`

---

## คำสั่งที่เตรียมไว้ (Makefile)

| คำสั่ง | ทำอะไร |
|---|---|
| `make up` / `make down` | เปิด/ปิด LGTM stack |
| `make logs` | ดู container logs |
| `make open` | เปิด Grafana |
| `make app` / `make dev` | รัน hello-api (ปกติ/watch mode) |
| `make traffic` | ยิง request เข้า hello-api ให้เกิด telemetry |
| `make slow` / `make slow MS=800` | route ช้า (span `simulate-db-query`) |
| `make error` | route พัง 500 เสมอ (span `load-user-profile`) |
| `make chaos` / `make chaos P=50 MAXMS=1000` | สุ่ม fail หรือหน่วงเวลา (span `charge-payment`) |
| `make chaos-traffic` / `make chaos-traffic N=50` | ยิง burst เข้า /chaos สร้าง error rate/slow spike ให้ dashboard/alert |
| `make traces` | query trace ล่าสุดจาก Tempo |
| `make loki` | query log ล่าสุดจาก Loki |
| `make metrics` | query request rate ต่อ route จาก Mimir |
| `make push-log` | ยิง test log เข้า Loki โดยตรง |

### order-api (Spring Boot ที่ call ต่อ hello-api — ดู distributed tracing)

| คำสั่ง | ทำอะไร |
|---|---|
| `make order-build` | build order-api jar |
| `make order-app` | build + รัน order-api (:3002) |
| `make stop-order` | หยุด order-api |
| `make order-traffic` / `make order-greet NAME=x` / `make order-slow MS=500` | ยิง request เข้า order-api (บาง route จะไป call hello-api ต่อ) |
| `make checkout` / `make checkout P=30 MAXMS=800` | checkout flow → call hello-api `/chaos` (สุ่ม fail ได้) |
| `make checkout-traffic` / `make checkout-traffic N=50` | burst checkout สร้าง error spike ทั้ง 2 services |
| `make order-traces` | query trace ล่าสุดของ order-api จาก Tempo |
| `make trace ID=<trace_id>` | dump spans ใน trace นั้น (เห็น waterfall แบบ text) |

### ยิง test log เข้า Loki

```bash
# ใช้ค่า default (job=curl-direct, level=info)
make push-log

# override ข้อความ / level / job
make push-log MSG="custom message"
make push-log MSG="oops" LEVEL="error" JOB="my-app"

# เรียก script ตรง ๆ (ใช้ env แทน)
MESSAGE="test error" LEVEL="error" ./push-test-log.sh
LOKI_URL="http://other-host:3100" ./push-test-log.sh
```

query ใน Grafana ด้วย LogQL: `{job="curl-direct"}`

### Metrics ที่ hello-api ส่ง (OTLP → collector → Mimir)

| Metric (ชื่อใน PromQL) | ได้มาจาก | ใช้ทำอะไร |
|---|---|---|
| `http_server_request_duration_seconds_*` (histogram) | auto จาก `@elysia/opentelemetry` | Duration / Rate (มี `_count`) แยกตาม `http_route`, `http_request_method`, `http_response_status_code` |
| `http_server_request_total` (counter) | manual ใน `plugins/http-log.ts` | นับ request รวม |
| `http_server_request_errors_total` (counter) | manual ใน `plugins/http-log.ts` | นับ 5xx |

> เคล็ดลับ: histogram ของ plugin จะส่งออกจริงก็ต่อเมื่อมี `metricReader` ใน `telemetry.ts` (ไม่งั้น meter เป็น no-op) — และ unit `s` จะกลายเป็น suffix `_seconds` ตอนแปลงเป็นชื่อ Prometheus

ตัวอย่าง RED dashboard ด้วย PromQL:

```promql
# Rate — request ต่อวินาที แยกตาม route
sum by (http_route) (rate(http_server_request_duration_seconds_count[1m]))

# Error — 5xx ต่อวินาที
sum by (http_route) (rate(http_server_request_errors_total[1m]))

# Duration — p99 per route
histogram_quantile(0.99, sum by (http_route, le) (rate(http_server_request_duration_seconds_bucket[5m])))
```

> Mimir scrape ทุก ~60s — ยิง traffic แล้วรอสัก 1–2 นาทีค่อย query

---

## order-api — Distributed Tracing ข้าม 2 services (Spring Boot)

`order-api/` — Spring Boot 3 (Java 21, port **3002**) ใช้ **observability stack ของ Spring ล้วน**:

| Signal | อะไรทำงาน | ได้อะไร |
|---|---|---|
| Traces | `micrometer-tracing-bridge-otel` + `opentelemetry-exporter-otlp` | HTTP server/client spans + W3C propagation — ผ่าน Observation API ของ Micrometer |
| Metrics | `spring-boot-starter-actuator` + `micrometer-registry-otlp` | `http.server.request.duration`, JVM/system metrics ฯลฯ export OTLP |
| Logs | `opentelemetry-logback-appender-1.0` + Boot `OpenTelemetryLoggingAutoConfiguration` | log ทุก line แนบ trace_id/span_id ส่งเข้า Loki ผ่าน OTLP |

> Micrometer = facade เดียวที่ให้ทั้ง metric + span จาก `Observation` เดียวกัน (เขียน code ทีเดียวได้ 2 signals) — config ทั้งหมดอยู่ที่ `management.otlp.*` ใน `application.yml`

```
client ──> order-api (:3002, Spring)  ──RestClient──> hello-api (:3001, Elysia)
             POST /checkout                                GET /chaos   (สุ่ม fail)
             GET /orders/{id}?ms=                          GET /slow    (หน่วง)
             GET /greet/{name}                             GET /greet/{name}
```

Trace context (W3C `traceparent`) ถูกแพร่ผ่าน HTTP header อัตโนมัติ — trace เดียวเห็นครบทั้ง 2 services:

```bash
make order-app                                  # รัน order-api (ต้องรัน hello-api ก่อน)
make checkout                                   # success path
make checkout P=100                             # ให้ hello-api fail ทุกครั้ง (error propagation)
make order-traces                               # เอา trace ID ล่าสุด
make trace ID=<trace_id>                        # ดู spans ใน trace
```

ตัวอย่าง output ของ `make trace` ตอน payment fail — คนร้าย (`charge-payment`) โดนตั้ง ERROR พร้อม exception message:

```
order-api    | http get                     | ERROR | 500 Internal Server Error: "simulated failure: payment gateway timeout"
order-api    | order.checkout               | ERROR | payment gateway failed with 500 INTERNAL_SERVER_ERROR
order-api    | http post /checkout          | ok    |   ← 502 กลับ client
hello-elysia | GET /chaos                   | ERROR |
hello-elysia | charge-payment               | ERROR | simulated failure: payment gateway timeout
```

ของที่ควรลองดู:

- **Trace waterfall ข้าม service**: ใน Grafana → Explore → Tempo เปิด trace ของ `POST /checkout` จะเห็น span ของทั้ง `order-api` และ `hello-elysia` ต่อกันในแถวเดียว
- **Error propagation**: `make checkout P=100` แล้วดูว่า error status วิ่งกลับมาทั้ง chain
- **Log correlation**: log ของ order-api มี `[order-api,<traceId>,<spanId>]` ต่อท้าย level (จาก MDC — Micrometer ใช้ key แบบ camelCase) — คลิกจาก span ใน Tempo หา log ของ request นั้นได้ทั้ง 2 services
- **TraceQL หา cross-service**: `{ resource.service.name = "order-api" } && { name = "charge-payment" }`
- **Observation API**: span มือ (`order.checkout` ฯลฯ) สร้างจาก `Observation.createNotStarted(...)` ใน `OrderService` — Micrometer สร้างทั้ง span และ timer metric (`order_checkout_milliseconds_*`) จากอันเดียวกัน

ความต่างที่เจอตอนใช้ Spring-native (เทียบกับ OTel starter / ฝั่ง hello-api):

- **ชื่อ span**: Micrometer ตั้งชื่อ lowercase (`http post /checkout`) ส่วน OTel/JS เป็น `POST /checkout`
- **Span status ตอน 5xx ที่ handler จบเอง**: `http post /checkout` ตอบ 502 ผ่าน `@RestControllerAdvice` โดยไม่มี exception หลุดออกมา → root span ไม่ถูกตั้ง ERROR (มีแค่ tag `error`) — ต่างจาก OTel semconv ที่ map 5xx → ERROR เสมอ ใช้ TraceQL `{ status = error }` จะยังเจอ trace ผ่าน span ลูก (`order.checkout`, `charge-payment`) ที่ ERROR จริง
- **ชื่อ metric**: server side ใช้ OTel convention เหมือนกัน (`http.server.request.duration` → `http_server_request_duration_seconds_*`) query RED เดิมใช้ได้เลย แต่ client side เป็น `http.client.requests` (milliseconds)
- **Metrics เพิ่มมาฟรี**: `jvm_*`, `executor_*`, `disk_*`, `application_ready_time_*` จาก Micrometer binders ของ Actuator

Metrics ที่ starter ส่งอัตโนมัติ (OTLP → Mimir): `http_server_request_duration_seconds_*` (แยกตาม `http_route`), JVM metrics (`jvm_memory_used_bytes` ฯลฯ) — ใช้ PromQL เดิมได้เลย



> **ของจริงควรยิงทางไหน?** `push-test-log.sh` ใช้ **Loki push API ตรง ๆ** (format `streams`/`values` — ไม่ใช่ OTel) เหมาะกับการ smoke test ว่า Loki รับของได้ ส่วน app จริงควรยิง **OTLP** เข้า `:4318` ให้ collector แปลงให้ — ได้ vendor-neutral + trace correlation + batching/retry ฟรี

### References

**ทางตรง (Loki push API — ที่ script นี้ใช้):**
- [Loki HTTP API — Ingest logs](https://grafana.com/docs/loki/latest/reference/api/#ingest-logs) — spec ของ `POST /loki/api/v1/push` + JSON format `streams`/`values`
- [Loki HTTP API — Timestamps](https://grafana.com/docs/loki/latest/reference/api/#timestamps) — ทำไม timestamp ต้องส่งเป็น string (ส่งเป็น number จะโดน 400)

**ทาง OTel (สิ่งที่ app จริงควรใช้):**
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/) — protocol spec: OTLP/HTTP port 4318, path `/v1/logs`, JSON encoding (`resourceLogs` → `scopeLogs` → `logRecords`)
- [OTLP JSON request examples](https://github.com/open-telemetry/opentelemetry-proto/tree/main/examples/) — ตัวอย่าง payload จริงของแต่ละ signal
- [Ingest logs to Loki with OTel Collector](https://grafana.com/docs/loki/latest/send-data/otel/) — Loki รับ OTLP ตรงที่ `/otlp/v1/logs` + กฎการ map attribute (เช่น `service.name` → label `service_name` ใน Loki ซึ่งเห็นใน `make loki`)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/) — SDK/instrumentation สำหรับ JS (hello-api ใช้ทางนี้)

---

## Stage 0 — เห็นของจริงก่อน (30 นาที)

- `docker compose up -d`
- รัน [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo) ชี้ `OTEL_EXPORTER_OTLP_ENDPOINT` มาที่ LGTM
- ดูข้อมูลไหลเข้าใน Explore → Tempo (traces), Loki (logs), Mimir (metrics)
- อ่าน trace waterfall 1 ชุดให้รู้เรื่อง (แต่ละ span คืออะไร)

**เป้าหมาย:** เห็นภาพรวมว่า telemetry ทั้ง 3 signal หน้าตาเป็นยังไง

## Stage 1 — Instrument มือเอง (1–2 ชม.)

- เขียน app ง่าย ๆ ภาษาที่ถนัด + OTel SDK
- ติดตั้ง auto-instrumentation (HTTP request → ได้ trace ฟรี)
- สร้าง manual span ใน business logic
- Export ไป `http://localhost:4318` (OTLP/HTTP)

**เป้าหมาย:** เห็น trace ของ app ตัวเองใน Tempo

## Stage 2 — สร้างปัญหา แล้วตามรอย (1 ชม.) — core skill

Route จำลองปัญหาพร้อมใช้แล้ว (span คนร้ายอยู่ใน waterfall):

| Route | พฤติกรรม | คนร้าย |
|---|---|---|
| `GET /slow?ms=800` | หน่วง `ms` millisec (default 300, สูงสุด 10000) | span `simulate-db-query` |
| `GET /error` | โยน exception → 500 | span `load-user-profile` (มี exception event) |
| `GET /chaos?p=30&maxMs=800` | สุ่ม fail `p%` ไม่งั้นหน่วง 0–`maxMs` | span `charge-payment` |

- ใช้ TraceQL หา slow/error trace เช่น `{ duration > 300ms }`, `{ status = error }`, `{ name = "simulate-db-query" && duration > 500ms }`
- ชี้ span คนร้ายจาก waterfall
- แก้แล้ว verify ว่า trace กลับมาปกติ

**เป้าหมาย:** symptom → root cause ด้วย trace

## Stage 3 — Logs correlation (1 ชม.)

- ส่ง logs ผ่าน OTLP ด้วย OTel logger appender ของภาษานั้น
- แนบ `trace_id` / `span_id` ในทุก log line อัตโนมัติ
- คลิกจาก span ใน Tempo → ดู logs ของ request นั้น
- ย้อนกลับ: หา trace จาก log ด้วย LogQL

**เป้าหมาย:** กระโดดสลับไปมา between traces ↔ logs

## Stage 4 — Metrics + Dashboard (1–2 ชม.)

- เพิ่ม counter (requests total, errors total)
- เพิ่ม histogram (request duration)
- ทำ dashboard แบบ RED (Rate / Error / Duration) ด้วย PromQL
- เปิด exemplars: คลิกจาก spike ใน graph → กระโดดไป trace

**เป้าหมาย:** dashboard ที่ตอบได้ว่า service แข็งแรงไหม + จุดเชื่อมไปหา trace

## Stage 5 — Alerting (1 ชม.)

- ตั้ง Grafana alert rule (error rate สูง, p99 latency ช้า)
- ทำ SLO + burn rate alert ง่าย ๆ
- ทดสอบว่า alert ยิงจริงตอนทำ service พัง

**เป้าหมาย:** รู้ปัญหาก่อน user บอก

---

## ต่อยอด (ถ้าอยากไปต่อ)

- Pyroscope — continuous profiling (CPU/memory flame graph)
- Tail sampling — ประหยัด cost ใน production
- OTel Operator — เติม instrumentation อัตโนมัติบน Kubernetes
- Grafana SLO / error budget แบบเต็มรูปแบบ

## แหล่งเรียน

- [OpenTelemetry Docs](https://opentelemetry.io/docs/) — instrumentation ตามภาษา
- [Grafana Docs](https://grafana.com/docs/) — Tempo/TraceQL, Loki/LogQL, Mimir/PromQL
- [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo) — microservices สำเร็จรูปสำหรับทดลอง
