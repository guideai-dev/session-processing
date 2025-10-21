import { describe, it, expect } from 'vitest'
import { SessionPhaseAnalysisTask } from '../../src/ai-models/providers/claude/tasks/session-phase-analysis.js'
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

		it('should handle very short sessions (1-2 messages)', () => {
			const task = new SessionPhaseAnalysisTask()
			const shortSession = {
				sessionId: 'short-session',
				provider: 'claude-code',
				startTime: new Date('2025-01-01T00:00:00Z'),
				endTime: new Date('2025-01-01T00:01:00Z'),
				duration: 60000,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: 'Quick question',
						timestamp: new Date('2025-01-01T00:00:00Z'),
					},
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: { text: 'Quick answer', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date('2025-01-01T00:01:00Z'),
					},
				],
			}

			const shortContext = {
				...MOCK_PHASE_CONTEXT,
				session: shortSession,
			}

			const input = task.prepareInput(shortContext)
			expect(input.messageCount).toBe(2)
			expect(input.durationMinutes).toBe(1)
			expect(input.transcript).toBeTruthy()
		})

		it('should handle very long sessions (>100 messages)', () => {
			const task = new SessionPhaseAnalysisTask()

			// Generate 150 messages
			const messages = []
			const baseTime = new Date('2025-01-01T00:00:00Z').getTime()
			for (let i = 0; i < 150; i++) {
				messages.push({
					id: `msg-${i}`,
					type: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
					content:
						i % 2 === 0
							? `User message ${i}`
							: { text: `Assistant message ${i}`, toolUses: [], toolResults: [], structured: [] },
					timestamp: new Date(baseTime + i * 60000), // Each message 1 minute apart
				})
			}

			const longSession = {
				sessionId: 'long-session',
				provider: 'claude-code',
				startTime: new Date('2025-01-01T00:00:00Z'),
				endTime: new Date('2025-01-01T02:30:00Z'),
				duration: 9000000,
				messages,
			}

			const longContext = {
				...MOCK_PHASE_CONTEXT,
				session: longSession,
			}

			const input = task.prepareInput(longContext)
			expect(input.messageCount).toBe(150)
			expect(input.transcript).toBeTruthy()

			// Verify all messages are included
			const stepCount = (input.transcript.match(/Step \d+/g) || []).length
			expect(stepCount).toBe(150)
		})

		it('should handle sessions without clear phases', () => {
			const task = new SessionPhaseAnalysisTask()

			// Session with only back-and-forth conversation
			const noPhaseSession = {
				sessionId: 'no-phase-session',
				provider: 'claude-code',
				startTime: new Date('2025-01-01T00:00:00Z'),
				endTime: new Date('2025-01-01T00:10:00Z'),
				duration: 600000,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: 'Hi',
						timestamp: new Date('2025-01-01T00:00:00Z'),
					},
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: { text: 'Hello', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date('2025-01-01T00:01:00Z'),
					},
					{
						id: 'msg-3',
						type: 'user' as const,
						content: 'How are you?',
						timestamp: new Date('2025-01-01T00:02:00Z'),
					},
					{
						id: 'msg-4',
						type: 'assistant' as const,
						content: { text: 'I am fine', toolUses: [], toolResults: [], structured: [] },
						timestamp: new Date('2025-01-01T00:03:00Z'),
					},
				],
			}

			const noPhaseContext = {
				...MOCK_PHASE_CONTEXT,
				session: noPhaseSession,
			}

			const input = task.prepareInput(noPhaseContext)
			expect(input.messageCount).toBe(4)
			expect(input.transcript).toBeTruthy()
		})

		it('should calculate phase duration correctly', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 2,
						stepCount: 2,
						summary: 'User specified requirements',
						durationMs: 60000, // 1 minute
						timestamp: '2025-01-01T00:00:00Z',
					},
					{
						phaseType: 'execution',
						startStep: 3,
						endStep: 5,
						stepCount: 3,
						summary: 'AI executed the plan',
						durationMs: 180000, // 3 minutes
						timestamp: '2025-01-01T00:01:00Z',
					},
				],
				totalPhases: 2,
				totalSteps: 5,
				sessionDurationMs: 240000,
				pattern: 'initial_specification -> execution',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].durationMs).toBe(60000)
			expect(result.phases[1].durationMs).toBe(180000)
			expect(result.sessionDurationMs).toBe(240000)
		})

		it('should generate pattern string correctly', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'Spec',
						durationMs: 0,
					},
					{
						phaseType: 'analysis_planning',
						startStep: 2,
						endStep: 2,
						stepCount: 1,
						summary: 'Plan',
						durationMs: 0,
					},
					{
						phaseType: 'execution',
						startStep: 3,
						endStep: 4,
						stepCount: 2,
						summary: 'Execute',
						durationMs: 0,
					},
					{
						phaseType: 'completion',
						startStep: 5,
						endStep: 5,
						stepCount: 1,
						summary: 'Done',
						durationMs: 0,
					},
				],
				totalPhases: 4,
				totalSteps: 5,
				sessionDurationMs: 300000,
				pattern: 'initial_specification -> analysis_planning -> execution -> completion',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.pattern).toBe(
				'initial_specification -> analysis_planning -> execution -> completion'
			)
		})

		it('should handle overlapping phase detection gracefully', () => {
			const task = new SessionPhaseAnalysisTask()

			// This simulates potential overlap - the AI should handle this
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 3,
						stepCount: 3,
						summary: 'Initial spec',
						durationMs: 60000,
					},
					{
						phaseType: 'execution',
						startStep: 4,
						endStep: 6,
						stepCount: 3,
						summary: 'Execution',
						durationMs: 120000,
					},
				],
				totalPhases: 2,
				totalSteps: 6,
				sessionDurationMs: 180000,
				pattern: 'initial_specification -> execution',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases).toHaveLength(2)
			expect(result.phases[0].endStep).toBeLessThan(result.phases[1].startStep)
		})

		it('should handle single message sessions', () => {
			const task = new SessionPhaseAnalysisTask()
			const singleMessageSession = {
				sessionId: 'single-message',
				provider: 'claude-code',
				startTime: new Date('2025-01-01T00:00:00Z'),
				endTime: new Date('2025-01-01T00:00:01Z'),
				duration: 1000,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: 'Single message',
						timestamp: new Date('2025-01-01T00:00:00Z'),
					},
				],
			}

			const singleContext = {
				...MOCK_PHASE_CONTEXT,
				session: singleMessageSession,
			}

			const input = task.prepareInput(singleContext)
			expect(input.messageCount).toBe(1)
			expect(input.durationMinutes).toBe(0)
		})

		it('should handle sessions with only tool usage (no text)', () => {
			const task = new SessionPhaseAnalysisTask()
			const toolOnlySession = {
				sessionId: 'tool-only',
				provider: 'claude-code',
				startTime: new Date('2025-01-01T00:00:00Z'),
				endTime: new Date('2025-01-01T00:05:00Z'),
				duration: 300000,
				messages: [
					{
						id: 'msg-1',
						type: 'user' as const,
						content: 'Create a file',
						timestamp: new Date('2025-01-01T00:00:00Z'),
					},
					{
						id: 'msg-2',
						type: 'assistant' as const,
						content: {
							text: '',
							toolUses: [
								{
									type: 'tool_use',
									id: 'tool-1',
									name: 'write',
									input: { filePath: '/test.txt', content: 'content' },
								},
							],
							toolResults: [],
							structured: [],
						},
						timestamp: new Date('2025-01-01T00:01:00Z'),
					},
				],
			}

			const toolContext = {
				...MOCK_PHASE_CONTEXT,
				session: toolOnlySession,
			}

			const input = task.prepareInput(toolContext)
			expect(input.messageCount).toBe(2)
			expect(input.transcript).toBeTruthy()
		})

		it('should handle phase analysis with correction and retry phases', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'Initial spec',
						durationMs: 10000,
					},
					{
						phaseType: 'execution',
						startStep: 2,
						endStep: 3,
						stepCount: 2,
						summary: 'First execution',
						durationMs: 60000,
					},
					{
						phaseType: 'correction',
						startStep: 4,
						endStep: 5,
						stepCount: 2,
						summary: 'Fixing errors',
						durationMs: 30000,
					},
					{
						phaseType: 'final_completion',
						startStep: 6,
						endStep: 6,
						stepCount: 1,
						summary: 'All done',
						durationMs: 5000,
					},
				],
				totalPhases: 4,
				totalSteps: 6,
				sessionDurationMs: 105000,
				pattern: 'initial_specification -> execution -> correction -> final_completion',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases).toHaveLength(4)
			expect(result.phases[2].phaseType).toBe('correction')
			expect(result.phases[3].phaseType).toBe('final_completion')
		})

		it('should validate phase step numbering is sequential', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 2,
						stepCount: 2,
						summary: 'Phase 1',
						durationMs: 10000,
					},
					{
						phaseType: 'execution',
						startStep: 3,
						endStep: 5,
						stepCount: 3,
						summary: 'Phase 2',
						durationMs: 20000,
					},
				],
				totalPhases: 2,
				totalSteps: 5,
				sessionDurationMs: 30000,
				pattern: 'initial_specification -> execution',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].startStep).toBe(1)
			expect(result.phases[0].endStep).toBe(2)
			expect(result.phases[1].startStep).toBe(3)
			expect(result.phases[1].endStep).toBe(5)
		})

		it('should handle missing timestamp in phases', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'No timestamp',
						durationMs: 10000,
						// timestamp is optional
					},
				],
				totalPhases: 1,
				totalSteps: 1,
				sessionDurationMs: 10000,
				pattern: 'initial_specification',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0]).toBeDefined()
			expect(result.phases[0].timestamp).toBeUndefined()
		})

		it('should handle phase with timestamp', () => {
			const task = new SessionPhaseAnalysisTask()
			const mockOutput = {
				phases: [
					{
						phaseType: 'initial_specification',
						startStep: 1,
						endStep: 1,
						stepCount: 1,
						summary: 'With timestamp',
						durationMs: 10000,
						timestamp: '2025-01-01T00:00:00Z',
					},
				],
				totalPhases: 1,
				totalSteps: 1,
				sessionDurationMs: 10000,
				pattern: 'initial_specification',
			}

			const result = task.processOutput(mockOutput, MOCK_PHASE_CONTEXT)

			expect(result.phases[0].timestamp).toBe('2025-01-01T00:00:00Z')
		})
	})
})
