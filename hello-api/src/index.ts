import { Elysia } from 'elysia'
import { opentelemetry, record } from '@elysia/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'

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
			],
			logRecordProcessors: [
				new BatchLogRecordProcessor(
					new OTLPLogExporter({
						url: 'http://localhost:4318/v1/logs'
					})
				)
			]
		})
	)

const logger = logs.getLogger('hello-elysia')

app
	.get('/', () => 'Hello Elysia')
	.get('/greet/:name', function greet({ params }) {
		logger.emit({
			severityText: 'INFO',
			severityNumber: SeverityNumber.INFO,
			body: `greeting ${params.name}`
		})
		return record('format-greeting', () => `Hello, ${params.name}!`)
	})
	.listen(3001)

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
