import { describe, it, expect, beforeEach } from 'vitest'
import {
	SessionPhaseAnalysisTask,
	type PhaseAnalysisInput,
	type SessionPhaseAnalysis,
	type SessionPhase,
	type SessionPhaseType,
} from '../../../../../src/ai-models/providers/claude/tasks/session-phase-analysis.js'
import {
	MOCK_CONTEXT,
	MOCK_SESSION,
	EMPTY_SESSION,
	MOCK_SESSION_WITH_PHASES,
	MOCK_PHASE_CONTEXT,
} from '../../../fixtures/mock-sessions.js'

describe('SessionPhaseAnalysisTask', () => {
	let task: SessionPhaseAnalysisTask

	beforeEach(() => {
		task = new SessionPhaseAnalysisTask()
	})

	describe('Task Definition', () => {
		it('should have correct task type', () => {
			expect(task.taskType).toBe('session-phase-analysis')
		})

		it('should have descriptive name', () => {
			expect(task.name).toBe('Session Phase Analysis')
		})

		it('should have description', () => {
			expect(task.description).toBe(
				'Analyze chat transcript and identify meaningful phases in the session flow'
			)
		})

		it('should return complete definition', () => {
			const definition = task.getDefinition()

			expect(definition.taskType).toBe('session-phase-analysis')
			expect(definition.name).toBe('Session Phase Analysis')
			expect(definition.config).toBeDefined()
		})
	})

	describe('Task Configuration', () => {
		it('should return JSON response format', () => {
			const config = task.getConfig()

			expect(config.responseFormat.type).toBe('json')
		})

		it('should have comprehensive JSON schema', () => {
			const config = task.getConfig()

			expect(config.responseFormat.schema).toBeDefined()
			expect(config.responseFormat.schema?.properties).toHaveProperty('phases')
			expect(config.responseFormat.schema?.properties).toHaveProperty('totalPhases')
			expect(config.responseFormat.schema?.properties).toHaveProperty('totalSteps')
			expect(config.responseFormat.schema?.properties).toHaveProperty('sessionDurationMs')
			expect(config.responseFormat.schema?.properties).toHaveProperty('pattern')
		})

		it('should have phases array schema', () => {
			const config = task.getConfig()
			const phasesProperty = config.responseFormat.schema?.properties?.phases as Record<
				string,
				unknown
			>

			expect(phasesProperty.type).toBe('array')
			expect(phasesProperty.items).toBeDefined()
		})

		it('should have phase item schema with required fields', () => {
			const config = task.getConfig()
			const phasesProperty = config.responseFormat.schema?.properties?.phases as {
				items: { properties: Record<string, unknown>; required: string[] }
			}

			expect(phasesProperty.items.required).toContain('phaseType')
			expect(phasesProperty.items.required).toContain('startStep')
			expect(phasesProperty.items.required).toContain('endStep')
			expect(phasesProperty.items.required).toContain('stepCount')
			expect(phasesProperty.items.required).toContain('summary')
			expect(phasesProperty.items.required).toContain('durationMs')
		})

		it('should have recording strategy for phase analysis', () => {
			const config = task.getConfig()

			expect(config.recordingStrategy.updateAgentSession).toContain('aiModelPhaseAnalysis')
		})

		it('should have comprehensive prompt template', () => {
			const config = task.getConfig()

			expect(config.prompt).toContain('{{userName}}')
			expect(config.prompt).toContain('{{provider}}')
			expect(config.prompt).toContain('{{durationMinutes}}')
			expect(config.prompt).toContain('{{messageCount}}')
			expect(config.prompt).toContain('{{phasePattern}}')
			expect(config.prompt).toContain('{{transcript}}')
			expect(config.prompt).toContain('CRITICAL INSTRUCTIONS')
		})

		it('should list all valid phase types in prompt', () => {
			const config = task.getConfig()

			expect(config.prompt).toContain('initial_specification')
			expect(config.prompt).toContain('analysis_planning')
			expect(config.prompt).toContain('plan_modification')
			expect(config.prompt).toContain('plan_agreement')
			expect(config.prompt).toContain('execution')
			expect(config.prompt).toContain('interruption')
			expect(config.prompt).toContain('task_assignment')
			expect(config.prompt).toContain('completion')
			expect(config.prompt).toContain('correction')
			expect(config.prompt).toContain('final_completion')
			expect(config.prompt).toContain('other')
		})
	})

	describe('Input Preparation', () => {
		it('should prepare valid input from context', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input).toBeDefined()
			expect(input.userName).toBe('@testuser')
			expect(input.provider).toBe('claude-code')
			expect(input.messageCount).toBe(9)
		})

		it('should build full transcript with step numbers', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.transcript).toContain('Step 1')
			expect(input.transcript).toContain('Step 2')
			expect(input.transcript).toContain('testuser:')
			expect(input.transcript).toContain('Assistant:')
		})

		it('should include timestamps in transcript', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			// Should have ISO timestamp format
			expect(input.transcript).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
		})

		it('should include tool information for assistant messages', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.transcript).toContain('[Tools used:')
			expect(input.transcript).toContain('write')
		})

		it('should truncate very long messages', () => {
			const longMessageSession = {
				...MOCK_SESSION,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: 'A'.repeat(2000),
						timestamp: new Date(),
					},
				],
			}

			const contextLongMessage = { ...MOCK_CONTEXT, session: longMessageSession }
			const input = task.prepareInput(contextLongMessage)

			expect(input.transcript).toContain('[truncated]')
		})

		it('should not truncate normal-length messages', () => {
			const input = task.prepareInput(MOCK_CONTEXT)

			expect(input.transcript).not.toContain('[truncated]')
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

			expect(input.transcript).toContain('String message')
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

			expect(input.transcript).toContain('Array format message')
		})

		it('should calculate duration in minutes', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			// MOCK_SESSION_WITH_PHASES has 1800000ms = 30 minutes
			expect(input.durationMinutes).toBe(30)
		})

		it('should handle unknown duration', () => {
			const contextNoDuration = {
				...MOCK_CONTEXT,
				session: { ...MOCK_SESSION, duration: undefined },
			}

			const input = task.prepareInput(contextNoDuration)

			expect(input.durationMinutes).toBe('Unknown')
		})

		it('should format session start time', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.sessionStart).toMatch(/\d{4}-\d{2}-\d{2}T/)
		})

		it('should format session end time', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.sessionEnd).toMatch(/\d{4}-\d{2}-\d{2}T/)
		})

		it('should include session duration in milliseconds', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.sessionDurationMs).toBe(1800000)
		})

		it('should include default phase pattern', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.phasePattern).toContain('Initial Specification')
			expect(input.phasePattern).toContain('Analysis & Planning')
			expect(input.phasePattern).toContain('Execution')
		})

		it('should use username from user context', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.userName).toBe('@testuser')
			expect(input.transcript).toContain('@testuser:')
		})

		it('should use fallback username when no user context', () => {
			const contextNoUser = { ...MOCK_PHASE_CONTEXT, user: undefined }

			const input = task.prepareInput(contextNoUser)

			expect(input.userName).toBe('the user')
		})

		it('should throw error when session is missing', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(() => task.prepareInput(contextNoSession)).toThrow(
				'Session data is required for phase analysis'
			)
		})

		it('should handle missing timestamps gracefully', () => {
			const noTimestampSession = {
				...MOCK_SESSION,
				messages: [
					{ id: 'msg-1', type: 'user' as const, content: 'Test', timestamp: undefined },
				],
			}

			const contextNoTimestamp = { ...MOCK_CONTEXT, session: noTimestampSession }
			const input = task.prepareInput(contextNoTimestamp)

			expect(input.transcript).toContain('unknown')
		})
	})

	describe('Output Processing', () => {
		const validPhase: SessionPhase = {
			phaseType: 'initial_specification',
			startStep: 1,
			endStep: 3,
			stepCount: 3,
			summary: 'User specified requirements',
			durationMs: 120000,
			timestamp: '2025-01-01T00:00:00Z',
		}

		const validOutput: SessionPhaseAnalysis = {
			phases: [validPhase],
			totalPhases: 1,
			totalSteps: 9,
			sessionDurationMs: 1800000,
			pattern: 'initial_specification',
		}

		it('should validate and return valid output', () => {
			const result = task.processOutput(validOutput, MOCK_PHASE_CONTEXT)

			expect(result).toBeDefined()
			expect(result.phases).toHaveLength(1)
			expect(result.totalPhases).toBe(1)
		})

		it('should reject non-object output', () => {
			expect(() => task.processOutput('string output', MOCK_CONTEXT)).toThrow(
				'Phase analysis output must be an object'
			)
		})

		it('should reject null output', () => {
			expect(() => task.processOutput(null, MOCK_CONTEXT)).toThrow(
				'Phase analysis output must be an object'
			)
		})

		it('should reject missing phases array', () => {
			const invalidOutput = {
				totalPhases: 1,
				totalSteps: 5,
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Phase analysis output must contain a phases array'
			)
		})

		it('should reject non-array phases', () => {
			const invalidOutput = {
				phases: 'not an array',
				totalPhases: 1,
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Phase analysis output must contain a phases array'
			)
		})

		it('should reject phase without phaseType', () => {
			const invalidPhase = {
				startStep: 1,
				endStep: 2,
				summary: 'Test',
				durationMs: 1000,
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 2,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Each phase must have a phaseType string'
			)
		})

		it('should reject phase with non-string phaseType', () => {
			const invalidPhase = {
				phaseType: 123,
				startStep: 1,
				endStep: 2,
				summary: 'Test',
				durationMs: 1000,
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 2,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Each phase must have a phaseType string'
			)
		})

		it('should reject phase without step numbers', () => {
			const invalidPhase = {
				phaseType: 'execution',
				summary: 'Test',
				durationMs: 1000,
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 2,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Each phase must have startStep and endStep numbers'
			)
		})

		it('should reject phase with startStep > endStep', () => {
			const invalidPhase = {
				phaseType: 'execution',
				startStep: 5,
				endStep: 2,
				summary: 'Test',
				durationMs: 1000,
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 5,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Phase startStep must be <= endStep'
			)
		})

		it('should reject phase without summary', () => {
			const invalidPhase = {
				phaseType: 'execution',
				startStep: 1,
				endStep: 2,
				durationMs: 1000,
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 2,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Each phase must have a summary string'
			)
		})

		it('should reject phase without durationMs', () => {
			const invalidPhase = {
				phaseType: 'execution',
				startStep: 1,
				endStep: 2,
				summary: 'Test',
			}

			const invalidOutput = {
				phases: [invalidPhase],
				totalPhases: 1,
				totalSteps: 2,
				sessionDurationMs: 1000,
				pattern: 'test',
			}

			expect(() => task.processOutput(invalidOutput, MOCK_CONTEXT)).toThrow(
				'Each phase must have a durationMs number'
			)
		})

		it('should calculate stepCount if missing', () => {
			const phaseNoStepCount = {
				phaseType: 'execution',
				startStep: 1,
				endStep: 5,
				summary: 'Test',
				durationMs: 1000,
			}

			const output = {
				phases: [phaseNoStepCount],
				totalPhases: 1,
				totalSteps: 5,
				sessionDurationMs: 1000,
				pattern: 'execution',
			}

			const result = task.processOutput(output, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].stepCount).toBe(5) // endStep - startStep + 1 = 5 - 1 + 1
		})

		it('should preserve provided stepCount', () => {
			const result = task.processOutput(validOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].stepCount).toBe(3)
		})

		it('should provide default totalPhases if missing', () => {
			const outputNoTotal = {
				phases: [validPhase, validPhase],
				totalSteps: 9,
				sessionDurationMs: 1800000,
				pattern: 'test',
			}

			const result = task.processOutput(outputNoTotal, MOCK_PHASE_CONTEXT)

			expect(result.totalPhases).toBe(2) // Defaults to phases.length
		})

		it('should provide default totalSteps from context if missing', () => {
			const outputNoSteps = {
				phases: [validPhase],
				totalPhases: 1,
				sessionDurationMs: 1800000,
				pattern: 'test',
			}

			const result = task.processOutput(outputNoSteps, MOCK_PHASE_CONTEXT)

			expect(result.totalSteps).toBe(9) // From MOCK_PHASE_CONTEXT
		})

		it('should provide default sessionDurationMs from context if missing', () => {
			const outputNoDuration = {
				phases: [validPhase],
				totalPhases: 1,
				totalSteps: 9,
				pattern: 'test',
			}

			const result = task.processOutput(outputNoDuration, MOCK_PHASE_CONTEXT)

			expect(result.sessionDurationMs).toBe(1800000) // From MOCK_PHASE_CONTEXT
		})

		it('should provide default pattern if missing', () => {
			const outputNoPattern = {
				phases: [validPhase],
				totalPhases: 1,
				totalSteps: 9,
				sessionDurationMs: 1800000,
			}

			const result = task.processOutput(outputNoPattern, MOCK_PHASE_CONTEXT)

			expect(result.pattern).toBe('unknown')
		})

		it('should preserve optional timestamp field', () => {
			const result = task.processOutput(validOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].timestamp).toBe('2025-01-01T00:00:00Z')
		})

		it('should handle multiple phases', () => {
			const multiPhaseOutput: SessionPhaseAnalysis = {
				phases: [
					{ ...validPhase, phaseType: 'initial_specification', endStep: 2 },
					{ ...validPhase, phaseType: 'analysis_planning', startStep: 3, endStep: 5 },
					{ ...validPhase, phaseType: 'execution', startStep: 6, endStep: 9 },
				],
				totalPhases: 3,
				totalSteps: 9,
				sessionDurationMs: 1800000,
				pattern: 'initial_specification -> analysis_planning -> execution',
			}

			const result = task.processOutput(multiPhaseOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases).toHaveLength(3)
			expect(result.totalPhases).toBe(3)
			expect(result.pattern).toContain('->')
		})
	})

	describe('Execution Validation', () => {
		it('should allow execution with valid context', () => {
			expect(task.canExecute(MOCK_PHASE_CONTEXT)).toBe(true)
		})

		it('should reject execution without session', () => {
			const contextNoSession = { ...MOCK_CONTEXT, session: undefined }

			expect(task.canExecute(contextNoSession)).toBe(false)
		})

		it('should reject execution with empty session', () => {
			const contextEmptySession = { ...MOCK_CONTEXT, session: EMPTY_SESSION }

			expect(task.canExecute(contextEmptySession)).toBe(false)
		})

		it('should reject execution with too few messages', () => {
			const twoMessageSession = {
				...MOCK_SESSION,
				messages: MOCK_SESSION.messages.slice(0, 2),
			}

			const contextTwoMessages = { ...MOCK_CONTEXT, session: twoMessageSession }

			expect(task.canExecute(contextTwoMessages)).toBe(false)
		})

		it('should require at least 3 messages', () => {
			const threeMessageSession = {
				...MOCK_SESSION,
				messages: MOCK_SESSION.messages.slice(0, 3),
			}

			const contextThreeMessages = { ...MOCK_CONTEXT, session: threeMessageSession }

			expect(task.canExecute(contextThreeMessages)).toBe(true)
		})

		it('should reject execution without sessionId', () => {
			const contextNoId = { ...MOCK_PHASE_CONTEXT, sessionId: '' }

			expect(task.canExecute(contextNoId)).toBe(false)
		})
	})

	describe('Integration', () => {
		it('should work with complete session data', () => {
			const config = task.getConfig()
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(config).toBeDefined()
			expect(input).toBeDefined()
			expect(task.canExecute(MOCK_PHASE_CONTEXT)).toBe(true)
		})

		it('should produce valid input for AI model', () => {
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)

			expect(input.userName).toBeTruthy()
			expect(input.provider).toBeTruthy()
			expect(input.messageCount).toBeGreaterThan(0)
			expect(input.transcript).toBeTruthy()
			expect(input.phasePattern).toBeTruthy()
		})

		it('should handle full phase analysis flow', () => {
			// Prepare input
			const input = task.prepareInput(MOCK_PHASE_CONTEXT)
			expect(input).toBeDefined()

			// Mock AI output
			const aiOutput: SessionPhaseAnalysis = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'User requested REST API for blog posts',
						durationMs: 60000,
						timestamp: '2025-01-01T00:00:00Z',
					},
					{
						phaseType: 'analysis_planning',
						startStep: 2,
						endStep: 3,
						stepCount: 2,
						summary: 'Assistant analyzed and proposed approach',
						durationMs: 120000,
						timestamp: '2025-01-01T00:01:00Z',
					},
					{
						phaseType: 'execution',
						startStep: 5,
						endStep: 6,
						stepCount: 2,
						summary: 'Created models and routes',
						durationMs: 600000,
						timestamp: '2025-01-01T00:05:00Z',
					},
				],
				totalPhases: 3,
				totalSteps: 9,
				sessionDurationMs: 1800000,
				pattern: 'initial_specification -> analysis_planning -> execution',
			}

			// Process output
			const result = task.processOutput(aiOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases).toHaveLength(3)
			expect(result.totalPhases).toBe(3)
			expect(result.pattern).toContain('->')
		})
	})
})
