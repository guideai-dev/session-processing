import { describe, it, expect, beforeAll } from 'vitest'
import { CodexQualityProcessor } from '../../../../../src/processors/providers/codex/metrics/quality.js'
import { CodexParser } from '../../../../../src/parsers/providers/codex/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CodexQualityProcessor', () => {
	const processor = new CodexQualityProcessor()
	const parser = new CodexParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('codex', 'sample-codex-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate task success rate from real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.task_success_rate).toBeGreaterThanOrEqual(0)
			expect(metrics.task_success_rate).toBeLessThanOrEqual(100)
		})

		it('should calculate iteration count', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.iteration_count).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.iteration_count).toBe('number')
		})

		it('should calculate process quality score', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.process_quality_score).toBeGreaterThanOrEqual(0)
			expect(metrics.process_quality_score).toBeLessThanOrEqual(100)
		})

		it('should return false for plan mode (not supported)', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.used_plan_mode).toBe(false)
		})

		it('should return false for todo tracking (not supported)', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.used_todo_tracking).toBe(false)
		})

		it('should include metadata if present', async () => {
			const metrics = await processor.process(parsedSession)

			if (metrics.metadata) {
				if (metrics.metadata.detail_score !== undefined) {
					expect(metrics.metadata.detail_score).toBeGreaterThanOrEqual(0)
				}
			}
		})
	})
})
