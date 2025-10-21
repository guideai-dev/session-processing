import { describe, it, expect, beforeAll } from 'vitest'
import { CodexUsageProcessor } from '../../../../../src/processors/providers/codex/metrics/usage.js'
import { CodexParser } from '../../../../../src/parsers/providers/codex/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CodexUsageProcessor', () => {
	const processor = new CodexUsageProcessor()
	const parser = new CodexParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('codex', 'sample-codex-session.jsonl')
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
				if (metrics.metadata.total_tokens !== undefined) {
					expect(metrics.metadata.total_tokens).toBeGreaterThanOrEqual(0)
				}
			}
		})
	})
})
