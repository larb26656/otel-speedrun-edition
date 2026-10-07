# Observability Speedrun Learning Path

Stack: `grafana/otel-lgtm` (Grafana + Tempo + Loki + Mimir + OTel Collector ใน container เดียว)

- Grafana UI: http://localhost:3000
- OTLP gRPC: `localhost:4317`
- OTLP HTTP: `http://localhost:4318`

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

- แอบใส่ `sleep(200ms)` หรือ random error ใน 1 function
- ใช้ TraceQL หา slow/error trace เช่น `{ duration > 200ms }`
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
