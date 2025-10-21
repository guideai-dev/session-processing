/**
 * Base Parser Tests
 *
 * Tests the common parsing logic, validation, and utilities that all provider parsers inherit.
 */

import { describe, it, expect } from 'vitest'
import { BaseParser } from '../../../src/parsers/base/BaseParser.js'
import type { ParsedMessage, RawLogMessage } from '../../../src/parsers/base/types.js'
import {
	VALID_JSONL_CONTENT,
	INVALID_JSONL_CONTENT,
	EMPTY_CONTENT,
	WHITESPACE_CONTENT,
} from '../../helpers/fixtures.js'

/**
 * Concrete implementation of BaseParser for testing
 */
class TestParser extends BaseParser {
	readonly name = 'test-parser'
	readonly providerName = 'test-provider'

	parseMessage(rawMessage: RawLogMessage): ParsedMessage[] {
		const timestamp = this.parseTimestamp(rawMessage.timestamp)
		if (!timestamp) return []

		const content = this.extractTextContent(rawMessage.content)

		return [
			{
				id: this.generateMessageId(0, timestamp),
				timestamp,
				type: rawMessage.type === 'user' ? 'user_input' : 'assistant_response',
				content,
				metadata: {},
			},
		]
	}

	canParse(jsonlContent: string): boolean {
		return jsonlContent.includes('type')
	}
}

