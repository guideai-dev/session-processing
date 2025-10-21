/**
 * OpenCode Parser Tests
 *
 * Tests the OpenCode provider parser with both synthetic and real session data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { OpenCodeParser } from '../../../../src/parsers/providers/opencode/parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('OpenCodeParser', () => {
	let parser: OpenCodeParser
	let realSessionContent: string

	beforeAll(() => {
		parser = new OpenCodeParser()

		// Load real session file
		const realSessionPath = join(__dirname, 'fixtures', 'real-session-large.jsonl')
		realSessionContent = readFileSync(realSessionPath, 'utf-8')
	})

	describe('canParse()', () => {
		it('should recognize OpenCode JSONL format', () => {
			const opencodeContent = `{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":[{"type":"text","text":"test"}]}}`
			const result = parser.canParse(opencodeContent)
			expect(result).toBe(true)
		})

		it('should recognize real OpenCode session', () => {
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

		it('should reject non-OpenCode format', () => {
			const otherFormat = `{"type":"message","text":"test"}`
			const result = parser.canParse(otherFormat)
			expect(result).toBe(false)
		})
	})

	describe('parseSession() - Synthetic Data', () => {
		const OPENCODE_SESSION = `{"sessionId":"ses_123","timestamp":"2025-01-15T10:00:05.000Z","type":"user","message":{"role":"user","content":[{"type":"text","text":"Write a function"}]}}
{"sessionId":"ses_123","timestamp":"2025-01-15T10:00:10.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll help you write a function."}]}}`

		it('should parse OpenCode JSONL format', () => {
			const session = parser.parseSession(OPENCODE_SESSION)

			expect(session).toBeDefined()
			expect(session.provider).toBe('opencode')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
		})

		it('should extract session ID', () => {
			const session = parser.parseSession(OPENCODE_SESSION)
			expect(session.sessionId).toBe('ses_123')
		})

		it('should extract timestamps correctly', () => {
			const session = parser.parseSession(OPENCODE_SESSION)

			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.startTime.getTime()).toBeLessThanOrEqual(session.endTime.getTime())
		})

		it('should calculate duration correctly', () => {
			const session = parser.parseSession(OPENCODE_SESSION)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should parse user messages', () => {
			const session = parser.parseSession(OPENCODE_SESSION)

			const userMessages = session.messages.filter(m => m.type === 'user_input')
			expect(userMessages.length).toBeGreaterThan(0)
		})

		it('should parse assistant messages', () => {
			const session = parser.parseSession(OPENCODE_SESSION)

			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			expect(assistantMessages.length).toBeGreaterThan(0)
		})

		it('should handle tool_use messages', () => {
			const sessionWithTools = `{"sessionId":"ses_123","timestamp":"2025-01-15T10:00:10.000Z","type":"tool_use","message":{"role":"tool","content":[{"type":"tool_use","id":"call_123","name":"read_file","input":{"path":"test.ts"}}]}}`

			const session = parser.parseSession(sessionWithTools)
			const toolUseMessages = session.messages.filter(m => m.type === 'tool_use')

			expect(toolUseMessages.length).toBeGreaterThan(0)
		})
	})

	describe('parseSession() - Real Session Data', () => {
		it('should successfully parse large real session', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session).toBeDefined()
			expect(session.provider).toBe('opencode')
		})

		it('should extract valid session ID from real data', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.sessionId).toBeTruthy()
			expect(typeof session.sessionId).toBe('string')
			expect(session.sessionId.length).toBeGreaterThan(0)
			expect(session.sessionId).toMatch(/^ses_/)
		})

		it('should parse many messages from real session', () => {
			const session = parser.parseSession(realSessionContent)

			// Real sessions should have multiple messages
			expect(session.messages.length).toBeGreaterThan(10)
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

		it('should handle tool use messages in real session', () => {
			const session = parser.parseSession(realSessionContent)

			// OpenCode has tool uses
			const toolUseMessages = session.messages.filter(m => m.type === 'tool_use')
			expect(toolUseMessages.length).toBeGreaterThan(0)
		})

		it('should extract tool uses from session', () => {
			const session = parser.parseSession(realSessionContent)
			const toolUses = parser.extractToolUses(session)

			expect(Array.isArray(toolUses)).toBe(true)
		})

		it('should extract tool results from session', () => {
			const session = parser.parseSession(realSessionContent)
			const toolResults = parser.extractToolResults(session)

			expect(Array.isArray(toolResults)).toBe(true)
		})
	})

	describe('Edge Cases', () => {
		it('should handle messages without timestamps gracefully', () => {
			const contentWithoutTimestamp = `{"sessionId":"ses_123","type":"user","message":{"role":"user","content":"No timestamp"}}
{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"Has timestamp"}}`

			const session = parser.parseSession(contentWithoutTimestamp)

			// Should only include message with timestamp
			expect(session.messages.length).toBe(1)
		})

		it('should handle malformed message content', () => {
			const contentWithMalformed = `{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":null}}
{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:01Z","type":"user","message":{"role":"user","content":"Valid"}}`

			// Should not throw
			expect(() => parser.parseSession(contentWithMalformed)).not.toThrow()
		})

		it('should handle empty content arrays', () => {
			const contentWithEmptyContent = `{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"assistant","message":{"role":"assistant","content":[]}}`

			const session = parser.parseSession(contentWithEmptyContent)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})

		it('should skip messages with invalid timestamp format', () => {
			const contentWithBadTimestamp = `{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"test1"}}
{"sessionId":"ses_123","timestamp":"not-a-date","type":"user","message":{"role":"user","content":"test2"}}
{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:02Z","type":"user","message":{"role":"user","content":"test3"}}`

			const session = parser.parseSession(contentWithBadTimestamp)

			expect(session.messages.length).toBe(2)
		})

		it('should generate session ID if not found', () => {
			const contentWithoutSessionId = `{"timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"test"}}`

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

		it('should handle cwd field if present', () => {
			const contentWithCwd = `{"sessionId":"ses_123","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"test"},"cwd":"/Users/test"}`

			const session = parser.parseSession(contentWithCwd)

			expect(session.messages.length).toBeGreaterThan(0)
		})
	})
})
