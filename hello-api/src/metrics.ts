import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('hello-elysia')

export const requestTotal = meter.createCounter('http.server.request.total', {
	description: 'Total HTTP requests handled.',
	unit: '{request}'
})

export const errorTotal = meter.createCounter('http.server.request.errors', {
	description: 'Total HTTP responses with status 5xx.',
	unit: '{request}'
})
