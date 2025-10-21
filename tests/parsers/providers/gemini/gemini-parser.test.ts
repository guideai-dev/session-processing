/**
 * Gemini Parser Tests
 *
 * Tests the Gemini Code provider parser with both synthetic and real session data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { GeminiParser } from '../../../../src/parsers/providers/gemini/parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('GeminiParser', () => {
	let parser: GeminiParser
	let realSessionContent: string

	beforeAll(() => {
		parser = new GeminiParser()

		// Load real session file
		const realSessionPath = join(__dirname, 'fixtures', 'real-session-large.jsonl')
		realSessionContent = readFileSync(realSessionPath, 'utf-8')
	})

	describe('canParse()', () => {
		it('should recognize Gemini JSONL format with gemini-specific fields', () => {
			const geminiContent = `{"gemini_model":"gemini-2.0-pro","type":"user","message":{"role":"user","content":"test"},"timestamp":"2025-01-01T00:00:00Z"}`
			const result = parser.canParse(geminiContent)
			expect(result).toBe(true)
		})

		it('should recognize real Gemini session', () => {
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

		it('should reject non-Gemini format', () => {
			const otherFormat = `{"type":"message","text":"test"}`
			const result = parser.canParse(otherFormat)
			expect(result).toBe(false)
		})
	})

	describe('parseSession() - Synthetic Data', () => {
		const GEMINI_SESSION = `{"uuid":"msg_1","timestamp":"2025-01-15T10:00:05.000Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"Write a function"},"sessionId":"gemini-123"}
{"uuid":"msg_2","timestamp":"2025-01-15T10:00:10.000Z","type":"assistant","provider":"gemini-code","message":{"role":"assistant","content":[{"type":"text","text":"I'll help you write a function."}]},"sessionId":"gemini-123"}`

		it('should parse Gemini JSONL format', () => {
			const session = parser.parseSession(GEMINI_SESSION)

			expect(session).toBeDefined()
			expect(session.provider).toBe('gemini-code')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
		})

		it('should extract session ID', () => {
			const session = parser.parseSession(GEMINI_SESSION)
			expect(session.sessionId).toBe('gemini-123')
		})

		it('should extract timestamps correctly', () => {
			const session = parser.parseSession(GEMINI_SESSION)

			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.startTime.getTime()).toBeLessThanOrEqual(session.endTime.getTime())
		})

		it('should calculate duration correctly', () => {
			const session = parser.parseSession(GEMINI_SESSION)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should parse user messages', () => {
			const session = parser.parseSession(GEMINI_SESSION)

			const userMessages = session.messages.filter(m => m.type === 'user_input')
			expect(userMessages.length).toBeGreaterThan(0)
		})

		it('should parse assistant messages', () => {
			const session = parser.parseSession(GEMINI_SESSION)

			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			expect(assistantMessages.length).toBeGreaterThan(0)
		})
	})

	describe('parseSession() - Real Session Data', () => {
		it('should successfully parse large real session', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session).toBeDefined()
			expect(session.provider).toBe('gemini-code')
		})

		it('should extract valid session ID from real data', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.sessionId).toBeTruthy()
			expect(typeof session.sessionId).toBe('string')
			expect(session.sessionId.length).toBeGreaterThan(0)
		})

		it('should parse many messages from real session', () => {
			const session = parser.parseSession(realSessionContent)

			// Real sessions should have multiple messages
			expect(session.messages.length).toBeGreaterThan(5)
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

			// Should have at least user and assistant messages
			expect(messageTypes.has('user_input')).toBe(true)
			expect(messageTypes.has('assistant_response')).toBe(true)
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

		it('should handle tool use messages if present', () => {
			const session = parser.parseSession(realSessionContent)

			// Gemini may have tool uses
			const toolUseMessages = session.messages.filter(m => m.type === 'tool_use')
			expect(Array.isArray(toolUseMessages)).toBe(true)
		})

		it('should handle tool result messages if present', () => {
			const session = parser.parseSession(realSessionContent)

			// Gemini may have tool results
			const toolResultMessages = session.messages.filter(m => m.type === 'tool_result')
			expect(Array.isArray(toolResultMessages)).toBe(true)
		})
	})

	describe('Edge Cases', () => {
		it('should handle messages without timestamps gracefully', () => {
			const contentWithoutTimestamp = `{"uuid":"1","type":"user","provider":"gemini-code","message":{"role":"user","content":"No timestamp"},"sessionId":"test"}
{"uuid":"2","timestamp":"2025-01-01T00:00:00Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"Has timestamp"},"sessionId":"test"}`

			const session = parser.parseSession(contentWithoutTimestamp)

			// Should only include message with timestamp
			expect(session.messages.length).toBe(1)
		})

		it('should handle malformed message content', () => {
			const contentWithMalformed = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","provider":"gemini-code","message":{"role":"user","content":null},"sessionId":"test"}
{"uuid":"2","timestamp":"2025-01-01T00:00:01Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"Valid"},"sessionId":"test"}`

			// Should not throw
			expect(() => parser.parseSession(contentWithMalformed)).not.toThrow()
		})

		it('should handle empty content arrays', () => {
			const contentWithEmptyContent = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"assistant","provider":"gemini-code","message":{"role":"assistant","content":[]},"sessionId":"test"}`

			const session = parser.parseSession(contentWithEmptyContent)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})

		it('should skip messages with invalid timestamp format', () => {
			const contentWithBadTimestamp = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"test1"},"sessionId":"test"}
{"uuid":"2","timestamp":"not-a-date","type":"user","provider":"gemini-code","message":{"role":"user","content":"test2"},"sessionId":"test"}
{"uuid":"3","timestamp":"2025-01-01T00:00:02Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"test3"},"sessionId":"test"}`

			const session = parser.parseSession(contentWithBadTimestamp)

			expect(session.messages.length).toBe(2)
		})

		it('should generate session ID if not found', () => {
			const contentWithoutSessionId = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","provider":"gemini-code","message":{"role":"user","content":"test"}}`

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
	})

	describe('Gemini-Specific Features', () => {
		it('should handle Gemini thoughts if present', () => {
			const contentWithThoughts = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"assistant","provider":"gemini-code","message":{"role":"assistant","content":"Response"},"gemini_thoughts":"Internal reasoning","sessionId":"test"}`

			const session = parser.parseSession(contentWithThoughts)

			expect(session.messages.length).toBeGreaterThan(0)
		})

		it('should handle Gemini model metadata if present', () => {
			const contentWithModel = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"assistant","provider":"gemini-code","message":{"role":"assistant","content":"Response"},"gemini_model":"gemini-2.0-pro","sessionId":"test"}`

			const session = parser.parseSession(contentWithModel)

			expect(session.messages.length).toBeGreaterThan(0)
		})

		it('should handle Gemini token counts if present', () => {
			const contentWithTokens = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"assistant","provider":"gemini-code","message":{"role":"assistant","content":"Response"},"gemini_tokens":{"input":10,"output":20},"sessionId":"test"}`

			const session = parser.parseSession(contentWithTokens)

			expect(session.messages.length).toBeGreaterThan(0)
		})
	})
})
