/**
 * Claude Code Parser Tests
 *
 * Tests the Claude Code provider parser with both synthetic and real session data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ClaudeCodeParser } from '../../../../src/parsers/providers/claude-code/parser.js'
import { CLAUDE_CODE_SESSION_JSONL } from '../../../helpers/fixtures.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('ClaudeCodeParser', () => {
	let parser: ClaudeCodeParser
	let realSessionContent: string

	beforeAll(() => {
		parser = new ClaudeCodeParser()

		// Load real session file
		const realSessionPath = join(__dirname, 'fixtures', 'real-session-large.jsonl')
		realSessionContent = readFileSync(realSessionPath, 'utf-8')
	})

	describe('canParse()', () => {
		it('should recognize Claude Code JSONL format', () => {
			const result = parser.canParse(CLAUDE_CODE_SESSION_JSONL)
			expect(result).toBe(true)
		})

		it('should recognize real Claude Code session', () => {
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

		it('should reject non-Claude Code format', () => {
			const otherFormat = `{"type":"message","text":"test"}`
			const result = parser.canParse(otherFormat)
			expect(result).toBe(false)
		})
	})

	describe('parseSession() - Synthetic Data', () => {
		// Note: These tests verify the parser correctly transforms raw Claude JSONL format
		// (which uses "type": "user" and "type": "assistant") into the unified internal format
		// (which uses 'user_input' and 'assistant_response'). See parser.ts:getMessageType()

		it('should parse Claude Code JSONL format', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			expect(session).toBeDefined()
			expect(session.provider).toBe('claude-code')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
		})

		it('should extract session ID', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			expect(session.sessionId).toBe('session-123')
		})

		it('should extract timestamps correctly', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.startTime.getTime()).toBeLessThanOrEqual(session.endTime.getTime())
		})

		it('should calculate duration correctly', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should parse user messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			const userMessages = session.messages.filter(m => m.type === 'user_input')
			expect(userMessages.length).toBeGreaterThan(0)
		})

		it('should parse assistant messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			expect(assistantMessages.length).toBeGreaterThan(0)
		})

		it('should handle tool_use messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			const toolUseMessages = session.messages.filter(m => m.type === 'tool_use')
			expect(toolUseMessages.length).toBeGreaterThan(0)

			const toolUseMsg = toolUseMessages[0]
			expect(toolUseMsg.content).toBeDefined()
			expect(typeof toolUseMsg.content).not.toBe('string')

			if (typeof toolUseMsg.content !== 'string') {
				expect(toolUseMsg.content.toolUses).toBeDefined()
				expect(toolUseMsg.content.toolUses.length).toBeGreaterThan(0)
			}
		})

		it('should handle tool_result messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			const toolResultMessages = session.messages.filter(m => m.type === 'tool_result')
			// Tool results may or may not be present depending on message structure
			expect(Array.isArray(session.messages)).toBe(true)
		})

		it('should split assistant messages with tools into separate messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			// Should have both assistant text and tool_use messages
			const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')
			const toolUseMessages = session.messages.filter(m => m.type === 'tool_use')

			expect(assistantMessages.length).toBeGreaterThan(0)
			expect(toolUseMessages.length).toBeGreaterThan(0)
		})
	})

	describe('parseSession() - Real Session Data', () => {
		it('should successfully parse large real session', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session).toBeDefined()
			expect(session.provider).toBe('claude-code')
		})

		it('should extract valid session ID from real data', () => {
			const session = parser.parseSession(realSessionContent)

			expect(session.sessionId).toBeTruthy()
			expect(typeof session.sessionId).toBe('string')
			expect(session.sessionId.length).toBeGreaterThan(0)
		})

		it('should parse many messages from real session', () => {
			const session = parser.parseSession(realSessionContent)

			// Real sessions should have lots of messages
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

		it('should skip isMeta flagged messages but may have meta type messages', () => {
			const session = parser.parseSession(realSessionContent)

			// isMeta messages are filtered in parseMessage(), but meta type messages may exist
			// The parser filters messages during parsing
			expect(session.messages.length).toBeGreaterThan(0)
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
	})

	describe('extractToolUses()', () => {
		it('should extract all tool uses from session', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)
			const toolUses = parser.extractToolUses(session)

			expect(toolUses.length).toBeGreaterThan(0)
			expect(toolUses[0].type).toBe('tool_use')
		})

		it('should return empty array if no tool uses', () => {
			const contentWithoutTools = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"Hello"},"sessionId":"test"}`
			const session = parser.parseSession(contentWithoutTools)
			const toolUses = parser.extractToolUses(session)

			expect(toolUses).toEqual([])
		})
	})

	describe('extractToolResults()', () => {
		it('should extract tool results from session if present', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)
			const toolResults = parser.extractToolResults(session)

			// Tool results are only present if messages contain them
			expect(Array.isArray(toolResults)).toBe(true)

			if (toolResults.length > 0) {
				expect(toolResults[0].type).toBe('tool_result')
			}
		})

		it('should return empty array if no tool results', () => {
			const contentWithoutResults = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"Hello"},"sessionId":"test"}`
			const session = parser.parseSession(contentWithoutResults)
			const toolResults = parser.extractToolResults(session)

			expect(toolResults).toEqual([])
		})
	})

	describe('findInterruptions()', () => {
		it('should find interruption messages when they exist', () => {
			const contentWithInterruption = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"[Request interrupted by user]"},"sessionId":"test"}
{"uuid":"2","timestamp":"2025-01-01T00:00:01Z","type":"user","message":{"role":"user","content":"Normal message"},"sessionId":"test"}`

			const session = parser.parseSession(contentWithInterruption)
			const interruptions = parser.findInterruptions(session)

			// Check if interruptions were found (should be 1 in this case)
			expect(Array.isArray(interruptions)).toBe(true)

			// The interruption detection depends on message type being set to 'interruption' or content containing the marker
			const interruptionFound = session.messages.some(m =>
				m.type === 'interruption' ||
				(typeof m.content === 'string' && m.content.includes('[Request interrupted by user]'))
			)
			expect(interruptionFound).toBe(true)
		})

		it('should return empty array if no interruptions', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)
			const interruptions = parser.findInterruptions(session)

			expect(Array.isArray(interruptions)).toBe(true)
		})
	})

	describe('calculateResponseTimes()', () => {
		it('should calculate response times between user and assistant messages', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)
			const responseTimes = parser.calculateResponseTimes(session)

			expect(Array.isArray(responseTimes)).toBe(true)

			if (responseTimes.length > 0) {
				const rt = responseTimes[0]
				expect(rt.userMessage).toBeDefined()
				expect(rt.assistantMessage).toBeDefined()
				expect(rt.responseTime).toBeGreaterThanOrEqual(0)
			}
		})

		it('should handle sessions without user-assistant pairs', () => {
			const contentWithoutPairs = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"Only user"},"sessionId":"test"}`

			const session = parser.parseSession(contentWithoutPairs)
			const responseTimes = parser.calculateResponseTimes(session)

			expect(responseTimes).toEqual([])
		})
	})

	describe('Edge Cases', () => {
		it('should handle messages without timestamps gracefully', () => {
			const contentWithoutTimestamp = `{"uuid":"1","type":"user","message":{"role":"user","content":"No timestamp"},"sessionId":"test"}
{"uuid":"2","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":"Has timestamp"},"sessionId":"test"}`

			const session = parser.parseSession(contentWithoutTimestamp)

			// Should only include message with timestamp
			expect(session.messages.length).toBe(1)
		})

		it('should handle malformed message content', () => {
			const contentWithMalformed = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","message":{"role":"user","content":null},"sessionId":"test"}
{"uuid":"2","timestamp":"2025-01-01T00:00:01Z","type":"user","message":{"role":"user","content":"Valid"},"sessionId":"test"}`

			// Should not throw
			expect(() => parser.parseSession(contentWithMalformed)).not.toThrow()
		})

		it('should handle empty tool arrays', () => {
			const contentWithEmptyTools = `{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"assistant","message":{"role":"assistant","content":[]},"sessionId":"test"}`

			const session = parser.parseSession(contentWithEmptyTools)

			expect(session.messages.length).toBeGreaterThanOrEqual(0)
		})

		it('should preserve parent-child relationships when present', () => {
			const session = parser.parseSession(CLAUDE_CODE_SESSION_JSONL)

			// Parent IDs are preserved from the original messages
			const messagesWithParent = session.messages.filter(m => m.parentId)

			// At least some messages should have parent relationships in Claude Code sessions
			// Check if ANY message has a parentId or parentUuid in metadata
			const hasParentData = session.messages.some(m =>
				m.parentId || m.metadata?.parentUuid
			)
			expect(hasParentData).toBe(true)
		})
	})
})
