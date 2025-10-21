import { describe, it, expect, beforeAll } from 'vitest'
import { GeminiErrorProcessor } from '../../../../../src/processors/providers/gemini/metrics/error.js'
import { GeminiParser } from '../../../../../src/parsers/providers/gemini/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('GeminiErrorProcessor', () => {
	const processor = new GeminiErrorProcessor()
	const parser = new GeminiParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('gemini', 'sample-gemini-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should count errors in real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.error_count).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.error_count).toBe('number')
		})

		it('should return error types array', async () => {
			const metrics = await processor.process(parsedSession)

			expect(Array.isArray(metrics.error_types)).toBe(true)
		})

		it('should calculate fatal errors', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.fatal_errors).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.fatal_errors).toBe('number')
		})

		it('should calculate recovery attempts', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.recovery_attempts).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.recovery_attempts).toBe('number')
		})

		it('should include metadata if present', async () => {
			const metrics = await processor.process(parsedSession)

			if (metrics.metadata) {
				expect(metrics.metadata.health_score).toBeGreaterThanOrEqual(0)
				expect(metrics.metadata.health_score).toBeLessThanOrEqual(100)
			}
		})
	})
})
