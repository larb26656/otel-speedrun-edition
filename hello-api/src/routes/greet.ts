import { Elysia } from 'elysia'
import { record } from '@elysia/opentelemetry'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { logger } from '../logger'

export const greetRoutes = new Elysia({ name: 'greet-routes' }).get(
	'/greet/:name',
	function greet({ params }) {
		logger.emit({
			severityText: 'INFO',
			severityNumber: SeverityNumber.INFO,
			body: `greeting ${params.name}`
		})
		return record('format-greeting', () => `Hello, ${params.name}!`)
	}
)
