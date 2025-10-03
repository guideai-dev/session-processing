import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'
import { getUserDisplayName } from '../../../../utils/user.js'

/**
 * Session Summary Task
 * Generates a concise 2-3 sentence summary of an agent session
 */
export class SessionSummaryTask extends BaseModelTask {
  readonly taskType = 'session-summary'
  readonly name = 'Session Summary'
  readonly description = 'Generate a concise summary of the agent session'

  getConfig(): ModelTaskConfig {
    return {
      taskType: this.taskType,
      prompt: `You are analyzing an AI coding agent session. Generate a concise 2-3 sentence summary describing what {{userName}} was trying to accomplish and what actions the agent took.

Session Details:
- Provider: {{provider}}
- Duration: {{durationMinutes}} minutes
- Message Count: {{messageCount}}
- Tools Used: {{toolsUsed}}

{{userName}}'s Messages:
{{userMessages}}

Assistant Actions:
{{assistantActions}}

Provide a clear, professional summary in 2-3 sentences. Always refer to the person as {{userName}}, not "the user".`,
      responseFormat: {
        type: 'text'
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelSummary']
      }
    }
  }

  prepareInput(context: ModelTaskContext): any {
    const session = context.session
    if (!session) {
      throw new Error('Session data is required for summary task')
    }

    // Get user display name
    const userName = context.user ? getUserDisplayName(context.user) : 'the user'

    // Extract user messages - content can be string or structured object
    const userMessages = session.messages
      .filter(msg => msg.type === 'user')
      .map(msg => {
        if (typeof msg.content === 'string') {
          return msg.content
        } else if (msg.content?.text) {
          // Parser wraps structured content in { text, toolUses, toolResults, structured }
          return msg.content.text
        } else if (Array.isArray(msg.content)) {
          // Fallback: Extract text from content array (for other providers)
          return msg.content
            .filter((item: any) => item.type === 'text' && item.text)
            .map((item: any) => item.text)
            .join(' ')
        }
        return ''
      })
      .filter(Boolean)
      .slice(0, 10)
      .join('\n- ')

    // Extract tool uses from assistant messages
    const toolNames: string[] = []
    session.messages
      .filter(msg => msg.type === 'assistant')
      .forEach(msg => {
        // Parser stores tool uses in msg.content.toolUses array
        if (msg.content?.toolUses && Array.isArray(msg.content.toolUses)) {
          msg.content.toolUses.forEach((toolUse: any) => {
            if (toolUse.name) {
              toolNames.push(toolUse.name)
            }
          })
        } else if (Array.isArray(msg.content)) {
          // Fallback: Check direct array format (for other providers)
          msg.content.forEach((item: any) => {
            if (item.type === 'tool_use' && item.name) {
              toolNames.push(item.name)
            }
          })
        }
      })

    const assistantActions = toolNames.slice(0, 20).join(', ')
    const toolsUsed = [...new Set(toolNames)].join(', ') || 'None'

    const durationMinutes = session.duration
      ? Math.round(session.duration / 60000)
      : 'Unknown'

    return {
      userName,
      provider: context.provider,
      durationMinutes,
      messageCount: session.messages.length,
      toolsUsed,
      userMessages: userMessages || 'No user messages found',
      assistantActions: assistantActions || 'No tool uses found'
    }
  }

  canExecute(context: ModelTaskContext): boolean {
    return super.canExecute(context) && !!context.session && context.session.messages.length > 0
  }

  processOutput(output: any, context: ModelTaskContext): string {
    // Ensure output is a string and trim it
    return String(output).trim()
  }
}
