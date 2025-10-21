import { describe, it, expect } from 'vitest'
import { SessionSummaryTask } from '../../src/ai-models/providers/claude/tasks/session-summary.js'
import { MOCK_CONTEXT, MOCK_SESSION, EMPTY_SESSION } from './fixtures/mock-sessions.js'

describe('SessionSummaryTask', () => {
	describe('Task Definition', () => {
		it('should have correct task type', () => {
			const task = new SessionSummaryTask()
			expect(task.taskType).toBe('session-summary')
		})

		it('should have name and description', () => {
			const task = new SessionSummaryTask()
			expect(task.name).toBe('Session Summary')
			expect(task.description).toBeTruthy()
		})

		it('should return task definition', () => {
			const task = new SessionSummaryTask()
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('session-summary')
			expect(definition.name).toBe('Session Summary')
			expect(definition.description).toBeTruthy()
			expect(definition.config).toBeDefined()
		})
	})

	describe('Configuration', () => {
		it('should return valid config', () => {
			const task = new SessionSummaryTask()
			const config = task.getConfig()

			expect(config.taskType).toBe('session-summary')
			expect(config.prompt).toBeTruthy()
			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('{{provider}}')
			expect(config.prompt).toContain('{{durationMinutes}}')
			expect(config.responseFormat).toEqual({ type: 'text' })
		})

		it('should have recording strategy for aiModelSummary', () => {
			const task = new SessionSummaryTask()
			const config = task.getConfig()

			expect(config.recordingStrategy).toBeDefined()
			expect(config.recordingStrategy?.updateAgentSession).toContain('aiModelSummary')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare input from session context', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input).toHaveProperty('userName')
			expect(input).toHaveProperty('provider')
			expect(input).toHaveProperty('durationMinutes')
			expect(input).toHaveProperty('messageCount')
			expect(input).toHaveProperty('toolsUsed')
			expect(input).toHaveProperty('userMessages')
			expect(input).toHaveProperty('assistantActions')
		})

		it('should extract user messages correctly', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toContain(
				'Can you help me create a user authentication system?'
			)
			expect(input.userMessages).toContain('Great! Can you add password hashing?')
		})

		it('should extract tool uses from assistant messages', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.toolsUsed).toContain('write')
			expect(input.toolsUsed).toContain('edit')
		})

		it('should calculate duration in minutes', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.durationMinutes).toBe(10)
		})

		it('should count messages correctly', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.messageCount).toBe(5)
		})

		it('should use user display name when available', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userName).toBe('@testuser')
		})

		it('should default to "the user" when user not provided', () => {
			const task = new SessionSummaryTask()
			const contextWithoutUser = { ...MOCK_CONTEXT, user: undefined }
			const input = task.prepareInput(contextWithoutUser)

			expect(input.userName).toBe('the user')
		})

		it('should throw error when session is missing', () => {
			const task = new SessionSummaryTask()
			const contextWithoutSession = { ...MOCK_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextWithoutSession)).toThrow(
				'Session data is required'
			)
		})

		it('should handle session with no tool uses', () => {
			const task = new SessionSummaryTask()
			const sessionWithoutTools = {
				...MOCK_CONTEXT,
				session: {
					...MOCK_SESSION,
					messages: MOCK_SESSION.messages.map((msg) => ({
						...msg,
						content: typeof msg.content === 'string' ? msg.content : { text: 'No tools' },
					})),
				},
			}

			const input = task.prepareInput(sessionWithoutTools)
			expect(input.toolsUsed).toBe('None')
		})
	})

	describe('Execution Validation', () => {
		it('should validate context has required fields', () => {
			const task = new SessionSummaryTask()
			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)
		})

		it('should reject context missing sessionId', () => {
			const task = new SessionSummaryTask()
			const invalidContext = { ...MOCK_CONTEXT, sessionId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing tenantId', () => {
			const task = new SessionSummaryTask()
			const invalidContext = { ...MOCK_CONTEXT, tenantId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing userId', () => {
			const task = new SessionSummaryTask()
			const invalidContext = { ...MOCK_CONTEXT, userId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})
	})

	describe('Output Processing', () => {
		it('should return output as-is by default', () => {
			const task = new SessionSummaryTask()
			const mockOutput = 'This is a test summary'
			const result = task.processOutput(mockOutput, MOCK_CONTEXT)

			expect(result).toBe(mockOutput)
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty messages array', () => {
			const task = new SessionSummaryTask()
			const contextWithEmptySession = {
				...MOCK_CONTEXT,
				session: EMPTY_SESSION,
			}

			const input = task.prepareInput(contextWithEmptySession)
			expect(input.userMessages).toBe('No user messages found')
			expect(input.assistantActions).toBe('No tool uses found')
			expect(input.toolsUsed).toBe('None')
		})

		it('should limit user messages to first 10', () => {
			const task = new SessionSummaryTask()
			const manyMessages = Array.from({ length: 20 }, (_, i) => ({
				id: `msg-${i}`,
				type: 'user' as const,
				content: `Message ${i}`,
				timestamp: new Date(),
			}))

			const contextWithManyMessages = {
				...MOCK_CONTEXT,
				session: {
					...MOCK_SESSION,
					messages: manyMessages,
				},
			}

			const input = task.prepareInput(contextWithManyMessages)
			const messageList = input.userMessages.split('\n- ').filter(Boolean)
			expect(messageList.length).toBeLessThanOrEqual(10)
		})

		it('should handle structured content with text field', () => {
			const task = new SessionSummaryTask()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toBeTruthy()
		})
	})
})
