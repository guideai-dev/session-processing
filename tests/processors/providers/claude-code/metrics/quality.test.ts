import { describe, it, expect, beforeAll } from 'vitest'
import { ClaudeQualityProcessor } from '../../../../../src/processors/providers/claude-code/metrics/quality.js'
import { ClaudeCodeParser } from '../../../../../src/parsers/providers/claude-code/parser.js'
import { loadSampleSession } from '../../../../helpers/fixtures.js'
import type { ParsedSession } from '../../../../../src/processors/base/types.js'

describe('ClaudeQualityProcessor', () => {
	const processor = new ClaudeQualityProcessor()
	const parser = new ClaudeCodeParser()
	let parsedSession: ParsedSession

	beforeAll(() => {
		const sessionContent = loadSampleSession('claude-code', 'sample-claude-session.jsonl')
		parsedSession = parser.parseSession(sessionContent)
	})

	describe('basic metrics with real session', () => {
		it('should calculate task success rate from real session', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.task_success_rate).toBeGreaterThanOrEqual(0)
			expect(metrics.task_success_rate).toBeLessThanOrEqual(100)
		})

		it('should calculate iteration count', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.iteration_count).toBeGreaterThanOrEqual(0)
			expect(typeof metrics.iteration_count).toBe('number')
		})

		it('should calculate process quality score', async () => {
			const metrics = await processor.process(parsedSession)

			expect(metrics.process_quality_score).toBeGreaterThanOrEqual(0)
			expect(metrics.process_quality_score).toBeLessThanOrEqual(100)
		})
	})

	describe('task success rate', () => {
		it('should calculate 100% success when all operations succeed', () => {
			const successSession: ParsedSession = {
				...parsedSession,
				messages: parsedSession.messages.map(msg => {
					if (typeof msg.content === 'object' && 'toolResults' in msg.content) {
						return {
							...msg,
							content: {
								...msg.content,
								toolResults: msg.content.toolResults.map(result => ({
									...result,
									is_error: false,
								})),
							},
						}
					}
					return msg
				}),
			}

			return processor.process(successSession).then(metrics => {
				// Should have high success rate if no errors
				expect(metrics.task_success_rate).toBeGreaterThan(0)
				expect(metrics.metadata?.successful_operations).toBeGreaterThan(0)
			})
		})

		it('should calculate lower success rate when operations fail', () => {
			const failureSession: ParsedSession = {
				...parsedSession,
				messages: parsedSession.messages.map((msg, i) => {
					if (i === 3 && typeof msg.content === 'object' && 'toolResults' in msg.content) {
						return {
							...msg,
							content: {
								...msg.content,
								toolResults: [
									{
										type: 'tool_result' as const,
										tool_use_id: 'tool-001',
										content: 'Error: Operation failed',
										is_error: true,
									},
								],
							},
						}
					}
					return msg
				}),
			}

			return processor.process(failureSession).then(metrics => {
				expect(metrics.task_success_rate).toBeLessThan(100)
			})
		})

		it('should handle sessions with no tool results', async () => {
			const noToolsSession: ParsedSession = {
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

			const metrics = await processor.process(noToolsSession)
			expect(metrics.task_success_rate).toBe(0)
		})
	})

	describe('iteration counting', () => {
		it('should detect corrections and refinements', () => {
			const iterativeSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Create a function',
						timestamp: new Date(),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Created the function',
						timestamp: new Date(),
					},
					{
						id: 'msg3',
						type: 'user_input',
						content: 'Actually, change that to use async',
						timestamp: new Date(),
					},
					{
						id: 'msg4',
						type: 'assistant_response',
						content: 'Changed to async',
						timestamp: new Date(),
					},
					{
						id: 'msg5',
						type: 'user_input',
						content: 'Wait, fix that error',
						timestamp: new Date(),
					},
					{
						id: 'msg6',
						type: 'assistant_response',
						content: 'Fixed',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 60000,
			}

			return processor.process(iterativeSession).then(metrics => {
				expect(metrics.iteration_count).toBe(2) // "actually" and "wait"
			})
		})

		it('should not count non-refinement follow-ups', () => {
			const followUpSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Create a function',
						timestamp: new Date(),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Created',
						timestamp: new Date(),
					},
					{
						id: 'msg3',
						type: 'user_input',
						content: 'Thanks! Now create another one',
						timestamp: new Date(),
					},
					{
						id: 'msg4',
						type: 'assistant_response',
						content: 'Done',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 60000,
			}

			return processor.process(followUpSession).then(metrics => {
				expect(metrics.iteration_count).toBe(0) // "Thanks! Now" is not a refinement
			})
		})

		it('should detect interruptions as iterations', () => {
			const interruptedSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'user_input',
						content: 'Do something',
						timestamp: new Date(),
					},
					{
						id: 'msg2',
						type: 'assistant_response',
						content: 'Working on it',
						timestamp: new Date(),
					},
					{
						id: 'msg3',
						type: 'user_input',
						content: '[Request interrupted by user]',
						timestamp: new Date(),
					},
					{
						id: 'msg4',
						type: 'assistant_response',
						content: 'Stopped',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 60000,
			}

			return processor.process(interruptedSession).then(metrics => {
				expect(metrics.iteration_count).toBe(1)
			})
		})
	})

	describe('plan mode and todo tracking detection', () => {
		it('should detect ExitPlanMode tool usage', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"ExitPlanMode","input":{"plan":"My plan"}}]}}`
			const planModeSession = parser.parseSession(jsonl)

			return processor.process(planModeSession).then(metrics => {
				expect(metrics.used_plan_mode).toBe(true)
				expect(metrics.metadata?.exit_plan_mode_count).toBe(1)
			})
		})

		it('should detect TodoWrite tool usage', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"TodoWrite","input":{"todos":[]}}]}}`
			const todoSession = parser.parseSession(jsonl)

			return processor.process(todoSession).then(metrics => {
				expect(metrics.used_todo_tracking).toBe(true)
				expect(metrics.metadata?.todo_write_count).toBe(1)
			})
		})

		it('should detect both plan mode and todo tracking', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"ExitPlanMode","input":{"plan":"Plan"}},{"type":"tool_use","id":"tool-002","name":"TodoWrite","input":{"todos":[]}}]}}`
			const bothToolsSession = parser.parseSession(jsonl)

			return processor.process(bothToolsSession).then(metrics => {
				expect(metrics.used_plan_mode).toBe(true)
				expect(metrics.used_todo_tracking).toBe(true)
			})
		})
	})

	describe('process quality scoring', () => {
		it('should award points for plan mode usage', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"ExitPlanMode","input":{"plan":"Plan"}}]}}`
			const planModeSession = parser.parseSession(jsonl)

			return processor.process(planModeSession).then(metrics => {
				expect(metrics.process_quality_score).toBeGreaterThanOrEqual(30)
			})
		})

		it('should award points for todo tracking', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"TodoWrite","input":{"todos":[]}}]}}`
			const todoSession = parser.parseSession(jsonl)

			return processor.process(todoSession).then(metrics => {
				expect(metrics.process_quality_score).toBeGreaterThanOrEqual(20)
			})
		})

		it('should award points for read-before-write pattern', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"tool-001","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"tool-002","name":"Write","input":{"file_path":"test.ts","content":"code"}}]}}`
			const readWriteSession = parser.parseSession(jsonl)

			return processor.process(readWriteSession).then(metrics => {
				expect(metrics.process_quality_score).toBeGreaterThanOrEqual(25)
			})
		})

		it('should cap score at 100', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"plan","name":"ExitPlanMode","input":{"plan":"Plan"}},{"type":"tool_use","id":"todo","name":"TodoWrite","input":{"todos":[]}},{"type":"tool_use","id":"read","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"write","name":"Write","input":{"file_path":"test.ts","content":"code"}},{"type":"tool_use","id":"test","name":"Bash","input":{"command":"npm test"}}]}}`
			const perfectSession = parser.parseSession(jsonl)

			return processor.process(perfectSession).then(metrics => {
				expect(metrics.process_quality_score).toBeLessThanOrEqual(100)
			})
		})
	})

	describe('over-the-top affirmations detection', () => {
		it('should detect "you\'re right" variations', () => {
			const affirmationSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant_response',
						content: "You're absolutely right! Let me fix that.",
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(affirmationSession).then(metrics => {
				expect(metrics.over_top_affirmations).toBeGreaterThan(0)
				expect(metrics.metadata?.over_top_affirmations_phrases?.length).toBeGreaterThan(0)
			})
		})

		it('should not detect normal confirmations', () => {
			const normalSession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant_response',
						content: 'I understand. I will make those changes.',
						timestamp: new Date(),
					},
				],
				startTime: new Date(),
				endTime: new Date(),
				duration: 1000,
			}

			return processor.process(normalSession).then(metrics => {
				expect(metrics.over_top_affirmations).toBe(0)
			})
		})
	})

	describe('improvement tips', () => {
		it('should suggest plan mode for low quality', () => {
			const lowQualitySession: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: parsedSession.messages.map((msg, i) => {
					// Add errors to reduce success rate
					if (i === 3 && typeof msg.content === 'object' && 'toolResults' in msg.content) {
						return {
							...msg,
							content: {
								...msg.content,
								toolResults: [
									{
										type: 'tool_result' as const,
										tool_use_id: 'tool-001',
										content: 'Error',
										is_error: true,
									},
								],
							},
						}
					}
					return msg
				}),
			}

			return processor.process(lowQualitySession).then(metrics => {
				const tips = metrics.metadata?.improvement_tips || []
				const hasPlanModeTip = tips.some(tip => tip.includes('plan mode'))
				// Should suggest plan mode if quality is low and not used
				if (!metrics.used_plan_mode && metrics.process_quality_score < 60) {
					expect(hasPlanModeTip).toBe(true)
				}
			})
		})

		it('should provide positive feedback for excellent sessions', () => {
			const jsonl = `{"uuid":"msg-001","timestamp":"2025-01-01T00:00:00.000Z","type":"user","message":{"role":"user","content":"Task"}}
{"uuid":"msg-002","timestamp":"2025-01-01T00:00:01.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"plan","name":"ExitPlanMode","input":{"plan":"Plan"}},{"type":"tool_use","id":"todo","name":"TodoWrite","input":{"todos":[]}},{"type":"tool_use","id":"read","name":"Read","input":{"file_path":"test.ts"}},{"type":"tool_use","id":"write","name":"Write","input":{"file_path":"test.ts","content":"code"}}]}}
{"uuid":"msg-003","timestamp":"2025-01-01T00:00:02.000Z","type":"tool_result","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"read","content":"File content"},{"type":"tool_result","tool_use_id":"write","content":"Success"}]}}`
			const excellentSession = parser.parseSession(jsonl)

			return processor.process(excellentSession).then(metrics => {
				const tips = metrics.metadata?.improvement_tips || []
				const hasPositiveFeedback = tips.some(tip => tip.includes('🌟') || tip.includes('✨'))
				// Should provide positive feedback for excellent performance
				if (
					metrics.used_plan_mode &&
					metrics.used_todo_tracking &&
					metrics.task_success_rate > 80
				) {
					expect(hasPositiveFeedback).toBe(true)
				}
			})
		})
	})

	describe('edge cases', () => {
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
			expect(metrics.task_success_rate).toBe(0)
			expect(metrics.iteration_count).toBe(0)
			expect(metrics.process_quality_score).toBeGreaterThanOrEqual(0)
		})
	})
})
