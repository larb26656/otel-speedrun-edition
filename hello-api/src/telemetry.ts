import { opentelemetry } from '@elysia/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'

export const telemetry = opentelemetry({
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
	],
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
			url: 'http://localhost:4318/v1/metrics'
		}),
		exportIntervalMillis: 5000
	}),
})
