import type { ContentBlock, TextContent } from '@guideai-dev/types'
import { isStructuredMessageContent } from '@guideai-dev/types'
import { getUserDisplayName } from '../../../../utils/user.js'
import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'

export interface IntentExtractionInput {
  userName: string
  userMessages: string
}

export interface IntentExtractionOutput {
  primaryGoal: string
  secondaryGoals?: string[]
  technologies?: string[]
  challenges?: string[]
  taskType: 'feature_development' | 'bug_fix' | 'refactoring' | 'learning' | 'debugging' | 'other'
}

/**
 * Intent Extraction Task
 * Extracts user intents and goals from the session
 */
export class IntentExtractionTask extends BaseModelTask<
  IntentExtractionInput,
  IntentExtractionOutput
> {
  readonly taskType = 'intent-extraction'
  readonly name = 'Intent Extraction'
  readonly description = 'Extract user intents and goals from session messages'

  getConfig(): ModelTaskConfig {
    return {
      taskType: this.taskType,
      prompt: `You are analyzing an AI coding agent session to extract {{userName}}'s intents and goals.

{{userName}}'s Messages:
{{userMessages}}

Analyze these messages and extract:
1. Primary Goal: What is the main thing {{userName}} wanted to accomplish?
2. Secondary Goals: What other objectives did {{userName}} have?
3. Technical Context: What technologies/frameworks were mentioned?
4. Challenges: What difficulties or blockers did {{userName}} encounter?

Respond with a JSON object:
{
  "primaryGoal": "<main objective>",
  "secondaryGoals": ["<goal 1>", "<goal 2>"],
  "technologies": ["<tech 1>", "<tech 2>"],
  "challenges": ["<challenge 1>", "<challenge 2>"],
  "taskType": "<type of work: feature_development | bug_fix | refactoring | learning | debugging | other>"
}`,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            primaryGoal: { type: 'string' },
            secondaryGoals: { type: 'array', items: { type: 'string' } },
            technologies: { type: 'array', items: { type: 'string' } },
            challenges: { type: 'array', items: { type: 'string' } },
            taskType: {
              type: 'string',
              enum: [
                'feature_development',
                'bug_fix',
                'refactoring',
                'learning',
                'debugging',
                'other',
              ],
            },
          },
          required: ['primaryGoal', 'taskType'],
        },
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelMetadata'],
        createMetrics: true,
        metricType: 'ai_model',
      },
    }
  }

  prepareInput(context: ModelTaskContext): IntentExtractionInput {
    const session = context.session
    if (!session) {
      throw new Error('Session data is required for intent extraction')
    }

    // Get user display name
    const userName = context.user ? getUserDisplayName(context.user) : 'the user'

    // Extract all user messages - handle both string and structured content
    const userMessages = session.messages
      .filter(msg => msg.type === 'user')
      .map((msg, index) => {
        let content = ''
        if (typeof msg.content === 'string') {
          content = msg.content
        } else if (isStructuredMessageContent(msg.content)) {
          // Parser wraps structured content in { text, toolUses, toolResults, structured }
          content = msg.content.text || ''
        } else if (Array.isArray(msg.content)) {
          // Fallback: Extract text from content array (for other providers)
          content = msg.content
            .filter(
              (item: ContentBlock): item is TextContent => item.type === 'text' && 'text' in item
            )
            .map((item: TextContent) => item.text)
            .join(' ')
        }
        return `[${index + 1}] ${content}`
      })
      .filter(msg => msg.length > 4) // Filter out empty messages (just "[X] ")
      .join('\n\n')

    return {
      userName,
      userMessages: userMessages || 'No user messages found',
    }
  }

  canExecute(context: ModelTaskContext): boolean {
    if (!super.canExecute(context) || !context.session) {
      return false
    }

    // Must have at least one user message
    const userMessageCount = context.session.messages.filter(msg => msg.type === 'user').length
    return userMessageCount > 0
  }

  processOutput(output: unknown, _context: ModelTaskContext): IntentExtractionOutput {
    // Validate the output structure
    if (typeof output !== 'object' || output === null) {
      throw new Error('Intent extraction output must be an object')
    }

    const result = output as IntentExtractionOutput

    if (!result.primaryGoal || typeof result.primaryGoal !== 'string') {
      throw new Error('Primary goal is required and must be a string')
    }

    const validTaskTypes = [
      'feature_development',
      'bug_fix',
      'refactoring',
      'learning',
      'debugging',
      'other',
    ]
    if (!result.taskType || !validTaskTypes.includes(result.taskType)) {
      result.taskType = 'other'
    }

    // Ensure arrays exist and are arrays
    return {
      primaryGoal: result.primaryGoal,
      secondaryGoals: Array.isArray(result.secondaryGoals) ? result.secondaryGoals : [],
      technologies: Array.isArray(result.technologies) ? result.technologies : [],
      challenges: Array.isArray(result.challenges) ? result.challenges : [],
      taskType: result.taskType,
    }
  }
}
