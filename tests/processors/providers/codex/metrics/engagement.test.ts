import { describe, it, expect, beforeAll } from 'vitest'
import { CodexEngagementProcessor } from '../../../../../src/processors/providers/codex/metrics/engagement.js'
import { CodexParser } from '../../../../../src/parsers/providers/codex/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CodexEngagementProcessor', () => {
	const processor = new CodexEngagementProcessor()
	const parser = new CodexParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('codex', 'sample-codex-session.jsonl')
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
