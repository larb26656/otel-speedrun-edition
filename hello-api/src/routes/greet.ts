import { Elysia } from 'elysia'
import { record } from '@elysia/opentelemetry'
import { logger } from '../logger'

export const greetRoutes = new Elysia({ name: 'greet-routes' }).get(
	'/greet/:name',
	function greet({ params }) {
		logger.info({ foo: 'bar' }, `greeting ${params.name}`)
		return record('format-greeting', () => `Hello, ${params.name}!`)
	}
)
