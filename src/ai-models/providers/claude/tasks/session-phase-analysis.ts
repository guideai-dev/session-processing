import type { ContentBlock, TextContent, ToolUseContent } from '@guideai-dev/types'
import { isStructuredMessageContent } from '@guideai-dev/types'
import { getUserDisplayName } from '../../../../utils/user.js'
import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'

/**
 * Session Phase Types
 * Represents the different phases a coding session can go through
 */
export type SessionPhaseType =
  | 'initial_specification'
  | 'analysis_planning'
  | 'plan_modification'
  | 'plan_agreement'
  | 'execution'
  | 'interruption'
  | 'task_assignment'
  | 'completion'
  | 'correction'
  | 'final_completion'
  | 'other'

/**
 * Phase in the session timeline
 */
export interface SessionPhase {
  phaseType: SessionPhaseType
  startStep: number
  endStep: number
  stepCount: number
  summary: string
  durationMs: number
  timestamp?: string
}

/**
 * Complete session phase analysis result
 */
export interface SessionPhaseAnalysis {
  phases: SessionPhase[]
  totalPhases: number
  totalSteps: number
  sessionDurationMs: number
  pattern: string
}

/**
 * Input prepared for the phase analysis AI model
 */
export interface PhaseAnalysisInput {
  userName: string
  provider: string
  durationMinutes: number | string
  messageCount: number
  sessionStart: string
  sessionEnd: string
  sessionDurationMs: number
  phasePattern: string
  transcript: string
}

/**
 * Session Phase Analysis Task
 * Analyzes the entire chat transcript and breaks it into meaningful broader steps/phases
 * based on configurable patterns
 */
export class SessionPhaseAnalysisTask extends BaseModelTask<
  PhaseAnalysisInput,
  SessionPhaseAnalysis
