import { BaseMetricProcessor } from '../../metric-processor.js'
import { BaseProviderProcessor } from '../../provider-processor.js'
import type { ParsedSession } from '../../types.js'

export class TestMetricProcessor extends BaseMetricProcessor {
	readonly name = 'test-metric'
	readonly metricType = 'performance' as const
	readonly description = 'Test metric processor'

	async process(session: ParsedSession) {
		return {
			response_latency_ms: session.duration,
			task_completion_time_ms: session.duration * 2,
		}
	}
}

export class ErrorThrowingMetricProcessor extends BaseMetricProcessor {
	readonly name = 'error-metric'
	readonly metricType = 'error' as const
	readonly description = 'Error throwing metric processor'

	async process(_session: ParsedSession): Promise<never> {
		throw new Error('Intentional processing error')
	}
}

export class ValidationFailingMetricProcessor extends BaseMetricProcessor {
	readonly name = 'validation-metric'
	readonly metricType = 'quality' as const
	readonly description = 'Validation failing metric processor'

	async process(session: ParsedSession) {
		this.validateSession(session)
		return {
			task_success_rate: 100,
		}
	}
}

export class TestProviderProcessor extends BaseProviderProcessor {
	readonly providerName = 'test-provider'
	readonly description = 'Test provider processor'

	parseSession(jsonlContent: string): ParsedSession {
		this.validateJsonlContent(jsonlContent)

		const lines = jsonlContent.split('\n').filter((line) => line.trim())
		const messages = lines.map((line, index) => {
			const data = JSON.parse(line)
			return {
				id: `msg-${index}`,
				type: data.type || 'user',
				content: data.content || data.message || '',
				timestamp: this.parseTimestamp(data.timestamp) || new Date(),
			}
		})

		const startTime = messages[0]?.timestamp || new Date()
		const endTime = messages[messages.length - 1]?.timestamp || new Date()

		return {
			sessionId: 'test-session-123',
			provider: this.providerName,
			startTime,
			endTime,
			duration: this.calculateDuration(startTime, endTime),
			messages,
		}
	}

	getMetricProcessors(): BaseMetricProcessor[] {
		return [new TestMetricProcessor()]
	}
}

export class ErrorThrowingProviderProcessor extends BaseProviderProcessor {
	readonly providerName = 'error-provider'
	readonly description = 'Error throwing provider processor'

	parseSession(_jsonlContent: string): ParsedSession {
		throw new Error('Intentional parsing error')
	}

	getMetricProcessors(): BaseMetricProcessor[] {
		return [new ErrorThrowingMetricProcessor()]
	}
}

export const VALID_JSONL_CONTENT = `{"type":"user","content":"Hello","timestamp":"2025-01-01T00:00:00Z"}
{"type":"assistant","content":"Hi there","timestamp":"2025-01-01T00:00:01Z"}
{"type":"user","content":"How are you?","timestamp":"2025-01-01T00:00:05Z"}`

export const INVALID_JSONL_CONTENT = `not valid json
{"type":"user","content":"test"}`

export const EMPTY_CONTENT = ''

export const VALID_SESSION: ParsedSession = {
	sessionId: 'test-session-456',
	provider: 'test-provider',
	startTime: new Date('2025-01-01T00:00:00Z'),
	endTime: new Date('2025-01-01T00:00:10Z'),
	duration: 10000,
	messages: [
		{
			id: 'msg-1',
			type: 'user',
			content: 'Hello',
			timestamp: new Date('2025-01-01T00:00:00Z'),
		},
		{
			id: 'msg-2',
			type: 'assistant',
			content: 'Hi there',
			timestamp: new Date('2025-01-01T00:00:01Z'),
		},
		{
			id: 'msg-3',
			type: 'user',
			content: 'How are you?',
			timestamp: new Date('2025-01-01T00:00:05Z'),
		},
		{
			id: 'msg-4',
			type: 'assistant',
			content: { text: 'I am doing well, thank you!' },
			timestamp: new Date('2025-01-01T00:00:10Z'),
		},
	],
}

export const SESSION_WITHOUT_ID: ParsedSession = {
	sessionId: '',
	provider: 'test-provider',
	startTime: new Date(),
	endTime: new Date(),
	duration: 0,
	messages: [
		{
			id: 'msg-1',
			type: 'user',
			content: 'test',
			timestamp: new Date(),
		},
	],
}

export const SESSION_WITHOUT_MESSAGES: ParsedSession = {
	sessionId: 'test-session-789',
	provider: 'test-provider',
	startTime: new Date(),
	endTime: new Date(),
	duration: 0,
	messages: [],
}