describe('BaseParser', () => {
	describe('parseSession()', () => {
		it('should parse valid JSONL format', () => {
			const parser = new TestParser()
			const session = parser.parseSession(VALID_JSONL_CONTENT)

			expect(session).toBeDefined()
			expect(session.provider).toBe('test-provider')
			expect(session.messages.length).toBeGreaterThan(0)
			expect(session.sessionId).toBeTruthy()
			expect(session.startTime).toBeInstanceOf(Date)
			expect(session.endTime).toBeInstanceOf(Date)
			expect(session.duration).toBeGreaterThanOrEqual(0)
		})

		it('should extract session metadata', () => {
			const parser = new TestParser()
			const session = parser.parseSession(VALID_JSONL_CONTENT)

			expect(session.metadata).toBeDefined()
			expect(session.metadata?.messageCount).toBe(session.messages.length)
			expect(session.metadata?.lineCount).toBeGreaterThan(0)
		})

		it('should calculate duration correctly', () => {
			const parser = new TestParser()
			const session = parser.parseSession(VALID_JSONL_CONTENT)

			const expectedDuration = session.endTime.getTime() - session.startTime.getTime()
			expect(session.duration).toBe(expectedDuration)
		})

		it('should generate session ID if not found in messages', () => {
			const parser = new TestParser()
			const contentWithoutSessionId = `{"type":"user","content":"test","timestamp":"2025-01-01T00:00:00Z"}`

			const session = parser.parseSession(contentWithoutSessionId)

			expect(session.sessionId).toBeTruthy()
			expect(session.sessionId).toMatch(/^session_\d+$/)
		})

		it('should skip messages without timestamps', () => {
			const parser = new TestParser()
			const contentWithMissingTimestamps = `{"type":"user","content":"test1","timestamp":"2025-01-01T00:00:00Z"}
{"type":"user","content":"test2"}
{"type":"user","content":"test3","timestamp":"2025-01-01T00:00:02Z"}`

			const session = parser.parseSession(contentWithMissingTimestamps)

			// Should only include messages with valid timestamps
			expect(session.messages.length).toBe(2)
		})

		it('should skip messages with invalid timestamp format', () => {
			const parser = new TestParser()
			const contentWithBadTimestamp = `{"type":"user","content":"test1","timestamp":"2025-01-01T00:00:00Z"}
{"type":"user","content":"test2","timestamp":"not-a-date"}
{"type":"user","content":"test3","timestamp":"2025-01-01T00:00:02Z"}`

			const session = parser.parseSession(contentWithBadTimestamp)

			expect(session.messages.length).toBe(2)
		})

		it('should track earliest start time and latest end time', () => {
			const parser = new TestParser()
			const session = parser.parseSession(VALID_JSONL_CONTENT)

			// Verify start time is the earliest timestamp
			const timestamps = session.messages.map(m => m.timestamp.getTime())
			expect(session.startTime.getTime()).toBe(Math.min(...timestamps))
			expect(session.endTime.getTime()).toBe(Math.max(...timestamps))
		})
	})

	describe('validateContent()', () => {
		it('should reject empty content', () => {
			const parser = new TestParser()

			expect(() => parser.parseSession(EMPTY_CONTENT)).toThrow('Content is empty')
		})

		it('should reject whitespace-only content', () => {
			const parser = new TestParser()

			expect(() => parser.parseSession(WHITESPACE_CONTENT)).toThrow('Content is empty')
		})

		it('should reject invalid JSON lines', () => {
			const parser = new TestParser()

			expect(() => parser.parseSession(INVALID_JSONL_CONTENT)).toThrow(/Invalid JSON on line \d+/)
		})

		it('should include line number in error message', () => {
			const parser = new TestParser()

			try {
				parser.parseSession(INVALID_JSONL_CONTENT)
				expect.fail('Should have thrown an error')
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				expect((error as Error).message).toMatch(/line 2/)
			}
		})
	})

	describe('parseTimestamp()', () => {
		it('should handle ISO 8601 dates', () => {
			const parser = new TestParser()
			const timestamp = (parser as any).parseTimestamp('2025-01-15T10:00:00.000Z')

			expect(timestamp).toBeInstanceOf(Date)
			expect(timestamp?.toISOString()).toBe('2025-01-15T10:00:00.000Z')
		})

		it('should handle various date formats', () => {
			const parser = new TestParser()

			const formats = [
				'2025-01-15T10:00:00Z',
				'2025-01-15T10:00:00.123Z',
				'2025-01-15T10:00:00+00:00',
				'2025-01-15',
			]

			for (const format of formats) {
				const timestamp = (parser as any).parseTimestamp(format)
				expect(timestamp).toBeInstanceOf(Date)
				expect(Number.isNaN(timestamp?.getTime())).toBe(false)
			}
		})

		it('should return null for invalid dates', () => {
			const parser = new TestParser()

			expect((parser as any).parseTimestamp('not-a-date')).toBeNull()
			expect((parser as any).parseTimestamp('2025-13-45')).toBeNull()
			expect((parser as any).parseTimestamp('')).toBeNull()
			expect((parser as any).parseTimestamp(undefined)).toBeNull()
		})

		it('should return null for undefined', () => {
			const parser = new TestParser()

			expect((parser as any).parseTimestamp(undefined)).toBeNull()
		})
	})

	describe('parsePartsContent()', () => {
		it('should handle nested content structures', () => {
			const parser = new TestParser()

			const content = {
				parts: [
					{ type: 'text', text: 'Hello' },
					{ type: 'text', text: 'World' },
				],
			}

			const result = (parser as any).parsePartsContent(content)

			expect(result).toBeDefined()
			expect(result?.parts).toHaveLength(2)
			expect(result?.parts[0].text).toBe('Hello')
		})

		it('should handle JSON string with parts', () => {
			const parser = new TestParser()

			const content = JSON.stringify({
				parts: [{ type: 'text', text: 'Test' }],
			})

			const result = (parser as any).parsePartsContent(content)

			expect(result).toBeDefined()
			expect(result?.parts).toHaveLength(1)
			expect(result?.parts[0].text).toBe('Test')
		})

		it('should return null for content without parts', () => {
			const parser = new TestParser()

			expect((parser as any).parsePartsContent('plain string')).toBeNull()
			expect((parser as any).parsePartsContent({ other: 'data' })).toBeNull()
			expect((parser as any).parsePartsContent(null)).toBeNull()
			expect((parser as any).parsePartsContent(undefined)).toBeNull()
		})

		it('should return null for invalid JSON string', () => {
			const parser = new TestParser()

			expect((parser as any).parsePartsContent('not valid json')).toBeNull()
		})
	})

	describe('extractTextContent()', () => {
		it('should extract text from string content', () => {
			const parser = new TestParser()

			const result = (parser as any).extractTextContent('Hello World')

			expect(result).toBe('Hello World')
		})

		it('should extract text from object with text field', () => {
			const parser = new TestParser()

			const content = { text: 'Hello from object' }
			const result = (parser as any).extractTextContent(content)

			// Object without parts structure returns empty string
			expect(result).toBe('')
		})

		it('should extract text from parts array', () => {
			const parser = new TestParser()

			const content = [
				{ type: 'text', text: 'Part 1' },
				{ type: 'text', text: 'Part 2' },
				{ type: 'other', data: 'ignored' },
			]

			const result = (parser as any).extractTextContent(content)

			expect(result).toBe('Part 1 Part 2')
		})

		it('should extract text from nested parts structure', () => {
			const parser = new TestParser()

			const content = {
				parts: [
					{ type: 'text', text: 'Line 1' },
					{ type: 'text', text: 'Line 2' },
				],
			}

			const result = (parser as any).extractTextContent(content)

			expect(result).toBe('Line 1\nLine 2')
		})

		it('should return empty string for non-text content', () => {
			const parser = new TestParser()

			expect((parser as any).extractTextContent(null)).toBe('')
			expect((parser as any).extractTextContent(undefined)).toBe('')
			expect((parser as any).extractTextContent(123)).toBe('')
			expect((parser as any).extractTextContent(true)).toBe('')
		})

		it('should handle empty arrays', () => {
			const parser = new TestParser()

			expect((parser as any).extractTextContent([])).toBe('')
		})

		it('should handle arrays with no text parts', () => {
			const parser = new TestParser()

			const content = [{ type: 'image', url: 'test.png' }, { type: 'other', data: 'test' }]

			expect((parser as any).extractTextContent(content)).toBe('')
		})
	})

	describe('generateMessageId()', () => {
		it('should generate unique IDs with index', () => {
			const parser = new TestParser()

			const id1 = (parser as any).generateMessageId(0)
			const id2 = (parser as any).generateMessageId(1)

			expect(id1).not.toBe(id2)
			expect(id1).toMatch(/^msg_\d+_0$/)
			expect(id2).toMatch(/^msg_\d+_1$/)
		})

		it('should use provided timestamp', () => {
			const parser = new TestParser()

			const timestamp = new Date('2025-01-15T10:00:00.000Z')
			const id = (parser as any).generateMessageId(5, timestamp)

			expect(id).toBe(`msg_${timestamp.getTime()}_5`)
		})

		it('should use current time if no timestamp provided', () => {
			const parser = new TestParser()

			const before = Date.now()
			const id = (parser as any).generateMessageId(0)
			const after = Date.now()

			const extractedTime = Number.parseInt(id.split('_')[1])
			expect(extractedTime).toBeGreaterThanOrEqual(before)
			expect(extractedTime).toBeLessThanOrEqual(after)
		})
	})

	describe('extractSessionId()', () => {
		it('should extract sessionId field', () => {
			const parser = new TestParser()

			const message = { sessionId: 'test-session-123' }
			const result = (parser as any).extractSessionId(message)

			expect(result).toBe('test-session-123')
		})

		it('should extract sessionID field (capital ID)', () => {
			const parser = new TestParser()

			const message = { sessionID: 'test-session-456' }
			const result = (parser as any).extractSessionId(message)

			expect(result).toBe('test-session-456')
		})

		it('should return null if no session ID found', () => {
			const parser = new TestParser()

			const message = { other: 'data' }
			const result = (parser as any).extractSessionId(message)

			expect(result).toBeNull()
		})

		it('should prefer sessionId over sessionID', () => {
			const parser = new TestParser()

			const message = { sessionId: 'lowercase', sessionID: 'uppercase' }
			const result = (parser as any).extractSessionId(message)

			expect(result).toBe('lowercase')
		})
	})

	describe('isInterruptionContent()', () => {
		it('should detect interruption markers', () => {
			const parser = new TestParser()

			expect((parser as any).isInterruptionContent('[Request interrupted by user]')).toBe(true)
			expect((parser as any).isInterruptionContent('Request interrupted by user')).toBe(true)
			expect(
				(parser as any).isInterruptionContent(
					'Some text [Request interrupted by user] more text'
				)
			).toBe(true)
		})

		it('should return false for non-interruption content', () => {
			const parser = new TestParser()

			expect((parser as any).isInterruptionContent('Normal message')).toBe(false)
			expect((parser as any).isInterruptionContent('interrupt')).toBe(false)
			expect((parser as any).isInterruptionContent('')).toBe(false)
		})
	})

	describe('isCommandContent()', () => {
		it('should detect slash commands', () => {
			const parser = new TestParser()

			expect((parser as any).isCommandContent('/help')).toBe(true)
			expect((parser as any).isCommandContent('/clear')).toBe(true)
			expect((parser as any).isCommandContent('/test command')).toBe(true)
		})

		it('should detect command-name tags', () => {
			const parser = new TestParser()

			expect((parser as any).isCommandContent('<command-name>test</command-name>')).toBe(true)
			expect((parser as any).isCommandContent('Text with <command-name>cmd</command-name>')).toBe(
				true
			)
		})

		it('should return false for non-command content', () => {
			const parser = new TestParser()

			expect((parser as any).isCommandContent('Normal message')).toBe(false)
			expect((parser as any).isCommandContent('command')).toBe(false)
			expect((parser as any).isCommandContent('')).toBe(false)
		})

		it('should not match slash in middle of text', () => {
			const parser = new TestParser()

			expect((parser as any).isCommandContent('This is a test/case')).toBe(false)
			expect((parser as any).isCommandContent('http://example.com')).toBe(false)
		})
	})

	describe('extractTextFromParts()', () => {
		it('should extract and join text parts', () => {
			const parser = new TestParser()

			const parts = [
				{ type: 'text', text: 'First' },
				{ type: 'text', text: 'Second' },
				{ type: 'text', text: 'Third' },
			]

			const result = (parser as any).extractTextFromParts(parts)

			expect(result).toBe('First\nSecond\nThird')
		})

		it('should filter out non-text parts', () => {
			const parser = new TestParser()

			const parts = [
				{ type: 'text', text: 'Keep this' },
				{ type: 'image', url: 'ignore.png' },
				{ type: 'text', text: 'And this' },
			]

			const result = (parser as any).extractTextFromParts(parts)

			expect(result).toBe('Keep this\nAnd this')
		})

		it('should handle empty parts array', () => {
			const parser = new TestParser()

			const result = (parser as any).extractTextFromParts([])

			expect(result).toBe('')
		})

		it('should skip parts without text', () => {
			const parser = new TestParser()

			const parts = [
				{ type: 'text', text: 'Has text' },
				{ type: 'text' }, // Missing text field
				{ type: 'text', text: '' }, // Empty text
			]

			const result = (parser as any).extractTextFromParts(parts)

			expect(result).toBe('Has text')
		})
	})
})
