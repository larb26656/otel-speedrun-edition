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
