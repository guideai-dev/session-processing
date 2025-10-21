import { describe, it, expect, beforeAll } from 'vitest'
import { CopilotUsageProcessor } from '../../../../../src/processors/providers/github-copilot/metrics/usage.js'
import { CopilotParser } from '../../../../../src/parsers/providers/github-copilot/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('CopilotUsageProcessor', () => {
	const processor = new CopilotUsageProcessor()
	const parser = new CopilotParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('github-copilot', 'sample-copilot-session.jsonl')
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
