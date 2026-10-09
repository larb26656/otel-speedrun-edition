import { Elysia } from 'elysia'
import {
	ATTR_HTTP_REQUEST_METHOD,
	ATTR_HTTP_RESPONSE_STATUS_CODE,
	ATTR_HTTP_ROUTE,
	ATTR_URL_PATH
} from '@opentelemetry/semantic-conventions'
import { logger } from '../logger'
import { requestTotal, errorTotal } from '../metrics'

const requestStart = new WeakMap<Request, number>()

const levelFor = (status: number): 'info' | 'warn' | 'error' =>
	status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

export const httpLog = new Elysia({ name: 'http-log' })
	.onRequest(function markRequestStart({ request }) {
		requestStart.set(request, performance.now())
	})
	.onAfterResponse(
		{ as: 'global' },
		function logHttpRequest({ request, path, route, set }) {
			const status = typeof set.status === 'number' ? set.status : 200
			const start = requestStart.get(request)
			const metricAttributes = {
				[ATTR_HTTP_REQUEST_METHOD]: request.method,
				[ATTR_HTTP_ROUTE]: route ?? path,
				[ATTR_HTTP_RESPONSE_STATUS_CODE]: status
			}

			requestTotal.add(1, metricAttributes)
			if (status >= 500) errorTotal.add(1, metricAttributes)

			logger[levelFor(status)](
				{
					[ATTR_HTTP_REQUEST_METHOD]: request.method,
					[ATTR_URL_PATH]: path,
					[ATTR_HTTP_ROUTE]: route ?? path,
					[ATTR_HTTP_RESPONSE_STATUS_CODE]: status,
					...(start !== undefined && {
						'http.request.duration_ms': Number(
							(performance.now() - start).toFixed(2)
						)
					})
				},
				`${request.method} ${path} ${status}`
			)
		}
	)
