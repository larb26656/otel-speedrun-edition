import { opentelemetry } from '@elysia/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'

const logsExportDisabled = process.env.OTEL_LOGS_EXPORTER === 'none'

export const telemetry = opentelemetry({
	serviceName: 'hello-elysia',
	spanProcessors: [
		new BatchSpanProcessor(
			new OTLPTraceExporter({
				url: `${otlpEndpoint}/v1/traces`
			})
		)
	],
	...(logsExportDisabled
		? {}
		: {
				logRecordProcessors: [
					new BatchLogRecordProcessor(
						new OTLPLogExporter({
							url: `${otlpEndpoint}/v1/logs`
						})
					)
				]
			}),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
				url: `${otlpEndpoint}/v1/metrics`
		}),
		exportIntervalMillis: 5000
	}),
})
