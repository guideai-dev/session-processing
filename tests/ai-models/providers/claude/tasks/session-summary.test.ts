import { describe, it, expect } from 'vitest'
import {
	SessionSummaryTask,
	type SessionSummaryInput,
} from '../../../../../src/ai-models/providers/claude/tasks/session-summary.js'
import {
	MOCK_CONTEXT,
	MOCK_SESSION,
	EMPTY_SESSION,
	MOCK_SESSION_WITH_PHASES,
} from '../../../fixtures/mock-sessions.js'

describe('SessionSummaryTask', () => {
	let task: SessionSummaryTask

	beforeEach(() => {
		task = new SessionSummaryTask()
	})

	describe('Task Definition', () => {
		it('should have correct task type', () => {
			expect(task.taskType).toBe('session-summary')
		})

		it('should have descriptive name', () => {
			expect(task.name).toBe('Session Summary')
		})

		it('should have description', () => {
			expect(task.description).toBe('Generate a concise summary of the agent session')
		})

		it('should return complete definition', () => {
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('session-summary')
			expect(definition.name).toBe('Session Summary')
			expect(definition.config).toBeDefined()
		})
	})

	describe('Task Configuration', () => {
		it('should return text response format', () => {
			const config = task.getConfig()

			expect(config.responseFormat.type).toBe('text')
		})

		it('should have recording strategy for summary', () => {
			const config = task.getConfig()

			expect(config.recordingStrategy.updateAgentSession).toContain('aiModelSummary')
		})

		it('should have prompt template with variables', () => {
			const config = task.getConfig()

			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('{{provider}}')
			expect(config.prompt).toContain('{{durationMinutes}}')
			expect(config.prompt).toContain('{{messageCount}}')
			expect(config.prompt).toContain('{{toolsUsed}}')
			expect(config.prompt).toContain('{{userMessages}}')
			expect(config.prompt).toContain('{{assistantActions}}')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare valid input from context', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input).toBeDefined()
			expect(input.userName).toBe('@testuser')
			expect(input.provider).toBe('claude-code')
			expect(input.messageCount).toBe(5)
			expect(typeof input.durationMinutes).toBe('number')
		})

		it('should extract user messages', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toContain('authentication system')
			expect(input.userMessages).toContain('password hashing')
		})

		it('should extract tools used', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.toolsUsed).toContain('write')
			expect(input.toolsUsed).toContain('edit')
		})

		it('should extract assistant actions', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.assistantActions).toBeTruthy()
			expect(input.assistantActions).toContain('write')
		})

		it('should calculate duration in minutes', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// 600000ms = 10 minutes
			expect(input.durationMinutes).toBe(10)
		})

		it('should handle unknown duration', () => {
			const contextNoDuration = {
				...MOCK_CONTEXT,
				session: { ...MOCK_SESSION, duration: undefined },
			}

			const input = task.prepareInput(contextNoDuration)

			expect(input.durationMinutes).toBe('Unknown')
		})

		it('should use username from user context', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userName).toBe('@testuser')
		})

		it('should fallback to "the user" when no user context', () => {
			const contextNoUser = { ...MOCK_CONTEXT, user: undefined }

			const input = task.prepareInput(contextNoUser)

			expect(input.userName).toBe('the user')
		})

		it('should limit user messages to first 10', () => {
			// Create a session with many messages
			const manyMessages = Array.from({ length: 20 }, (_, i) => ({
				id: `msg-${i}`,
				type: 'user' as const,
				content: `Message ${i}`,
				timestamp: new Date(),
			}))

			const contextManyMessages = {
				...MOCK_CONTEXT,
				session: { ...MOCK_SESSION, messages: manyMessages },
			}

			const input = task.prepareInput(contextManyMessages)

			// Count the number of message separators (-) in the userMessages string
			const messageCount = (input.userMessages.match(/Message/g) || []).length
			expect(messageCount).toBeLessThanOrEqual(10)
		})

		it('should limit assistant actions to first 20 tools', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// Should be truncated if more than 20
			const toolCount = input.assistantActions.split(',').length
			expect(toolCount).toBeLessThanOrEqual(20)
		})

		it('should deduplicate tools in toolsUsed', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// Each tool should appear only once in the list
			const tools = input.toolsUsed.split(', ')
			const uniqueTools = [...new Set(tools)]
			expect(tools.length).toBe(uniqueTools.length)
		})

		it('should handle session with no tools', () => {
			const noToolsSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'Hello', timestamp: new Date() },
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: { text: 'Hi', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
				],
			}

			const contextNoTools = { ...MOCK_CONTEXT, session: noToolsSession }
			const input = task.prepareInput(contextNoTools)

			expect(input.toolsUsed).toBe('None')
			expect(input.assistantActions).toBe('No tool uses found')
		})

		it('should throw error when session is missing', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextNoSession)).toThrow(
				'Session data is required for summary task'
			)
		})

		it('should handle structured message content', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toBeTruthy()
			expect(input.assistantActions).toBeTruthy()
		})

		it('should handle array message content (fallback)', () => {
			const arrayContentSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: [{ type: 'text', text: 'Array content message' }],
						timestamp: new Date(),
					},
				],
			}

			const contextArrayContent = { ...MOCK_CONTEXT, session: arrayContentSession }
			const input = task.prepareInput(contextArrayContent)

			expect(input.userMessages).toContain('Array content message')
		})

		it('should filter out empty user messages', () => {
			const emptyMessagesSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: '', timestamp: new Date() },
					{ id: 'msg-2', type: 'user' as const, content: 'Real message', timestamp: new Date() },
				],
			}

			const contextEmptyMessages = { ...MOCK_CONTEXT, session: emptyMessagesSession }
			const input = task.prepareInput(contextEmptyMessages)

			expect(input.userMessages).not.toContain('- \n')
			expect(input.userMessages).toContain('Real message')
		})
	})

	describe('Output Processing', () => {
		it('should trim string output', () => {
			const output = task.processOutput('  Test summary with spaces  ', MOCK_CONTEXT)

			expect(output).toBe('Test summary with spaces')
		})

		it('should convert non-string output to string', () => {
			const output = task.processOutput(12345, MOCK_CONTEXT)

			expect(typeof output).toBe('string')
			expect(output).toBe('12345')
		})

		it('should handle object output by converting to string', () => {
			const output = task.processOutput({ summary: 'test' }, MOCK_CONTEXT)

			expect(typeof output).toBe('string')
			// Object.prototype.toString() returns '[object Object]'
			expect(output).toBe('[object Object]')
		})

		it('should handle empty string output', () => {
			const output = task.processOutput('', MOCK_CONTEXT)

			expect(output).toBe('')
		})

		it('should handle multi-line output', () => {
			const multiline = 'Line 1\nLine 2\nLine 3'
			const output = task.processOutput(multiline, MOCK_CONTEXT)

			expect(output).toBe(multiline)
		})
	})

	describe('Execution Validation', () => {
		it('should allow execution with valid context', () => {
			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)
		})

		it('should reject execution without session', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(task.canExecute(contextNoSession)).toBe(false)
		})

		it('should reject execution with empty session', () => {
			const contextEmptySession = { ...MOCK_CONTEXT, session: EMPTY_SESSION }

			expect(task.canExecute(contextEmptySession)).toBe(false)
		})

		it('should reject execution without sessionId', () => {
			const contextNoId = { ...MOCK_CONTEXT, sessionId: '' }

			expect(task.canExecute(contextNoId)).toBe(false)
		})

		it('should reject execution without tenantId', () => {
			const contextNoTenant = { ...MOCK_CONTEXT, tenantId: '' }

			expect(task.canExecute(contextNoTenant)).toBe(false)
		})

		it('should reject execution without userId', () => {
			const contextNoUser = { ...MOCK_CONTEXT, userId: '' }

			expect(task.canExecute(contextNoUser)).toBe(false)
		})

		it('should allow execution with phase context', () => {
			const phaseContext = {
				...MOCK_CONTEXT,
				session: MOCK_SESSION_WITH_PHASES,
			}

			expect(task.canExecute(phaseContext)).toBe(true)
		})
	})

	describe('Integration', () => {
		it('should work with complete session data', () => {
			const config = task.getConfig()
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(config).toBeDefined()
			expect(input).toBeDefined()
			expect(task.canExecute(MOCK_CONTEXT)).toBe(true)
		})

		it('should produce valid input for AI model', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// All required fields should be present
			expect(input.userName).toBeTruthy()
			expect(input.provider).toBeTruthy()
			expect(input.durationMinutes).toBeDefined()
			expect(input.messageCount).toBeGreaterThan(0)
			expect(input.toolsUsed).toBeTruthy()
			expect(input.userMessages).toBeTruthy()
			expect(input.assistantActions).toBeTruthy()
		})

		it('should handle session with phases', () => {
			const phaseContext = {
				...MOCK_CONTEXT,
				session: MOCK_SESSION_WITH_PHASES,
			}

			const input = task.prepareInput(phaseContext)

			expect(input.messageCount).toBe(9)
			expect(input.userMessages).toContain('REST API')
			expect(input.toolsUsed).toContain('write')
		})
	})
})
