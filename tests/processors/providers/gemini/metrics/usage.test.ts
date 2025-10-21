import { describe, it, expect, beforeAll } from 'vitest'
import { GeminiUsageProcessor } from '../../../../../src/processors/providers/gemini/metrics/usage.js'
import { GeminiParser } from '../../../../../src/parsers/providers/gemini/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('GeminiUsageProcessor', () => {
	const processor = new GeminiUsageProcessor()
	const parser = new GeminiParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('gemini', 'sample-gemini-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate read/write ratio from real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.read_write_ratio).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.read_write_ratio).toBe('number')
		})

		it('should calculate input clarity score', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.input_clarity_score).toBeGreaterThanOrEqual(0)
			expect(metrics.input_clarity_score).toBeLessThanOrEqual(100)
		})

		it('should include metadata if present', async () => {
			const metrics = await processor.process(parsedSession)

			if (metrics.metadata) {
				expect(metrics.metadata.total_tokens).toBeGreaterThanOrEqual(0)
				if (metrics.metadata.cache_hit_rate !== undefined) {
					expect(metrics.metadata.cache_hit_rate).toBeGreaterThanOrEqual(0)
					expect(metrics.metadata.cache_hit_rate).toBeLessThanOrEqual(1)
				}
			}
		})
	})
})
