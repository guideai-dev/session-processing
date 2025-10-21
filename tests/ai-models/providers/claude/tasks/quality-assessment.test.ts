import { describe, it, expect, beforeEach } from 'vitest'
import {
	QualityAssessmentTask,
	type QualityAssessmentInput,
	type QualityAssessmentOutput,
} from '../../../../../src/ai-models/providers/claude/tasks/quality-assessment.js'
import {
	MOCK_CONTEXT,
	MOCK_SESSION,
	EMPTY_SESSION,
	MOCK_SESSION_WITH_PHASES,
} from '../../../fixtures/mock-sessions.js'

describe('QualityAssessmentTask', () => {
	let task: QualityAssessmentTask

	beforeEach(() => {
		task = new QualityAssessmentTask()
	})

	describe('Task Definition', () => {
		it('should have correct task type', () => {
			expect(task.taskType).toBe('quality-assessment')
		})

		it('should have descriptive name', () => {
			expect(task.name).toBe('Quality Assessment')
		})

		it('should have description', () => {
			expect(task.description).toBe('Evaluate session quality and provide a score')
		})

		it('should return complete definition', () => {
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('quality-assessment')
			expect(definition.name).toBe('Quality Assessment')
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
			expect(config.responseFormat.schema?.properties).toHaveProperty('score')
			expect(config.responseFormat.schema?.properties).toHaveProperty('reasoning')
			expect(config.responseFormat.schema?.properties).toHaveProperty('strengths')
			expect(config.responseFormat.schema?.properties).toHaveProperty('improvements')
		})

		it('should have score constraints in schema', () => {
			const config = task.getConfig()
			const scoreProperty = config.responseFormat.schema?.properties?.score as Record<
				string,
				unknown
			>

			expect(scoreProperty.type).toBe('number')
			expect(scoreProperty.minimum).toBe(0)
			expect(scoreProperty.maximum).toBe(100)
		})

		it('should have recording strategy for quality metrics', () => {
			const config = task.getConfig()

			expect(config.recordingStrategy.updateAgentSession).toContain('aiModelQualityScore')
			expect(config.recordingStrategy.updateAgentSession).toContain('aiModelMetadata')
			expect(config.recordingStrategy.createMetrics).toBe(true)
			expect(config.recordingStrategy.metricType).toBe('ai_model')
		})

		it('should have prompt template with quality criteria', () => {
			const config = task.getConfig()

			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('Context Quality')
			expect(config.prompt).toContain('Prompt Clarity')
			expect(config.prompt).toContain('Steering Effectiveness')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare valid input from context', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input).toBeDefined()
			expect(input.userName).toBe('@testuser')
			expect(input.provider).toBe('claude-code')
			expect(input.messageCount).toBe(5)
			expect(input.durationMinutes).toBe(10)
		})

		it('should count interruptions correctly', () => {
			// Mock session has one interruption (msg-3 and msg-5 are consecutive users)
			const input = task.prepareInput(MOCK_CONTEXT)

			// In MOCK_SESSION: user, assistant, user, assistant, user
			// No consecutive user messages, so 0 interruptions
			expect(input.interruptionCount).toBe(0)
		})

		it('should detect consecutive user messages as interruptions', () => {
			const interruptedSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'First', timestamp: new Date() },
					{ id: 'msg-2', type: 'user' as const, content: 'Second', timestamp: new Date() },
					{
						id: 'msg-3',
						type: 'assistant' as const,
						content: { text: 'Response', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
					{ id: 'msg-4', type: 'user' as const, content: 'Third', timestamp: new Date() },
					{ id: 'msg-5', type: 'user' as const, content: 'Fourth', timestamp: new Date() },
				],
			}

			const contextInterrupted = { ...MOCK_CONTEXT, session: interruptedSession }
			const input = task.prepareInput(contextInterrupted)

			// Two consecutive user pairs = 2 interruptions
			expect(input.interruptionCount).toBe(2)
		})

		it('should count unique tools used', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			// MOCK_SESSION uses 'write' and 'edit' tools
			expect(input.toolCount).toBe(2)
		})

		it('should deduplicate tool names', () => {
			const repeatedToolsSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'assistant' as const,
						content: {
							text: 'Using write',
							toolUses: [{ type: 'tool_use', id: 'tool-1', name: 'write', input: {} }],
							toolResults: [],
							structured: [],
						},
						timestamp: new Date(),
					},
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: {
							text: 'Using write again',
							toolUses: [{ type: 'tool_use', id: 'tool-2', name: 'write', input: {} }],
							toolResults: [],
							structured: [],
						},
						timestamp: new Date(),
					},
				],
			}

			const contextRepeatedTools = { ...MOCK_CONTEXT, session: repeatedToolsSession }
			const input = task.prepareInput(contextRepeatedTools)

			// Only 1 unique tool despite 2 uses
			expect(input.toolCount).toBe(1)
		})

		it('should estimate error count from content', () => {
			const errorSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'Do this task', timestamp: new Date() },
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: { text: 'Error occurred while processing', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
					{
						id: 'msg-3',
						type: 'user' as const,
						content: 'The test failed',
						timestamp: new Date(),
					},
					{
						id: 'msg-4',
						type: 'assistant' as const,
						content: { text: 'Caught an exception', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
				],
			}

			const contextError = { ...MOCK_CONTEXT, session: errorSession }
			const input = task.prepareInput(contextError)

			// Should find 'error', 'failed', 'exception'
			expect(input.errorCount).toBeGreaterThan(0)
		})

		it('should detect errors in structured content', () => {
			const structuredErrorSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'assistant' as const,
						content: { text: 'An error occurred', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date(),
					},
				],
			}

			const contextStructuredError = { ...MOCK_CONTEXT, session: structuredErrorSession }
			const input = task.prepareInput(contextStructuredError)

			expect(input.errorCount).toBe(1)
		})

		it('should handle array content format (fallback)', () => {
			const arrayContentSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'assistant' as const,
						content: [
							{ type: 'tool_use', id: 'tool-1', name: 'bash', input: {} },
							{ type: 'tool_use', id: 'tool-2', name: 'read', input: {} },
						],
						timestamp: new Date(),
					},
				],
			}

			const contextArrayContent = { ...MOCK_CONTEXT, session: arrayContentSession }
			const input = task.prepareInput(contextArrayContent)

			expect(input.toolCount).toBe(2)
		})

		it('should use fallback username when no user context', () => {
			const contextNoUser = { ...MOCK_CONTEXT, user: undefined }

			const input = task.prepareInput(contextNoUser)

			expect(input.userName).toBe('the user')
		})

		it('should throw error when session is missing', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextNoSession)).toThrow(
				'Session data is required for quality assessment'
			)
		})

		it('should calculate duration in minutes', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.durationMinutes).toBe(10)
		})

		it('should handle zero duration', () => {
			const contextNoDuration = {
				...MOCK_CONTEXT,
				session: { ...MOCK_SESSION, duration: 0 },
			}

			const input = task.prepareInput(contextNoDuration)

			expect(input.durationMinutes).toBe(0)
		})
	})

	describe('Output Processing', () => {
		it('should validate and return valid output', () => {
			const validOutput: QualityAssessmentOutput = {
				score: 85,
				reasoning: 'Good collaboration',
				strengths: ['Clear prompts', 'Good context'],
				improvements: ['More documentation'],
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result).toEqual(validOutput)
		})

		it('should reject non-object output', () => {
			expect(() => task.processOutput('string output', MOCK_CONTEXT)).toThrow(
				'Quality assessment output must be an object'
			)
		})

		it('should reject null output', () => {
			expect(() => task.processOutput(null, MOCK_CONTEXT)).toThrow(
				'Quality assessment output must be an object'
			)
		})

		it('should reject invalid score below 0', () => {
			const invalidOutput = {
				score: -10,
				reasoning: 'Invalid',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Quality score must be a number between 0 and 100'
			)
		})

		it('should reject invalid score above 100', () => {
			const invalidOutput = {
				score: 150,
				reasoning: 'Invalid',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Quality score must be a number between 0 and 100'
			)
		})

		it('should reject non-number score', () => {
			const invalidOutput = {
				score: '85',
				reasoning: 'Invalid',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Quality score must be a number between 0 and 100'
			)
		})

		it('should accept score of 0', () => {
			const validOutput = {
				score: 0,
				reasoning: 'Poor quality',
				strengths: [],
				improvements: ['Everything'],
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result.score).toBe(0)
		})

		it('should accept score of 100', () => {
			const validOutput = {
				score: 100,
				reasoning: 'Perfect quality',
				strengths: ['Excellent'],
				improvements: [],
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result.score).toBe(100)
		})

		it('should provide default empty string for missing reasoning', () => {
			const outputNoReasoning = {
				score: 75,
			}

			const result = task.processOutput(outputNoReasoning, MOCK_CONTEXT)

			expect(result.reasoning).toBe('')
		})

		it('should provide empty arrays for missing strengths', () => {
			const outputNoStrengths = {
				score: 75,
				reasoning: 'Good',
			}

			const result = task.processOutput(outputNoStrengths, MOCK_CONTEXT)

			expect(result.strengths).toEqual([])
		})

		it('should provide empty arrays for missing improvements', () => {
			const outputNoImprovements = {
				score: 75,
				reasoning: 'Good',
			}

			const result = task.processOutput(outputNoImprovements, MOCK_CONTEXT)

			expect(result.improvements).toEqual([])
		})

		it('should handle non-array strengths by converting to empty array', () => {
			const invalidArrayOutput = {
				score: 75,
				reasoning: 'Good',
				strengths: 'not an array',
			}

			const result = task.processOutput(invalidArrayOutput, MOCK_CONTEXT)

			expect(result.strengths).toEqual([])
		})

		it('should handle non-array improvements by converting to empty array', () => {
			const invalidArrayOutput = {
				score: 75,
				reasoning: 'Good',
				improvements: 'not an array',
			}

			const result = task.processOutput(invalidArrayOutput, MOCK_CONTEXT)

			expect(result.improvements).toEqual([])
		})

		it('should preserve valid arrays', () => {
			const validOutput = {
				score: 85,
				reasoning: 'Great',
				strengths: ['Strength 1', 'Strength 2'],
				improvements: ['Improvement 1'],
			}

			const result = task.processOutput(validOutput, MOCK_CONTEXT)

			expect(result.strengths).toHaveLength(2)
			expect(result.improvements).toHaveLength(1)
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
			expect(input.provider).toBeTruthy()
			expect(input.durationMinutes).toBeDefined()
			expect(input.messageCount).toBeGreaterThan(0)
			expect(input.interruptionCount).toBeGreaterThanOrEqual(0)
			expect(input.toolCount).toBeGreaterThanOrEqual(0)
			expect(input.errorCount).toBeGreaterThanOrEqual(0)
		})

		it('should handle session with phases and complex interactions', () => {
			const phaseContext = {
				...MOCK_CONTEXT,
				session: MOCK_SESSION_WITH_PHASES,
			}

			const input = task.prepareInput(phaseContext)

			expect(input.messageCount).toBe(9)
			expect(input.interruptionCount).toBeGreaterThanOrEqual(0)
			expect(input.toolCount).toBeGreaterThan(0)
		})

		it('should handle full quality assessment flow', () => {
			// Prepare input
			const input = task.prepareInput(MOCK_CONTEXT)
			expect(input).toBeDefined()

			// Mock AI output
			const aiOutput: QualityAssessmentOutput = {
				score: 90,
				reasoning: 'Excellent collaboration with clear context and effective prompts',
				strengths: [
					'Provided comprehensive technical details',
					'Asked specific, actionable questions',
				],
				improvements: ['Could add more documentation upfront'],
			}

			// Process output
			const result = task.processOutput(aiOutput, MOCK_CONTEXT)

			expect(result.score).toBe(90)
			expect(result.reasoning).toBeTruthy()
			expect(result.strengths.length).toBeGreaterThan(0)
			expect(result.improvements.length).toBeGreaterThan(0)
		})
	})
})
