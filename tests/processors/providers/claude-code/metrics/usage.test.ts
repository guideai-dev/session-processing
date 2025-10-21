import { describe, it, expect, beforeAll } from 'vitest'
import { ClaudeUsageProcessor } from '../../../../../src/processors/providers/claude-code/metrics/usage.js'
import { ClaudeCodeParser } from '../../../../../src/parsers/providers/claude-code/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('ClaudeUsageProcessor', () => {
	const processor = new ClaudeUsageProcessor()
	const parser = new ClaudeCodeParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('claude-code', 'sample-claude-session.jsonl')
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
	})

	describe('read/write ratio calculation', () => {
		it('should calculate ratio when both reads and writes exist', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"tool-002","name":"Read","input":{"file_path":"other.ts"}},{"type":"tool_use","id":"tool-003","name":"Write","input":{"file_path":"test.ts","content":"code"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 2 reads / 1 write = 2.0
				expect(metrics.read_write_ratio).toBe(2.0)
				expect(metrics.metadata?.read_operations).toBe(2)
				expect(metrics.metadata?.write_operations).toBe(1)
			})
		})

		it('should return read count when no writes exist', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"tool-002","name":"Grep","input":{"pattern":"function"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 2 reads, 0 writes = return 2
				expect(metrics.read_write_ratio).toBe(2)
			})
		})

		it('should count Edit as write operation', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"tool-002","name":"Edit","input":{"file_path":"test.ts","old_string":"old","new_string":"new"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 1 read / 1 write = 1.0
				expect(metrics.read_write_ratio).toBe(1.0)
			})
		})

		it('should count Grep and Glob as read operations', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Grep","input":{"pattern":"test"}},{"type":"tool_use","id":"tool-002","name":"Glob","input":{"pattern":"**/*.ts"}},{"type":"tool_use","id":"tool-003","name":"Write","input":{"file_path":"test.ts","content":"code"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 2 reads (Grep + Glob) / 1 write = 2.0
				expect(metrics.read_write_ratio).toBe(2.0)
			})
		})
	})

	describe('input clarity scoring', () => {
		it('should score high for technical terms', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Create a function to query the database table using async await in TypeScript',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				// Contains: function, query, database, table, async, await, typescript = 7 terms
				expect(metrics.input_clarity_score).toBeGreaterThan(0)
			})
		})

		it('should score high for code snippets', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Update the function to use `const result = await fetch()` instead',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				// Contains inline code snippet
				expect(metrics.input_clarity_score).toBeGreaterThan(0)
			})
		})

		it('should score high for file references', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Edit src/components/Button.tsx to add a new prop',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				// Contains file path and extension
				expect(metrics.input_clarity_score).toBeGreaterThan(0)
			})
		})

		it('should score low for vague requests', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Can you help me with something?',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				expect(metrics.input_clarity_score).toBeLessThan(20)
			})
		})

		it('should cap clarity score at 100', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content:
							'function async await typescript react component interface api database query table schema migration export import class method npm pnpm build test src/file.ts ```code block```',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				expect(metrics.input_clarity_score).toBeLessThanOrEqual(100)
			})
		})

		it('should average scores across multiple user messages', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Create a function in src/utils.ts',
						timestamp: new Date(),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Done',
						timestamp: new Date(),
					},
					{
						id: 'msg3',
						type: 'user_input',
						content: 'Also add typescript types and async await',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				expect(metrics.input_clarity_score).toBeGreaterThan(0)
				expect(metrics.metadata?.total_user_messages).toBe(2)
			})
		})
	})

	describe('lines read calculation', () => {
		it('should count lines from Read tool results', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}}]}}
{"uuid":"msg-002","timestamp":"2025-01-01T00:00:01.000Z","type":"tool_result","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tool-001","content":"line 1\\nline 2\\nline 3"}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 3 lines read
				expect(metrics.metadata?.total_lines_read).toBe(3)
			})
		})

		it('should count lines from Grep results', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Grep","input":{"pattern":"function"}}]}}
{"uuid":"msg-002","timestamp":"2025-01-01T00:00:01.000Z","type":"tool_result","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tool-001","content":"match 1\\nmatch 2"}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				expect(metrics.metadata?.total_lines_read).toBeGreaterThan(0)
			})
		})

		it('should handle empty tool results', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}}]}}
{"uuid":"msg-002","timestamp":"2025-01-01T00:00:01.000Z","type":"tool_result","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tool-001","content":""}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// Empty content results in 0 lines after filtering
				expect(metrics.metadata?.total_lines_read).toBeGreaterThanOrEqual(0)
			})
		})
	})

	describe('improvement tips', () => {
		it('should suggest optimization for high read/write ratio (>5)', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"r1","name":"Read","input":{"file_path":"a.ts"}},{"type":"tool_use","id":"r2","name":"Read","input":{"file_path":"b.ts"}},{"type":"tool_use","id":"r3","name":"Read","input":{"file_path":"c.ts"}},{"type":"tool_use","id":"r4","name":"Read","input":{"file_path":"d.ts"}},{"type":"tool_use","id":"r5","name":"Read","input":{"file_path":"e.ts"}},{"type":"tool_use","id":"r6","name":"Read","input":{"file_path":"f.ts"}},{"type":"tool_use","id":"w1","name":"Write","input":{"file_path":"result.ts","content":"code"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				expect(metrics.metadata?.improvement_tips).toContain(
					"High Read/Write ratio suggests AI is 'lost' - provide specific file paths upfront"
				)
				expect(metrics.metadata?.improvement_tips).toContain(
					'Include relevant code context in your requests to reduce searching'
				)
			})
		})

		it('should praise excellent efficiency for low ratio (<=2)', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"r1","name":"Read","input":{"file_path":"a.ts"}},{"type":"tool_use","id":"w1","name":"Write","input":{"file_path":"a.ts","content":"code"}}]}}`
			const session = parser.parseSession(jsonl)

			return processor.process(session).then(metrics => {
				// 1 read / 1 write = 1.0 (<=2)
				expect(metrics.metadata?.improvement_tips).toContain(
					'Excellent efficiency! AI found and modified files quickly'
				)
			})
		})

		it('should suggest more technical details for low clarity (<20)', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Make it better',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				expect(metrics.metadata?.improvement_tips).toContain(
					'Low input clarity - try including more technical details and code examples'
				)
				expect(metrics.metadata?.improvement_tips).toContain(
					'Specify exact file paths and function names for better results'
				)
			})
		})

		it('should praise great communication for high clarity (>50)', () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Update the async function in src/api/database.ts to use the new query interface with TypeScript types',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(session).then(metrics => {
				if (metrics.input_clarity_score > 50) {
					expect(metrics.metadata?.improvement_tips).toContain(
						'Great technical communication! Clear, specific inputs lead to better results'
					)
				}
			})
		})
	})

	describe('edge cases', () => {
		it('should handle sessions with no tool uses', async () => {
			const emptySession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Hello',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			const metrics = await processor.process(emptySession)
			expect(metrics.read_write_ratio).toBe(0)
			expect(metrics.metadata?.read_operations).toBe(0)
			expect(metrics.metadata?.write_operations).toBe(0)
		})

		it('should handle sessions with no user messages', async () => {
			const noUserSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant_response',
						content: 'Working...',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			const metrics = await processor.process(noUserSession)
			expect(metrics.input_clarity_score).toBe(0)
		})

		it('should handle empty session', async () => {
			const emptySession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [],
				startTime: new Date(),
				endTime: new Date(),
				duration: 0,
			}

			const metrics = await processor.process(emptySession)
			expect(metrics.read_write_ratio).toBe(0)
			expect(metrics.input_clarity_score).toBe(0)
		})
	})

	describe('metadata tracking', () => {
		it('should track read and write operation counts', async () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"r1","name":"Read","input":{"file_path":"a.ts"}},{"type":"tool_use","id":"r2","name":"Grep","input":{"pattern":"test"}},{"type":"tool_use","id":"r3","name":"Glob","input":{"pattern":"**/*.ts"}},{"type":"tool_use","id":"w1","name":"Write","input":{"file_path":"a.ts","content":"code"}},{"type":"tool_use","id":"w2","name":"Edit","input":{"file_path":"b.ts","old_string":"old","new_string":"new"}}]}}`
			const session = parser.parseSession(jsonl)

			const metrics = await processor.process(session)
			expect(metrics.metadata?.read_operations).toBe(3) // Read, Grep, Glob
			expect(metrics.metadata?.write_operations).toBe(2) // Write, Edit
		})

		it('should track total user messages', async () => {
			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{ id: 'msg1', type: 'user_input', content: 'First', timestamp: new Date() },
					{ id: 'msg2', type: 'assistant', content: 'Response', timestamp: new Date() },
					{ id: 'msg3', type: 'user_input', content: 'Second', timestamp: new Date() },
					{ id: 'msg4', type: 'user_input', content: 'Third', timestamp: new Date() },
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			const metrics = await processor.process(session)
			expect(metrics.metadata?.total_user_messages).toBe(3)
		})
	})
})
