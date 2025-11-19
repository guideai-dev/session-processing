import type { ContentBlock, ToolUseContent } from '@guidemode/types'
import { isStructuredMessageContent } from '@guidemode/types'
import { getUserDisplayName } from '../../../../utils/user.js'
import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'

export interface QualityAssessmentInput {
  userName: string
  provider: string
  durationMinutes: number
  messageCount: number
  interruptionCount: number
  toolCount: number
  errorCount: number
}

export interface QualityAssessmentOutput {
  score: number
  reasoning: string
  strengths: string[]
  improvements: string[]
}

/**
 * Quality Assessment Task
 * Evaluates the quality and completeness of an agent session
 */
export class QualityAssessmentTask extends BaseModelTask<
  QualityAssessmentInput,
  QualityAssessmentOutput
> {
  readonly taskType = 'quality-assessment'
  readonly name = 'Quality Assessment'
  readonly description = 'Evaluate session quality and provide a score'

  getConfig(): ModelTaskConfig {
    return {
      taskType: this.taskType,
      prompt: `You are evaluating the quality of an AI coding agent session with {{userName}}. Quality is determined by how well {{userName}} set up the AI for success through effective collaboration practices. Provide a score from 0-100:

Session Details:
- Provider: {{provider}}
- Duration: {{durationMinutes}} minutes
- Message Count: {{messageCount}}
- User Interruptions: {{interruptionCount}}
- Tools Used: {{toolCount}}
- Errors: {{errorCount}}

Consider these factors (what {{userName}} can control):
1. Context Quality: Did {{userName}} provide comprehensive upfront context (file paths, technical details, relevant code)?
2. Prompt Clarity: Were instructions specific, actionable, and technical (not vague)?
3. Steering Effectiveness: Did {{userName}}'s interruptions/corrections keep the AI on track effectively?
4. Process Discipline: Did {{userName}} use available tools well (plan mode, todo tracking, iterative refinement)?
5. Efficiency Indicators: Low error count and read/write ratio suggest {{userName}} provided excellent context and documentation.

Note: Errors are normal AI exploration - fewer errors indicate better upfront context was provided. Some interruptions show effective steering. Focus on what {{userName}} did to enable AI success.

Respond with a JSON object containing:
{
  "score": <number 0-100>,
  "reasoning": "<brief explanation focusing on context quality and collaboration practices>",
  "strengths": ["<what {{userName}} did well to enable AI success>", "<another strength>"],
  "improvements": ["<how {{userName}} could improve context/prompts>", "<another improvement>"]
}`,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            score: { type: 'number', minimum: 0, maximum: 100 },
            reasoning: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
          },
          required: ['score', 'reasoning'],
        },
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelQualityScore', 'aiModelMetadata'],
        createMetrics: true,
        metricType: 'ai_model',
      },
    }
  }

  prepareInput(context: ModelTaskContext): QualityAssessmentInput {
    const session = context.session
    if (!session) {
      throw new Error('Session data is required for quality assessment')
    }

    // Get user display name
    const userName = context.user ? getUserDisplayName(context.user) : 'the user'

    // Count interruptions (consecutive user messages)
    let interruptionCount = 0
    for (let i = 1; i < session.messages.length; i++) {
      if (session.messages[i].type === 'user' && session.messages[i - 1].type === 'user') {
        interruptionCount++
      }
    }

    // Count unique tools from assistant messages
    const toolNames: string[] = []
    const assistantMessages = session.messages.filter(msg => msg.type === 'assistant')

    for (const msg of assistantMessages) {
      if (isStructuredMessageContent(msg.content)) {
        // Canonical format - single toolUse
        if (msg.content.toolUse?.name) {
          toolNames.push(msg.content.toolUse.name)
        }

        // Handle old format with toolUses array (during migration)
        const contentWithToolUses = msg.content as typeof msg.content & {
          toolUses?: ToolUseContent[]
        }
        if (contentWithToolUses.toolUses && Array.isArray(contentWithToolUses.toolUses)) {
          for (const tool of contentWithToolUses.toolUses) {
            if (tool.name) {
              toolNames.push(tool.name)
            }
          }
        }
      } else if (Array.isArray(msg.content)) {
        // Fallback: Check direct array format (for other providers)
        for (const item of msg.content) {
          if (item.type === 'tool_use' && 'name' in item && item.name) {
            toolNames.push(item.name as string)
          }
        }
      }
    }
    const toolCount = new Set(toolNames).size

    // Estimate errors from content
    const errorCount = session.messages.filter(msg => {
      let contentStr = ''
      if (typeof msg.content === 'string') {
        contentStr = msg.content.toLowerCase()
      } else if (isStructuredMessageContent(msg.content)) {
        // Parser wraps content in { text, toolUses, toolResults, structured }
        contentStr = (msg.content.text || '').toLowerCase()
      } else {
        contentStr = JSON.stringify(msg.content).toLowerCase()
      }
      return (
        contentStr.includes('error') ||
        contentStr.includes('failed') ||
        contentStr.includes('exception')
      )
    }).length

    const durationMinutes = session.duration ? Math.round(session.duration / 60000) : 0

    return {
      userName,
      provider: context.provider,
      durationMinutes,
      messageCount: session.messages.length,
      interruptionCount,
      toolCount,
      errorCount,
    }
  }

  canExecute(context: ModelTaskContext): boolean {
    return super.canExecute(context) && !!context.session && context.session.messages.length > 0
  }

  processOutput(output: unknown, _context: ModelTaskContext): QualityAssessmentOutput {
    // Validate the output structure
    if (typeof output !== 'object' || output === null) {
      throw new Error('Quality assessment output must be an object')
    }

    const result = output as QualityAssessmentOutput

    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      throw new Error('Quality score must be a number between 0 and 100')
    }

    // Ensure arrays exist
    return {
      score: result.score,
      reasoning: result.reasoning || '',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
    }
  }
}
