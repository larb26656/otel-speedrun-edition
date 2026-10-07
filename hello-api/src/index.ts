import { Elysia } from 'elysia'
import { opentelemetry, record } from '@elysia/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'

const app = new Elysia()
	.use(
		opentelemetry({
			serviceName: 'hello-elysia',
			spanProcessors: [
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: 'http://localhost:4318/v1/traces'
					})
				)
			]
		})
	)
	.get('/', () => 'Hello Elysia')
	.get('/greet/:name', function greet({ params }) {
		return record('format-greeting', () => `Hello, ${params.name}!`)
	})
	.listen(3001)

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
