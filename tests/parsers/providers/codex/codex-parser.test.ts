/**
 * Codex Parser Tests
 *
 * Tests the Codex provider parser with both synthetic and real session data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CodexParser } from '../../../../src/parsers/providers/codex/parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('CodexParser', () => {
	let parser: CodexParser
	let realSessionContent: string

	beforeAll(() => {
		parser = new CodexParser()

		// Load real session file
		const realSessionPath = join(__dirname, 'fixtures', 'real-session-large.jsonl')
		realSessionContent = readFileSync(realSessionPath, 'utf-8')
	})

	describe('canParse()', () => {
		it('should recognize Codex JSONL format with payload', () => {
			const codexContent = `{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"test"}]}}`
			const result = parser.canParse(codexContent)
			expect(result).toBe(true)
		})

		it('should recognize real Codex session', () => {
			const result = parser.canParse(realSessionContent)
			expect(result).toBe(true)
		})

		it('should reject empty content', () => {
			const result = parser.canParse('')
			expect(result).toBe(false)
		})

		it('should reject invalid JSON', () => {
			const result = parser.canParse('not valid json')
			expect(result).toBe(false)
		})

		it('should reject non-Codex format', () => {
			const otherFormat = `{"type":"message","text":"test"}`
			const result = parser.canParse(otherFormat)
			expect(result).toBe(false)
		})
	})

	describe('parseSession() - Synthetic Data', () => {
		const CODEX_SESSION = `{"timestamp":"2025-01-15T10:00:05.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Write a function"}]}}
{"timestamp":"2025-01-15T10:00:10.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"text","text":"I'll help you write a function."}]}}`

		it('should parse Codex JSONL format', () => {
			const session = parser.parseSession(CODEX_SESSION)

			expect(session).toBeDefined()
			expect(session.provider).toBe('codex')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
		})

		it('should extract timestamps correctly', () => {
			const session = parser.parseSession(CODEX_SESSION)

			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.startTime.getTime()).toBeLessThanOrEqual(session.endTime.getTime())
		})

		it('should calculate duration correctly', () => {
			const session = parser.parseSession(CODEX_SESSION)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should parse user messages', () => {
			const session = parser.parseSession(CODEX_SESSION)

			const userMessages = session.messages.filter(m => m.type === 'user_input')
			expect(userMessages.length).toBeGreaterThan(0)
		})

		it('should parse assistant messages', () => {
			const session = parser.parseSession(CODEX_SESSION)

			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			expect(assistantMessages.length).toBeGreaterThan(0)
		})
	})

	describe('parseSession() - Real Session Data', () => {
		it('should successfully parse large real session', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session).toBeDefined()
			expect(session.provider).toBe('codex')
		})

		it('should extract valid session ID from real data', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.sessionId).toBeTruthy()
			expect(typeof session.sessionId).toBe('string')
			expect(session.sessionId.length).toBeGreaterThan(0)
		})

		it('should parse messages from real session', () => {
			const session = parser.parseSession(realSessionContent)

			// Real sessions should have messages
			expect(session.messages.length).toBeGreaterThan(0)
		})

		it('should have valid message timestamps', () => {
			const session = parser.parseSession(realSessionContent)

			for (const message of session.messages) {
				expect(message.timestamp).toBeInstanceOf(Date)
				expect(Number.isNaN(message.timestamp.getTime())).toBe(false)
			}
		})

		it('should have valid message IDs', () => {
			const session = parser.parseSession(realSessionContent)

			for (const message of session.messages) {
				expect(message.id).toBeTruthy()
				expect(typeof message.id).toBe('string')
			}
		})

		it('should parse various message types', () => {
			const session = parser.parseSession(realSessionContent)

			const messageTypes = new Set(session.messages.map(m => m.type))

			// Should have at least user messages
			expect(messageTypes.has('user_input')).toBe(true)
		})

		it('should preserve message metadata', () => {
			const session = parser.parseSession(realSessionContent)

			for (const message of session.messages) {
				expect(message.metadata).toBeDefined()
			}
		})

		it('should calculate correct session duration', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.duration).toBeGreaterThan(0)
			expect(session.duration).toBe(session.endTime.getTime() - session.startTime.getTime())
		})

		it('should include metadata about message and line counts', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.metadata).toBeDefined()
			expect(session.metadata?.messageCount).toBe(session.messages.length)
			expect(session.metadata?.lineCount).toBeGreaterThan(0)
		})

		it('should handle session_meta type messages', () => {
			const session = parser.parseSession(realSessionContent)

			// Session meta messages may exist
			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})
	})

	describe('Edge Cases', () => {
		it('should handle messages without timestamps gracefully', () => {
			const contentWithoutTimestamp = `{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"No timestamp"}]}}
{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Has timestamp"}]}}`

			const session = parser.parseSession(contentWithoutTimestamp)

			// Should only include message with timestamp
			expect(session.messages.length).toBe(1)
		})

		it('should handle malformed payload content', () => {
			const contentWithMalformed = `{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":null}
{"timestamp":"2025-01-01T00:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Valid"}]}}`

			// Should not throw
			expect(() => parser.parseSession(contentWithMalformed)).not.toThrow()
		})

		it('should skip messages with invalid timestamp format', () => {
			const contentWithBadTimestamp = `{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"test1"}]}}
{"timestamp":"not-a-date","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"test2"}]}}
{"timestamp":"2025-01-01T00:00:02Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"test3"}]}}`

			const session = parser.parseSession(contentWithBadTimestamp)

			expect(session.messages.length).toBe(2)
		})

		it('should generate session ID if not found', () => {
			const contentWithoutSessionId = `{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"test"}]}}`

			const session = parser.parseSession(contentWithoutSessionId)

			expect(session.sessionId).toBeTruthy()
			expect(session.sessionId).toMatch(/^session_\d+$/)
		})

		it('should track earliest start time and latest end time', () => {
			const session = parser.parseSession(realSessionContent)

			// Verify start time is the earliest timestamp
			const timestamps = session.messages.map(m => m.timestamp.getTime())
			if (timestamps.length > 0) {
				expect(session.startTime.getTime()).toBe(Math.min(...timestamps))
				expect(session.endTime.getTime()).toBe(Math.max(...timestamps))
			}
		})

		it('should handle session_meta type', () => {
			const contentWithSessionMeta = `{"timestamp":"2025-01-01T00:00:00Z","type":"session_meta","payload":{"id":"test-session","timestamp":"2025-01-01T00:00:00Z"}}`

			const session = parser.parseSession(contentWithSessionMeta)

			expect(session.sessionId).toBeTruthy()
		})

		it('should handle empty content arrays', () => {
			const contentWithEmptyContent = `{"timestamp":"2025-01-01T00:00:00Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[]}}`

			const session = parser.parseSession(contentWithEmptyContent)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})
	})
})
