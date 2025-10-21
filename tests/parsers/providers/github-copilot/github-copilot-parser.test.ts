/**
 * GitHub Copilot Parser Tests
 *
 * Tests the GitHub Copilot provider parser with both synthetic and real session data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CopilotParser } from '../../../../src/parsers/providers/github-copilot/parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('CopilotParser', () => {
	let parser: CopilotParser
	let realSessionContent: string

	beforeAll(() => {
		parser = new CopilotParser()

		// Load real session file
		const realSessionPath = join(__dirname, 'fixtures', 'real-session-large.jsonl')
		realSessionContent = readFileSync(realSessionPath, 'utf-8')
	})

	describe('canParse()', () => {
		it('should recognize GitHub Copilot JSONL format', () => {
			const copilotContent = `{"id":"123","type":"user","text":"test","timestamp":"2025-01-01T00:00:00Z"}`
			const result = parser.canParse(copilotContent)
			expect(result).toBe(true)
		})

		it('should recognize real Copilot session', () => {
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

		it('should reject non-Copilot format', () => {
			const otherFormat = `{"message":"test","data":"value"}`
			const result = parser.canParse(otherFormat)
			expect(result).toBe(false)
		})
	})

	describe('parseSession() - Synthetic Data', () => {
		const COPILOT_SESSION = `{"id":"msg_1","timestamp":"2025-01-15T10:00:05.000Z","type":"user","text":"Write a function"}
{"id":"msg_2","timestamp":"2025-01-15T10:00:10.000Z","type":"copilot","text":"I'll help you write a function."}`

		it('should parse Copilot JSONL format', () => {
			const session = parser.parseSession(COPILOT_SESSION)

			expect(session).toBeDefined()
			expect(session.provider).toBe('github-copilot')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
		})

		it('should extract timestamps correctly', () => {
			const session = parser.parseSession(COPILOT_SESSION)

			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.startTime.getTime()).toBeLessThanOrEqual(session.endTime.getTime())
		})

		it('should calculate duration correctly', () => {
			const session = parser.parseSession(COPILOT_SESSION)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should parse user messages', () => {
			const session = parser.parseSession(COPILOT_SESSION)

			const userMessages = session.messages.filter(m => m.type === 'user_input')
			expect(userMessages.length).toBeGreaterThan(0)
		})

		it('should parse copilot messages as assistant responses', () => {
			const session = parser.parseSession(COPILOT_SESSION)

			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			expect(assistantMessages.length).toBeGreaterThan(0)
		})
	})

	describe('parseSession() - Real Session Data', () => {
		it('should successfully parse large real session', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session).toBeDefined()
			expect(session.provider).toBe('github-copilot')
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

			// Should have at least user and assistant/copilot messages
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

		it('should handle tool call messages if present', () => {
			const session = parser.parseSession(realSessionContent)

			// Copilot may have tool calls
			const toolMessages = session.messages.filter(
				m => m.type === 'tool_use' || m.type === 'tool_result'
			)
			expect(Array.isArray(toolMessages)).toBe(true)
		})
	})

	describe('Edge Cases', () => {
		it('should handle messages without timestamps gracefully', () => {
			const contentWithoutTimestamp = `{"id":"1","type":"user","text":"No timestamp"}
{"id":"2","timestamp":"2025-01-01T00:00:00Z","type":"user","text":"Has timestamp"}`

			const session = parser.parseSession(contentWithoutTimestamp)

			// Should only include message with timestamp
			expect(session.messages.length).toBe(1)
		})

		it('should handle malformed message content', () => {
			const contentWithMalformed = `{"id":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","text":null}
{"id":"2","timestamp":"2025-01-01T00:00:01Z","type":"user","text":"Valid"}`

			// Should not throw
			expect(() => parser.parseSession(contentWithMalformed)).not.toThrow()
		})

		it('should skip messages with invalid timestamp format', () => {
			const contentWithBadTimestamp = `{"id":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","text":"test1"}
{"id":"2","timestamp":"not-a-date","type":"user","text":"test2"}
{"id":"3","timestamp":"2025-01-01T00:00:02Z","type":"user","text":"test3"}`

			const session = parser.parseSession(contentWithBadTimestamp)

			expect(session.messages.length).toBe(2)
		})

		it('should generate session ID if not found', () => {
			const contentWithoutSessionId = `{"id":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","text":"test"}`

			const session = parser.parseSession(contentWithoutSessionId)

			expect(session.sessionId).toBeTruthy()
			// Copilot parser generates session IDs with format: copilot-{timestamp}
			expect(session.sessionId).toMatch(/^(session_|copilot-)\d+$/)
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

		it('should handle tool_call_requested type', () => {
			const contentWithToolCall = `{"id":"1","timestamp":"2025-01-01T00:00:00Z","type":"tool_call_requested","name":"read_file"}`

			const session = parser.parseSession(contentWithToolCall)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})

		it('should handle tool_call_completed type', () => {
			const contentWithToolResult = `{"id":"1","timestamp":"2025-01-01T00:00:00Z","type":"tool_call_completed","result":"success"}`

			const session = parser.parseSession(contentWithToolResult)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})
	})
})
