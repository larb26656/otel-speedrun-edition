import { logs, SeverityNumber } from '@opentelemetry/api-logs'

export const logger = logs.getLogger('hello-elysia')

export const severityFor = (status: number) =>
	status >= 500
		? { text: 'ERROR', number: SeverityNumber.ERROR }
		: status >= 400
			? { text: 'WARN', number: SeverityNumber.WARN }
			: { text: 'INFO', number: SeverityNumber.INFO }
