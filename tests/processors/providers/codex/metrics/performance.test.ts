import { describe, it, expect, beforeAll } from 'vitest'
import { CodexPerformanceProcessor } from '../../../../../src/processors/providers/codex/metrics/performance.js'
import { CodexParser } from '../../../../../src/parsers/providers/codex/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CodexPerformanceProcessor', () => {
	const processor = new CodexPerformanceProcessor()
	const parser = new CodexParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('codex', 'sample-codex-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate response latency from real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.response_latency_ms).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.response_latency_ms).toBe('number')
		})

		it('should calculate task completion time', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.task_completion_time_ms).toBeGreaterThan(0)
			expect(typeof metrics.task_completion_time_ms).toBe('number')
		})

		it('should include metadata if present', async () => {
			const metrics = await processor.process(parsedSession)

			if (metrics.metadata) {
				expect(metrics.metadata.total_responses).toBeGreaterThanOrEqual(0)
				if (metrics.metadata.performance_score !== undefined) {
					expect(metrics.metadata.performance_score).toBeGreaterThanOrEqual(0)
					expect(metrics.metadata.performance_score).toBeLessThanOrEqual(100)
				}
			}
		})
	})
})