> {
  readonly taskType = 'session-phase-analysis'
  readonly name = 'Session Phase Analysis'
  readonly description =
    'Analyze chat transcript and identify meaningful phases in the session flow'

  /**
   * Configuration for phase pattern
   * Can be modified to support different analysis patterns over time
   */
  private readonly defaultPattern = `
[Initial Specification] - The user describes what they want to accomplish
[Analysis & Planning] - The AI analyzes the requirements and creates a plan
[Plan Modification by User] - The user requests changes or clarifications to the plan
[Plan Agreement] - Both parties agree on the approach
[Execution] - The AI executes the plan, making changes
[Interruption] - The user interrupts or redirects the AI
[Task Assignment (parallel)] - Multiple tasks are being worked on simultaneously (optional phase)
[Completion] - The initial task is completed
[Correction] - Issues are found and need to be fixed (e.g., not working, not right)
[Final Completion] - All issues resolved and task is done
`.trim()

  getConfig(): ModelTaskConfig {
    return {
      taskType: this.taskType,
      prompt: `You are analyzing an AI coding agent session with {{userName}}. Your task is to break down the entire session into meaningful phases based on the flow of the conversation.

Session Details:
- Provider: {{provider}}
- Duration: {{durationMinutes}} minutes
- Message Count: {{messageCount}}
- Session Start: {{sessionStart}}
- Session End: {{sessionEnd}}

Expected Phase Pattern (use this as a guide, but adapt to what actually happened):
{{phasePattern}}

Full Session Transcript:
{{transcript}}

CRITICAL INSTRUCTIONS:
1. Analyze the ENTIRE transcript above
2. Identify distinct phases that actually occurred (not all phases may be present)
3. For each phase, determine:
   - The phase type (from the pattern or "other" if it doesn't fit)
   - Which message/step numbers (1-based index) belong to this phase
   - A brief summary (1-2 sentences) of what happened in this phase
   - Approximate duration of this phase in milliseconds
4. Phases should be sequential and non-overlapping
5. A phase can span multiple messages/steps
6. Return your analysis as a structured JSON object

Respond with a JSON object in this EXACT format:
{
  "phases": [
    {
      "phaseType": "initial_specification",
      "startStep": 1,
      "endStep": 3,
      "stepCount": 3,
      "summary": "User described wanting to add a new feature...",
      "durationMs": 120000,
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ],
  "totalPhases": 5,
  "totalSteps": {{messageCount}},
  "sessionDurationMs": {{sessionDurationMs}},
  "pattern": "initial_specification -> analysis_planning -> execution -> completion"
}

Phase types must be one of:
- initial_specification
- analysis_planning
- plan_modification
- plan_agreement
- execution
- interruption
- task_assignment
- completion
- correction
- final_completion
- other

Always refer to the person as {{userName}} in your summaries.`,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phaseType: { type: 'string' },
                  startStep: { type: 'number' },
                  endStep: { type: 'number' },
                  stepCount: { type: 'number' },
                  summary: { type: 'string' },
                  durationMs: { type: 'number' },
                  timestamp: { type: 'string' },
                },
                required: [
                  'phaseType',
                  'startStep',
                  'endStep',
                  'stepCount',
                  'summary',
                  'durationMs',
                ],
              },
            },
            totalPhases: { type: 'number' },
            totalSteps: { type: 'number' },
            sessionDurationMs: { type: 'number' },
            pattern: { type: 'string' },
          },
          required: ['phases', 'totalPhases', 'totalSteps', 'sessionDurationMs', 'pattern'],
        },
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelPhaseAnalysis'],
      },
    }
  }

  /**
   * Allow custom phase patterns to be configured
   */
  setPhasePattern(_pattern: string): void {
    // This can be used to override the default pattern
    // For now, we'll keep it simple and use the default
  }

  prepareInput(context: ModelTaskContext): PhaseAnalysisInput {
    const session = context.session
    if (!session) {
      throw new Error('Session data is required for phase analysis')
    }

    // Get user display name
    const userName = context.user ? getUserDisplayName(context.user) : 'the user'

    // Build the full transcript with message numbers
    const transcript = session.messages
      .map((msg, index) => {
        const stepNum = index + 1
        const role = msg.type === 'user' ? userName : 'Assistant'
        const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : 'unknown'

        // Extract content text
        let content = ''
        if (typeof msg.content === 'string') {
          content = msg.content
        } else if (isStructuredMessageContent(msg.content)) {
          content = msg.content.text || ''
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter(
              (item: ContentBlock): item is TextContent => item.type === 'text' && 'text' in item
            )
            .map((item: TextContent) => item.text)
            .join(' ')
        }

        // Truncate very long messages but keep important context
        const maxLength = 1000
        if (content.length > maxLength) {
          content = `${content.substring(0, maxLength)}... [truncated]`
        }

        // Add tool use information for assistant messages
        let toolInfo = ''
        if (msg.type === 'assistant' && isStructuredMessageContent(msg.content)) {
          const tools = msg.content.toolUses
            .map((tool: ToolUseContent) => tool.name)
            .filter(Boolean)
            .join(', ')
          if (tools) {
            toolInfo = `\n  [Tools used: ${tools}]`
          }
        }

        return `Step ${stepNum} [${timestamp}] - ${role}:\n  ${content}${toolInfo}`
      })
      .join('\n\n')

    const durationMinutes = session.duration ? Math.round(session.duration / 60000) : 'Unknown'

    const sessionStart = session.startTime ? new Date(session.startTime).toISOString() : 'Unknown'

    const sessionEnd = session.endTime ? new Date(session.endTime).toISOString() : 'Unknown'

    const sessionDurationMs = session.duration || 0

    return {
      userName,
      provider: context.provider,
      durationMinutes,
      messageCount: session.messages.length,
      sessionStart,
      sessionEnd,
      sessionDurationMs,
      phasePattern: this.defaultPattern,
      transcript,
    }
  }

  canExecute(context: ModelTaskContext): boolean {
    // Need at least a few messages to perform meaningful phase analysis
    return super.canExecute(context) && !!context.session && context.session.messages.length >= 3
  }

  processOutput(output: unknown, context: ModelTaskContext): SessionPhaseAnalysis {
    // Validate the output structure
    if (typeof output !== 'object' || output === null) {
      throw new Error('Phase analysis output must be an object')
    }

    const result = output as Record<string, unknown>

    if (!Array.isArray(result.phases)) {
      throw new Error('Phase analysis output must contain a phases array')
    }

    // Validate each phase
    for (const phase of result.phases) {
      if (!phase.phaseType || typeof phase.phaseType !== 'string') {
        throw new Error('Each phase must have a phaseType string')
      }
      if (typeof phase.startStep !== 'number' || typeof phase.endStep !== 'number') {
        throw new Error('Each phase must have startStep and endStep numbers')
      }
      if (phase.startStep > phase.endStep) {
        throw new Error('Phase startStep must be <= endStep')
      }
      if (typeof phase.summary !== 'string') {
        throw new Error('Each phase must have a summary string')
      }
      if (typeof phase.durationMs !== 'number') {
        throw new Error('Each phase must have a durationMs number')
      }
    }

    // Ensure proper structure
    return {
      phases: result.phases.map((phase: SessionPhase) => ({
        phaseType: phase.phaseType,
        startStep: phase.startStep,
        endStep: phase.endStep,
        stepCount: phase.stepCount || phase.endStep - phase.startStep + 1,
        summary: phase.summary,
        durationMs: phase.durationMs,
        timestamp: phase.timestamp,
      })),
      totalPhases: (result.totalPhases as number) || result.phases.length,
      totalSteps: (result.totalSteps as number) || context.session?.messages.length || 0,
      sessionDurationMs: (result.sessionDurationMs as number) || context.session?.duration || 0,
      pattern: (result.pattern as string) || 'unknown',
    }
  }
}
