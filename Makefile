.PHONY: up down logs open app dev stop-app traffic traces loki push-log

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

push-log:
	@MESSAGE="$(MSG)" LEVEL="$(LEVEL)" JOB="$(JOB)" ./push-test-log.sh
