# LGTM production-oriented stack

This folder runs Grafana, Prometheus, Loki, Tempo, and an OpenTelemetry Collector as separate services with persistent Docker volumes. The root `docker-compose.yml` remains the all-in-one development setup.

## Start

```sh
cd docker-prod
cp .env.example .env
# Edit .env and set a unique, long Grafana password.
docker compose -f compose.yml config
docker compose -f compose.yml up -d
```

Grafana is available at `http://127.0.0.1:3000`. Send OTLP over HTTP to `http://127.0.0.1:4318` (or gRPC to port `4317`). The services use named volumes so their data survives container recreation.

The demo apps can run in this stack too: `docker compose --profile apps up -d --build` (or `make prod-apps` from the repo root). They join the same network and export OTLP to `http://otel-collector:4318` via environment variables only — the images are identical to the ones used by the dev compose file.

Logs support two modes. The default is OTLP push from the apps. To scrape container stdout instead, add `compose.stdout.yml` (`docker compose -f compose.yml -f compose.stdout.yml --profile apps up -d --build`, or `make prod-apps-stdout`): the overlay disables the apps' OTLP log exporters and runs promtail with docker_sd filtered to containers labelled `otel.logs.scrape=true`. Traces and metrics still use OTLP in both modes.

For applications in another Compose project on the same host, use a private shared Docker network and connect the app to it; configure OTLP endpoint as `http://otel-collector:4318`. For a remote app, expose the collector only through a protected network/VPN or an authenticated TLS reverse proxy. Do not bind collector or Grafana publicly without adding network access controls and TLS. For a public Grafana URL, put it behind an HTTPS reverse proxy and change `GRAFANA_BIND` as appropriate.

This is a single-node deployment template, not a highly available or managed-storage setup. Back up the named volumes and review storage sizing, retention, resource limits, upgrades, and network/authentication controls for the target environment. Container image versions are pinned; update them deliberately.
