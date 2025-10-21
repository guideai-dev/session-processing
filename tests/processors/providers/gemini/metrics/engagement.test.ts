import { describe, it, expect, beforeAll } from 'vitest'
import { GeminiEngagementProcessor } from '../../../../../src/processors/providers/gemini/metrics/engagement.js'
import { GeminiParser } from '../../../../../src/parsers/providers/gemini/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('GeminiEngagementProcessor', () => {
	const processor = new GeminiEngagementProcessor()
	const parser = new GeminiParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('gemini', 'sample-gemini-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate interruption rate from real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.interruption_rate).toBeGreaterThanOrEqual(0)
			expect(metrics.interruption_rate).toBeLessThanOrEqual(100)
			expect(typeof metrics.interruption_rate).toBe('number')
		})

		it('should calculate session length in minutes', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.session_length_minutes).toBeGreaterThan(0)
			expect(typeof metrics.session_length_minutes).toBe('number')
		})

		it('should include metadata if present', async () => {
			const metrics = await processor.process(parsedSession)

			if (metrics.metadata) {
				expect(metrics.metadata.total_interruptions).toBeGreaterThanOrEqual(0)
				expect(metrics.metadata.total_responses).toBeGreaterThan(0)
				if (metrics.metadata.engagement_score !== undefined) {
					expect(metrics.metadata.engagement_score).toBeGreaterThanOrEqual(0)
					expect(metrics.metadata.engagement_score).toBeLessThanOrEqual(100)
				}
			}
		})
	})
})
