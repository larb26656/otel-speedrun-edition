#!/usr/bin/env python3
"""Dump spans ใน trace นึงจาก Tempo — ใช้กับ: make trace ID=<trace_id>"""
import json
import sys
import urllib.request

TRACE_ID = sys.argv[1] if len(sys.argv) > 1 else None
if not TRACE_ID:
    sys.exit("usage: dump-trace.py <trace_id>")

url = f"http://localhost:3000/api/datasources/proxy/uid/tempo/api/traces/{TRACE_ID}"
with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"})) as r:
    d = json.load(r)

for b in d.get("batches", []):
    svc = next(
        (a["value"]["stringValue"] for a in b["resource"]["attributes"] if a["key"] == "service.name"),
        "?",
    )
    for ss in b.get("scopeSpans", []):
        for s in ss.get("spans", []):
            st = s.get("status", {})
            mark = "ERROR" if "ERROR" in st.get("code", "") else "ok  "
            msg = f" | {st['message']}" if st.get("message") else ""
            print(f"{svc:12} | {s['name']:28} | {mark}{msg}")
