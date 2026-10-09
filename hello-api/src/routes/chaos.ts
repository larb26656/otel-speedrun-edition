import { Elysia } from 'elysia'
import { record } from '@elysia/opentelemetry'
import { logger } from '../logger'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const clampNumber = (raw: string | undefined, fallback: number, min: number, max: number) => {
	const parsed = Number(raw)
	if (!Number.isFinite(parsed)) return fallback
	return Math.min(Math.max(parsed, min), max)
}

export const chaosRoutes = new Elysia({ name: 'chaos-routes' })
	.get(
		'/slow',
		async function slow({ query }) {
			const ms = clampNumber(query?.ms, 300, 1, 10_000)
			await record('simulate-db-query', async (span) => {
				span.setAttribute('delay.ms', ms)
				await sleep(ms)
			})
			return { slowedMs: ms }
		}
	)
	.get(
		'/error',
		function error() {
			return record('load-user-profile', () => {
				throw new Error('simulated failure: user database unavailable')
			})
		}
	)
	.get(
		'/chaos',
		async function chaos({ query }) {
			const failRate = clampNumber(query?.p, 30, 0, 100) / 100
			const maxMs = clampNumber(query?.maxMs, 800, 1, 10_000)
			const roll = Math.random()

			if (roll < failRate) {
				logger.error(
					`chaos: injecting failure (roll=${roll.toFixed(3)} < p=${failRate})`
				)
				return record('charge-payment', () => {
					throw new Error('simulated failure: payment gateway timeout')
				})
			}

			const ms = Math.round(Math.random() * maxMs)
			await record('charge-payment', async (span) => {
				span.setAttribute('delay.ms', ms)
				await sleep(ms)
			})
			return { ok: true, ms }
		}
	)
