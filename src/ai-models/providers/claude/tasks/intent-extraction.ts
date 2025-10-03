import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'
import { getUserDisplayName } from '../../../../utils/user.js'

/**
 * Intent Extraction Task
 * Extracts user intents and goals from the session
 */
export class IntentExtractionTask extends BaseModelTask {
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
              enum: ['feature_development', 'bug_fix', 'refactoring', 'learning', 'debugging', 'other']
            }
          },
          required: ['primaryGoal', 'taskType']
        }
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelMetadata'],
        createMetrics: true,
        metricType: 'ai_model'
      }
    }
  }

  prepareInput(context: ModelTaskContext): any {
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
        } else if (msg.content?.text) {
          // Parser wraps structured content in { text, toolUses, toolResults, structured }
          content = msg.content.text
        } else if (Array.isArray(msg.content)) {
          // Fallback: Extract text from content array (for other providers)
          content = msg.content
            .filter((item: any) => item.type === 'text' && item.text)
            .map((item: any) => item.text)
            .join(' ')
        }
        return `[${index + 1}] ${content}`
      })
      .filter(msg => msg.length > 4) // Filter out empty messages (just "[X] ")
      .join('\n\n')

    return {
      userName,
      userMessages: userMessages || 'No user messages found'
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

  processOutput(output: any, context: ModelTaskContext): any {
    // Validate the output structure
    if (typeof output !== 'object' || output === null) {
      throw new Error('Intent extraction output must be an object')
    }

    if (!output.primaryGoal || typeof output.primaryGoal !== 'string') {
      throw new Error('Primary goal is required and must be a string')
    }

    const validTaskTypes = ['feature_development', 'bug_fix', 'refactoring', 'learning', 'debugging', 'other']
    if (!output.taskType || !validTaskTypes.includes(output.taskType)) {
      output.taskType = 'other'
    }

    // Ensure arrays exist and are arrays
    return {
      primaryGoal: output.primaryGoal,
      secondaryGoals: Array.isArray(output.secondaryGoals) ? output.secondaryGoals : [],
      technologies: Array.isArray(output.technologies) ? output.technologies : [],
      challenges: Array.isArray(output.challenges) ? output.challenges : [],
      taskType: output.taskType
    }
  }
}
