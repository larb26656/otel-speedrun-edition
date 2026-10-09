.PHONY: up down logs open app dev stop-app traffic slow error chaos chaos-traffic traces loki metrics push-log \
	order-build order-app stop-order order-traffic order-greet order-slow checkout checkout-traffic order-traces trace \
	prod prod-apps prod-down prod-logs up-stdout prod-apps-stdout

up:
	docker compose up -d

down:
	docker compose -f docker-compose.yml -f docker-compose.stdout.yml down --remove-orphans

logs:
	docker compose logs -f lgtm

open:
	open http://localhost:3000

app:
	cd hello-api && bun src/index.ts

dev:
	cd hello-api && bun --watch src/index.ts

stop-app:
	kill $$(lsof -ti :3001)

traffic:
	@curl -s localhost:3001/ && echo
	@curl -s localhost:3001/greet/luckytime && echo

slow:
	@curl -s 'localhost:3001/slow?ms=$(MS)' && echo

error:
	@curl -s localhost:3001/error && echo

chaos:
	@curl -s 'localhost:3001/chaos?p=$(P)&maxMs=$(MAXMS)' && echo

chaos-traffic:
	@for i in $$(seq 1 $(N)); do curl -s 'localhost:3001/chaos?p=30&maxMs=800' > /dev/null; done
	@echo "fired $(N) chaos requests (p=30 maxMs=800)"

traces:
	@curl -s -G http://localhost:3000/api/datasources/proxy/uid/tempo/api/search \
		--data-urlencode 'q={ resource.service.name = "hello-elysia" }' \
		--data-urlencode 'limit=5' \
	| python3 -c "import json,sys; [print(t['traceID'], t['rootServiceName'], t['rootTraceName']) for t in json.load(sys.stdin)['traces']]"

loki:
	@curl -s -G http://localhost:3000/api/datasources/proxy/uid/loki/loki/api/v1/query_range \
		--data-urlencode 'query={service_name="hello-elysia"}' \
		--data-urlencode 'limit=5' \
	| python3 -c "import json,sys; [print(ts, line) for r in json.load(sys.stdin)['data']['result'] for ts, line in r['values']]"

metrics:
	@curl -s -G http://localhost:3000/api/datasources/proxy/uid/prometheus/api/v1/query \
		--data-urlencode 'query=sum by (http_route) (rate(http_server_request_duration_seconds_count[1m]))' \
	| python3 -c "import json,sys; [print(round(float(r['value'][1]), 3), '/'.join(filter(None, [r['metric'].get('http_route','')]))) for r in json.load(sys.stdin)['data']['result']]"

push-log:
	@MESSAGE="$(MSG)" LEVEL="$(LEVEL)" JOB="$(JOB)" ./push-test-log.sh

# ---------- order-api (Spring Boot, :3002 — calls hello-api) ----------

order-build:
	cd order-api && mvn -q package -DskipTests

order-app: order-build
	java -jar order-api/target/order-api-0.0.1-SNAPSHOT.jar

stop-order:
	kill $$(lsof -ti :3002)

order-traffic:
	@curl -s localhost:3002/ && echo
	@curl -s localhost:3002/greet/$(if $(NAME),$(NAME),luckytime) && echo
	@curl -s 'localhost:3002/orders/42?ms=500' && echo
	@curl -s -X POST 'localhost:3002/checkout?p=0&maxMs=300' && echo

order-greet:
	@curl -s localhost:3002/greet/$(if $(NAME),$(NAME),luckytime) && echo

order-slow:
	@curl -s 'localhost:3002/orders/42?ms=$(MS)' && echo

checkout:
	@curl -s -X POST 'localhost:3002/checkout?p=$(P)&maxMs=$(MAXMS)' && echo

checkout-traffic:
	@for i in $$(seq 1 $(N)); do curl -s -X POST 'localhost:3002/checkout?p=30&maxMs=800' > /dev/null; done
	@echo "fired $(N) checkout requests (p=30 maxMs=800) — error spike จะเห็นทั้ง order-api และ hello-api"

order-traces:
	@curl -s -G http://localhost:3000/api/datasources/proxy/uid/tempo/api/search \
		--data-urlencode 'q={ resource.service.name = "order-api" }' \
		--data-urlencode 'limit=5' \
	| python3 -c "import json,sys; [print(t['traceID'], t['rootServiceName'], t['rootTraceName']) for t in json.load(sys.stdin)['traces']]"

trace:
	@python3 dump-trace.py $(ID)

# ---------- prod stack (docker-prod — split services + apps profile) ----------

prod:
	cd docker-prod && docker compose up -d

prod-apps:
	cd docker-prod && docker compose --profile apps up -d --build

prod-down:
	cd docker-prod && docker compose -f compose.yml -f compose.stdout.yml --profile apps down --remove-orphans

prod-logs:
	cd docker-prod && docker compose logs -f hello-api order-api

# ---------- stdout log mode (promtail scrapes container stdout, OTLP log export off) ----------

up-stdout:
	docker compose -f docker-compose.yml -f docker-compose.stdout.yml up -d

prod-apps-stdout:
	cd docker-prod && docker compose -f compose.yml -f compose.stdout.yml --profile apps up -d --build
