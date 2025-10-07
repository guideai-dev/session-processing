import { describe, it, expect } from 'vitest'
import { SessionPhaseAnalysisTask } from '../providers/claude/tasks/session-phase-analysis.js'
import {
	MOCK_PHASE_CONTEXT,
	MOCK_SESSION_WITH_PHASES,
	EMPTY_SESSION,
} from './fixtures/mock-sessions.js'

describe('SessionPhaseAnalysisTask', () => {
	describe('Task Definition', () => {
		it('should have correct task type', () => {
			const task = new SessionPhaseAnalysisTask()
			expect(task.taskType).toBe('session-phase-analysis')
		})

		it('should have name and description', () => {
			const task = new SessionPhaseAnalysisTask()
			expect(task.name).toBe('Session Phase Analysis')
			expect(task.description).toBeTruthy()
		})

		it('should return task definition', () => {
			const task = new SessionPhaseAnalysisTask()
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('session-phase-analysis')
			expect(definition.name).toBe('Session Phase Analysis')
			expect(definition.description).toBeTruthy()
			expect(definition.config).toBeDefined()
		})
	})

	describe('Configuration', () => {
		it('should return valid config', () => {
			const task = new SessionPhaseAnalysisTask()
			const config = task.getConfig()

			expect(config.taskType).toBe('session-phase-analysis')
			expect(config.prompt).toBeTruthy()
			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('{{provider}}')
			expect(config.prompt).toContain('{{transcript}}')
		})

		it('should use JSON response format', () => {
			const task = new SessionPhaseAnalysisTask()
			const config = task.getConfig()

			expect(config.responseFormat).toBeDefined()
			expect(config.responseFormat?.type).toBe('json')
			expect(config.responseFormat?.schema).toBeDefined()
		})

		it('should have recording strategy for aiModelPhaseAnalysis', () => {
			const task = new SessionPhaseAnalysisTask()
			const config = task.getConfig()

			expect(config.recordingStrategy).toBeDefined()
			expect(config.recordingStrategy?.updateAgentSession).toContain('aiModelPhaseAnalysis')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare input from session context', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input).toHaveProperty('userName')
			expect(input).toHaveProperty('provider')
			expect(input).toHaveProperty('durationMinutes')
			expect(input).toHaveProperty('messageCount')
			expect(input).toHaveProperty('sessionStart')
			expect(input).toHaveProperty('sessionEnd')
			expect(input).toHaveProperty('transcript')
			expect(input).toHaveProperty('phasePattern')
		})

		it('should format transcript with step numbers', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.transcript).toContain('Step 1')
			expect(input.transcript).toContain('@testuser')
			expect(input.transcript).toContain('Assistant')
		})

		it('should include all messages in transcript', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			const stepCount = (input.transcript.match(/Step \d+/g) || []).length
			expect(stepCount).toBe(MOCK_SESSION_WITH_PHASES.messages.length)
		})

		it('should calculate duration in minutes', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.durationMinutes).toBe(30)
		})

		it('should include phase pattern in input', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.phasePattern).toContain('Initial Specification')
			expect(input.phasePattern).toContain('Analysis & Planning')
			expect(input.phasePattern).toContain('Execution')
			expect(input.phasePattern).toContain('Completion')
		})

		it('should handle user display name', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.userName).toBe('@testuser')
		})

		it('should default to "the user" when user not provided', () => {
			const task = new SessionPhaseAnalysisTask()
			const contextWithoutUser = { ...MOCK_PHASE_CONTEXT, user: undefined }
			const input = task.prepareInput(contextWithoutUser)

			expect(input.userName).toBe('the user')
		})

		it('should throw error when session is missing', () => {
			const task = new SessionPhaseAnalysisTask()
			const contextWithoutSession = { ...MOCK_PHASE_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextWithoutSession)).toThrow(
				'Session data is required'
			)
		})

		it('should include timestamps in transcript', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.sessionStart).toBeTruthy()
			expect(input.sessionEnd).toBeTruthy()
		})
	})

	describe('Output Processing', () => {
		it('should parse valid JSON phase analysis output', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'User requested to build a REST API',
						durationMs: 0,
					},
					{
						phaseType: 'execution',
						startStep: 5,
						endStep: 6,
						stepCount: 2,
						summary: 'AI created models and routes',
						durationMs: 300000,
					},
				],
				totalPhases: 2,
				totalSteps: 9,
				sessionDurationMs: 1800000,
				pattern: 'initial_specification -> execution',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result).toBeDefined()
			expect(result.phases).toHaveLength(2)
			expect(result.totalPhases).toBe(2)
			expect(result.pattern).toBeTruthy()
		})

		it('should process valid object output', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [],
				totalPhases: 0,
				totalSteps: 0,
				sessionDurationMs: 0,
				pattern: 'none',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)
			expect(result).toBeDefined()
			expect(result.phases).toEqual([])
		})

		it('should throw error for non-object output', () => {
			const task = new SessionPhaseAnalysisTask()

			expect(() => task.processOutput('invalid json', MOCK_PHASE_CONTEXT)).toThrow(
				'Phase analysis output must be an object'
			)
		})

		it('should throw error for null output', () => {
			const task = new SessionPhaseAnalysisTask()

			expect(() => task.processOutput(null, MOCK_PHASE_CONTEXT)).toThrow(
				'Phase analysis output must be an object'
			)
		})

		it('should throw error for missing phases array', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				totalPhases: 0,
				totalSteps: 0,
				sessionDurationMs: 0,
				pattern: 'none',
			}

			expect(() => task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)).toThrow(
				'Phase analysis output must contain a phases array'
			)
		})
	})

	describe('Execution Validation', () => {
		it('should validate context has required fields', () => {
			const task = new SessionPhaseAnalysisTask()
			expect(task.canExecute(MOCK_PHASE_CONTEXT)).toBe(true)
		})

		it('should reject context missing sessionId', () => {
			const task = new SessionPhaseAnalysisTask()
			const invalidContext = { ...MOCK_PHASE_CONTEXT, sessionId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing tenantId', () => {
			const task = new SessionPhaseAnalysisTask()
			const invalidContext = { ...MOCK_PHASE_CONTEXT, tenantId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})

		it('should reject context missing userId', () => {
			const task = new SessionPhaseAnalysisTask()
			const invalidContext = { ...MOCK_PHASE_CONTEXT, userId: '' }
			expect(task.canExecute(invalidContext)).toBe(false)
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty messages array', () => {
			const task = new SessionPhaseAnalysisTask()
			const contextWithEmptySession = {
				...MOCK_PHASE_CONTEXT,
				session: EMPTY_SESSION,
			}

			const input = task.prepareInput(contextWithEmptySession)
			expect(input.transcript).toBe('')
			expect(input.messageCount).toBe(0)
		})

		it('should handle messages with structured content', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.transcript).toBeTruthy()
		})

		it('should extract text from content objects', () => {
			const task = new SessionPhaseAnalysisTask()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.transcript).toContain('Let me analyze the requirements')
		})
	})
})
