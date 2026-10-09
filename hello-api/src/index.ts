import { Elysia } from 'elysia'
import { telemetry } from './telemetry'
import { httpLog } from './plugins/http-log'
import { greetRoutes } from './routes/greet'
import { chaosRoutes } from './routes/chaos'

const app = new Elysia()
	.use(telemetry)
	.use(httpLog)
	.get('/', () => 'Hello Elysia')
	.use(greetRoutes)
	.use(chaosRoutes)
	.listen({ hostname: '0.0.0.0', port: 3001 })

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
