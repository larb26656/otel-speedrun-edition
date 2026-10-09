# k8s split: apps + Alloy in Kubernetes, LGTM stays on Docker

```
minikube                                  Docker host (unchanged)
┌───────────────────────────────┐         ┌──────────────────────────┐
│ hello-api ─┐                  │         │                          │
│            ├─► alloy:4318 ────┼──OTLP──►│ lgtm (collector 4317)    │
│ order-api ─┘       │          │         │   ├─► Tempo              │
│                    └─scrape───┼─Loki───►│ loki:3100 ◄── docker lgtm│
│  pod stdout        pod logs   │  push   │ Grafana :3000            │
└───────────────────────────────┘         └──────────────────────────┘
```

- **Apps** (`hello-api`, `order-api`) และ **Alloy** deploy บน minikube (namespace `observability`)
- **Backend (Loki/Tempo/Prometheus/Grafana/collector) คง docker เดิมทั้งหมด** — ใช้ `make up` (dev all-in-one) รันไว้ก่อน
- Alloy คือ agent ใน cluster: รับ OTLP จาก apps แล้ว forward ไป collector บน docker host + scrape pod stdout ด้วย `discovery.kubernetes` (กรองด้วย label `otel.logs.scrape=true` เหมือน promtail ใน docker) push ไป Loki บน docker host ผ่าน `host.minikube.internal`
- โหมด log เหมือนเดิม: default = stdout (ปิด OTLP log export ที่ apps) ถ้าจะเปลี่ยนเป็น push mode ลบ env `OTEL_LOGS_EXPORTER=none` (hello-api) กับ `MANAGEMENT_OTLP_LOGGING_EXPORT_ENABLED=false` (order-api) ใน `apps.yml` — Alloy route log ให้อยู่แล้ว

## ใช้งาน

```bash
make up            # 1. LGTM บน docker (dev all-in-one) ต้องรันอยู่ก่อน
make k8s-build     # 2. build + โหลด image เข้า minikube
make k8s-up        # 3. deploy apps + alloy
make k8s-apps      # 4. port-forward 3001/3002 (รันไว้ใน terminal แยก)
make traffic order-traffic   # 5. ยิง traffic
```

ดูผลที่ Grafana docker เดิม: http://localhost:3000 — หรือใช้ `make traces loki metrics` ได้เลยเหมือนตอน apps รันบน host

หมายเหตุ:
- dev all-in-one publish `0.0.0.0` อยู่แล้วจึง reach ได้จากใน cluster; ถ้าใช้ `docker-prod` ต้องตั้ง `OTEL_BIND=0.0.0.0` และ publish `3100` ของ Loki เพิ่ม
- สำหรับ cluster จริง เปลี่ยน `host.minikube.internal` ใน `alloy.yml` เป็น endpoint ที่ reach ได้ (เช่น collector ที่มี TLS/auth ด้านหน้า)
- ใน cluster จริงควรรัน Alloy เป็น DaemonSet (log) + gateway แยกสำหรับ OTLP — ที่นี่ใช้ single Deployment เพราะเป็น local demo
