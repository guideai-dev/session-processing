import { describe, it, expect, beforeEach } from 'vitest'
import {
	IntentExtractionTask,
	type IntentExtractionInput,
	type IntentExtractionOutput,
} from '../../../../../src/ai-models/providers/claude/tasks/intent-extraction.js'
import {
	MOCK_CONTEXT,
	MOCK_SESSION,
	EMPTY_SESSION,
	MOCK_SESSION_WITH_PHASES,
} from '../../../fixtures/mock-sessions.js'

describe('IntentExtractionTask', () => {
	let task: IntentExtractionTask

	beforeEach(() => {
		task = new IntentExtractionTask()
	})

	describe('Task Definition', () => {
		it('should have correct task type', () => {
			expect(task.taskType).toBe('intent-extraction')
		})

		it('should have descriptive name', () => {
			expect(task.name).toBe('Intent Extraction')
		})

		it('should have description', () => {
			expect(task.description).toBe('Extract user intents and goals from session messages')
		})

		it('should return complete definition', () => {
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('intent-extraction')
			expect(definition.name).toBe('Intent Extraction')
			expect(definition.config).toBeDefined()
		})
	})

	describe('Task Configuration', () => {
		it('should return JSON response format', () => {
			const config = task.getConfig()

			expect(config.responseFormat.type).toBe('json')
		})

		it('should have JSON schema with required fields', () => {
			const config = task.getConfig()

			expect(config.responseFormat.schema).toBeDefined()
			expect(config.responseFormat.schema?.properties).toHaveProperty('primaryGoal')
			expect(config.responseFormat.schema?.properties).toHaveProperty('secondaryGoals')
			expect(config.responseFormat.schema?.properties).toHaveProperty('technologies')
			expect(config.responseFormat.schema?.properties).toHaveProperty('challenges')
			expect(config.responseFormat.schema?.properties).toHaveProperty('taskType')
		})

		it('should have taskType enum in schema', () => {
			const config = task.getConfig()
			const taskTypeProperty = config.responseFormat.schema?.properties?.taskType as Record<
				string,
				unknown
			>

			expect(taskTypeProperty.enum).toContain('feature_development')
			expect(taskTypeProperty.enum).toContain('bug_fix')
			expect(taskTypeProperty.enum).toContain('refactoring')
			expect(taskTypeProperty.enum).toContain('learning')
			expect(taskTypeProperty.enum).toContain('debugging')
			expect(taskTypeProperty.enum).toContain('other')
		})

		it('should have recording strategy for metadata', () => {
			const config = task.getConfig()

			expect(config.recordingStrategy.updateAgentSession).toContain('aiModelMetadata')
			expect(config.recordingStrategy.createMetrics).toBe(true)
			expect(config.recordingStrategy.metricType).toBe('ai_model')
		})

		it('should have prompt template with analysis criteria', () => {
			const config = task.getConfig()

			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('{{userMessages}}')
			expect(config.prompt).toContain('Primary Goal')
			expect(config.prompt).toContain('Secondary Goals')
			expect(config.prompt).toContain('Technical Context')
			expect(config.prompt).toContain('Challenges')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare valid input from context', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input).toBeDefined()
			expect(input.userName).toBe('@testuser')
			expect(input.userMessages).toBeTruthy()
		})

		it('should extract all user messages with numbering', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toContain('[1]')
			expect(input.userMessages).toContain('authentication')
		})

		it('should handle structured message content', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userMessages).toBeTruthy()
			expect(input.userMessages).toContain('authentication')
			expect(input.userMessages).toContain('password hashing')
		})

		it('should handle string content', () => {
			const stringContentSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'String message', timestamp: new Date() },
				],
			}

			const contextStringContent = { ...MOCK_CONTEXT, session: stringContentSession }
			const input = task.prepareInput(contextStringContent)

			expect(input.userMessages).toContain('String message')
		})

		it('should handle array content format (fallback)', () => {
			const arrayContentSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: [{ type: 'text', text: 'Array format message' }],
						timestamp: new Date(),
					},
				],
			}

			const contextArrayContent = { ...MOCK_CONTEXT, session: arrayContentSession }
			const input = task.prepareInput(contextArrayContent)

			expect(input.userMessages).toContain('Array format message')
		})

		it('should filter out empty messages', () => {
			const emptyMessagesSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: '', timestamp: new Date() },
					{ id: 'msg-2', type: 'user' as const, content: 'Real message', timestamp: new Date() },
				],
			}

			const contextEmptyMessages = { ...MOCK_CONTEXT, session: emptyMessagesSession }
			const input = task.prepareInput(contextEmptyMessages)

			// Empty messages leave just "[X] " which is 4 chars, should be filtered
			expect(input.userMessages).not.toContain('[1]')
			expect(input.userMessages).toContain('Real message')
		})

		it('should join messages with double newlines', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// Multiple user messages should be separated by \n\n
			expect(input.userMessages).toContain('\n\n')
		})

		it('should use fallback when no user messages', () => {
			const noUserMessagesSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'assistant' as const,
						content: { text: 'Assistant only', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
				],
			}

			const contextNoUserMessages = { ...MOCK_CONTEXT, session: noUserMessagesSession }
			const input = task.prepareInput(contextNoUserMessages)

			expect(input.userMessages).toBe('No user messages found')
		})

		it('should use username from user context', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.userName).toBe('@testuser')
		})

		it('should use fallback username when no user context', () => {
			const contextNoUser = { ...MOCK_CONTEXT, user: undefined }

			const input = task.prepareInput(contextNoUser)

			expect(input.userName).toBe('the user')
		})

		it('should throw error when session is missing', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextNoSession)).toThrow(
				'Session data is required for intent extraction'
			)
		})

		it('should number messages sequentially', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// Should have numbered messages [1], [2], etc.
			const messageNumbers = input.userMessages.match(/\[\d+\]/g)
			expect(messageNumbers).toBeTruthy()
			if (messageNumbers) {
				expect(messageNumbers.length).toBeGreaterThan(0)
			}
		})
	})

	describe('Output Processing', () => {
		it('should validate and return valid output', () => {
			const validOutput: IntentExtractionOutput = {
				primaryGoal: 'Add authentication',
				secondaryGoals: ['Add password hashing'],
				technologies: ['bcrypt', 'TypeScript'],
				challenges: ['Security concerns'],
				taskType: 'feature_development',
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result).toEqual(validOutput)
		})

		it('should reject non-object output', () => {
			expect(() => task.processOutput('string output', MOCK_CONTEXT)).toThrow(
				'Intent extraction output must be an object'
			)
		})

		it('should reject null output', () => {
			expect(() => task.processOutput(null, MOCK_CONTEXT)).toThrow(
				'Intent extraction output must be an object'
			)
		})

		it('should reject missing primaryGoal', () => {
			const invalidOutput = {
				taskType: 'feature_development',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Primary goal is required and must be a string'
			)
		})

		it('should reject non-string primaryGoal', () => {
			const invalidOutput = {
				primaryGoal: 123,
				taskType: 'feature_development',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Primary goal is required and must be a string'
			)
		})

		it('should default to "other" for missing taskType', () => {
			const outputNoTaskType = {
				primaryGoal: 'Do something',
			}

			const result = task.processOutput(outputNoTaskType, MOCK_CONTEXT)

			expect(result.taskType).toBe('other')
		})

		it('should default to "other" for invalid taskType', () => {
			const invalidTaskType = {
				primaryGoal: 'Do something',
				taskType: 'invalid_type',
			}

			const result = task.processOutput(invalidTaskType, MOCK_CONTEXT)

			expect(result.taskType).toBe('other')
		})

		it('should accept all valid task types', () => {
			const validTaskTypes = [
				'feature_development',
				'bug_fix',
				'refactoring',
				'learning',
				'debugging',
				'other',
			]

			for (const taskType of validTaskTypes) {
				const output = {
					primaryGoal: 'Test',
					taskType,
				}

				const result = task.processOutput(output, MOCK_CONTEXT)

				expect(result.taskType).toBe(taskType)
			}
		})

		it('should provide empty arrays for missing optional fields', () => {
			const minimalOutput = {
				primaryGoal: 'Build feature',
				taskType: 'feature_development',
			}

			const result = task.processOutput(minimalOutput, MOCK_CONTEXT)

			expect(result.secondaryGoals).toEqual([])
			expect(result.technologies).toEqual([])
			expect(result.challenges).toEqual([])
		})

		it('should convert non-array secondaryGoals to empty array', () => {
			const invalidArrayOutput = {
				primaryGoal: 'Build feature',
				secondaryGoals: 'not an array',
				taskType: 'feature_development',
			}

			const result = task.processOutput(invalidArrayOutput, MOCK_CONTEXT)

			expect(result.secondaryGoals).toEqual([])
		})

		it('should convert non-array technologies to empty array', () => {
			const invalidArrayOutput = {
				primaryGoal: 'Build feature',
				technologies: 'not an array',
				taskType: 'feature_development',
			}

			const result = task.processOutput(invalidArrayOutput, MOCK_CONTEXT)

			expect(result.technologies).toEqual([])
		})

		it('should convert non-array challenges to empty array', () => {
			const invalidArrayOutput = {
				primaryGoal: 'Build feature',
				challenges: 'not an array',
				taskType: 'feature_development',
			}

			const result = task.processOutput(invalidArrayOutput, MOCK_CONTEXT)

			expect(result.challenges).toEqual([])
		})

		it('should preserve valid arrays', () => {
			const validOutput = {
				primaryGoal: 'Build feature',
				secondaryGoals: ['Goal 1', 'Goal 2'],
				technologies: ['React', 'TypeScript'],
				challenges: ['Challenge 1'],
				taskType: 'feature_development' as const,
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result.secondaryGoals).toHaveLength(2)
			expect(result.technologies).toHaveLength(2)
			expect(result.challenges).toHaveLength(1)
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

		it('should reject execution without user messages', () => {
			const noUserMessagesSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'assistant' as const,
						content: { text: 'Assistant only', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
				],
			}

			const contextNoUserMessages = { ...MOCK_CONTEXT, session: noUserMessagesSession }

			expect(task.canExecute(contextNoUserMessages)).toBe(false)
		})

		it('should require at least one user message', () => {
			const oneUserMessageSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'Hello', timestamp: new Date() },
				],
			}

			const contextOneUserMessage = { ...MOCK_CONTEXT, session: oneUserMessageSession }

			expect(task.canExecute(contextOneUserMessage)).toBe(true)
		})

		it('should reject execution without sessionId', () => {
			const contextNoId = { ...MOCK_CONTEXT, sessionId: '' }

			expect(task.canExecute(contextNoId)).toBe(false)
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

			expect(input.userName).toBeTruthy()
			expect(input.userMessages).toBeTruthy()
		})

		it('should handle session with phases', () => {
			const phaseContext = {
				...MOCK_CONTEXT,
				session: MOCK_SESSION_WITH_PHASES,
			}

			const input = task.prepareInput(phaseContext)

			expect(input.userMessages).toContain('REST API')
			expect(input.userMessages).toContain('blog posts')
		})

		it('should handle full intent extraction flow', () => {
			// Prepare input
			const input = task.prepareInput(MOCK_CONTEXT)
			expect(input).toBeDefined()

			// Mock AI output
			const aiOutput: IntentExtractionOutput = {
				primaryGoal: 'Create user authentication system',
				secondaryGoals: ['Add password hashing', 'Ensure security'],
				technologies: ['TypeScript', 'bcrypt', 'Node.js'],
				challenges: ['Security implementation', 'Password storage'],
				taskType: 'feature_development',
			}

			// Process output
			const result = task.processOutput(aiOutput, MOCK_CONTEXT)

			expect(result.primaryGoal).toBe('Create user authentication system')
			expect(result.taskType).toBe('feature_development')
			expect(result.technologies.length).toBeGreaterThan(0)
		})

		it('should handle different task types', () => {
			const taskTypes: IntentExtractionOutput['taskType'][] = [
				'bug_fix',
				'refactoring',
				'learning',
				'debugging',
			]

			for (const taskType of taskTypes) {
				const output: IntentExtractionOutput = {
					primaryGoal: `Test ${taskType}`,
					taskType,
				}

				const result = task.processOutput(output, MOCK_CONTEXT)

				expect(result.taskType).toBe(taskType)
			}
		})
	})
})
