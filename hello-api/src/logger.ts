import { Writable } from 'node:stream'
import pino from 'pino'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import type { LogAttributes, LogRecord } from '@opentelemetry/api-logs'

const otelLogger = logs.getLogger('hello-elysia')

const SEVERITY = {
	10: { text: 'TRACE', number: SeverityNumber.TRACE },
	20: { text: 'DEBUG', number: SeverityNumber.DEBUG },
	30: { text: 'INFO', number: SeverityNumber.INFO },
	40: { text: 'WARN', number: SeverityNumber.WARN },
	50: { text: 'ERROR', number: SeverityNumber.ERROR },
	60: { text: 'FATAL', number: SeverityNumber.FATAL }
} as const

const toAttributeValue = (value: unknown): string | number | boolean => {
	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	)
		return value
	return JSON.stringify(value)
}

const toMilliseconds = (time: unknown): number =>
	typeof time === 'number' && Number.isFinite(time) ? time : Date.now()

// Bridges pino output to the OTel Logs API. Emitting in-process (not via a
// worker-thread transport) keeps context.active() available, so every record
// is stamped with the current trace_id/span_id automatically.
const otelStream = new Writable({
	write(chunk, _encoding, callback) {
		try {
			const { level, time, name, pid, hostname, msg, ...fields } =
				JSON.parse(chunk.toString())

			const severity =
				SEVERITY[level as keyof typeof SEVERITY] ?? SEVERITY[30]
			const attributes = Object.fromEntries(
				Object.entries(fields).map(([key, value]) => [
					key,
					toAttributeValue(value)
				])
			) as LogAttributes

			const milliseconds = toMilliseconds(time)
			const record: LogRecord = {
				severityText: severity.text,
				severityNumber: severity.number,
				body: typeof msg === 'string' ? msg : JSON.stringify(msg),
				timestamp: [
					Math.floor(milliseconds / 1000),
					(milliseconds % 1000) * 1e6
				],
				...(Object.keys(attributes).length > 0 && { attributes })
			}
			otelLogger.emit(record)
		} catch {
			// Logging must never take the app down
		}
		callback()
	}
})

export const logger = pino(
	{
		name: 'hello-elysia',
		level: process.env.LOG_LEVEL ?? 'info',
		base: undefined
	},
	pino.multistream([{ stream: process.stdout }, { stream: otelStream }])
)
