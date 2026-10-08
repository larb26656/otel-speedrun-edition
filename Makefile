.PHONY: up down logs open app dev stop-app traffic slow error chaos chaos-traffic traces loki metrics push-log

up:
	docker compose up -d

down:
	docker compose down

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
