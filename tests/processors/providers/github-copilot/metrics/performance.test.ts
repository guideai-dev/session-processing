import { describe, it, expect, beforeAll } from 'vitest'
import { CopilotPerformanceProcessor } from '../../../../../src/processors/providers/github-copilot/metrics/performance.js'
import { CopilotParser } from '../../../../../src/parsers/providers/github-copilot/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CopilotPerformanceProcessor', () => {
	const processor = new CopilotPerformanceProcessor()
	const parser = new CopilotParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('github-copilot', 'sample-copilot-session.jsonl')
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
