import type { ContentBlock, TextContent, ThinkingContent, ToolUseContent } from '@guideai-dev/types'
import { isStructuredMessageContent, isThinkingContent } from '@guideai-dev/types'
import { getUserDisplayName } from '../../../../utils/user.js'
import { BaseModelTask } from '../../../base/model-task.js'
import type { ModelTaskConfig, ModelTaskContext } from '../../../base/types.js'

export interface SessionSummaryInput {
  userName: string
  provider: string
  durationMinutes: number | string
  messageCount: number
  toolsUsed: string
  userMessages: string
  assistantResponses: string
  assistantActions: string
}

/**
 * Session Summary Task
 * Generates a concise 2-3 sentence summary of an agent session
 */
export class SessionSummaryTask extends BaseModelTask<SessionSummaryInput, string> {
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

Assistant Responses:
{{assistantResponses}}

Assistant Tool Actions:
{{assistantActions}}

Provide a clear, professional summary in 2-3 sentences. Always refer to the person as {{userName}}, not "the user".`,
      responseFormat: {
        type: 'text',
      },
      recordingStrategy: {
        updateAgentSession: ['aiModelSummary'],
      },
    }
  }

  prepareInput(context: ModelTaskContext): SessionSummaryInput {
    const session = context.session
    if (!session) {
      throw new Error('Session data is required for summary task')
    }

    // Get user display name
    const userName = context.user ? getUserDisplayName(context.user) : 'the user'

    // Log message type breakdown
    const _typeBreakdown = session.messages.reduce(
      (acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Extract user messages - content can be string or structured object
    const userMessages = session.messages
      .filter(msg => msg.type === 'user')
      .map(msg => {
        if (typeof msg.content === 'string') {
          return msg.content
        }
        if (isStructuredMessageContent(msg.content)) {
          // Parser wraps structured content in { text, toolUses, toolResults, structured }
          return msg.content.text || ''
        }
        if (Array.isArray(msg.content)) {
          // Fallback: Extract text from content array (for other providers)
          return msg.content
            .filter(
              (item: ContentBlock): item is TextContent => item.type === 'text' && 'text' in item
            )
            .map((item: TextContent) => item.text)
            .join(' ')
        }
        return ''
      })
      .filter(Boolean)
      .slice(0, 10)
      .join('\n- ')

    // Extract assistant responses and tool uses
    const toolNames: string[] = []
    const assistantTextParts: string[] = []
    const assistantMessages = session.messages.filter(msg => msg.type === 'assistant')
    const toolUseMessages = session.messages.filter(msg => msg.type === 'tool_use')

    // Process assistant text responses
    for (const msg of assistantMessages) {
      if (isStructuredMessageContent(msg.content)) {
        // Extract text responses
        if (msg.content.text) {
          assistantTextParts.push(msg.content.text)
        }

        // Extract thinking content
        for (const block of msg.content.structured) {
          if (isThinkingContent(block) && block.thinking) {
            assistantTextParts.push(`[Thinking: ${block.thinking}]`)
          }
        }

        // Extract tool uses
        for (const toolUse of msg.content.toolUses) {
          if (toolUse.name) {
            toolNames.push(toolUse.name)
          }
        }
      } else if (Array.isArray(msg.content)) {
        // Fallback: Extract from content array (for other providers)
        for (const item of msg.content) {
          if (item.type === 'text' && 'text' in item && item.text) {
            assistantTextParts.push(item.text as string)
          }
          if (isThinkingContent(item) && item.thinking) {
            assistantTextParts.push(`[Thinking: ${item.thinking}]`)
          }
          if (item.type === 'tool_use' && 'name' in item && item.name) {
            toolNames.push(item.name as string)
          }
        }
      } else if (typeof msg.content === 'string') {
        assistantTextParts.push(msg.content)
      }
    }

    // Process tool_use messages
    for (const msg of toolUseMessages) {
      if (isStructuredMessageContent(msg.content)) {
        for (const toolUse of msg.content.toolUses) {
          if (toolUse.name) {
            toolNames.push(toolUse.name)
          }
        }
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'tool_use' && 'name' in item && item.name) {
            toolNames.push(item.name as string)
          }
        }
      }
    }

    const assistantResponses =
      assistantTextParts.slice(0, 10).join('\n- ') || 'No assistant responses found'
    const assistantActions = toolNames.slice(0, 20).join(', ')
    const toolsUsed = [...new Set(toolNames)].join(', ') || 'None'

    const durationMinutes = session.duration ? Math.round(session.duration / 60000) : 'Unknown'

    const input = {
      userName,
      provider: context.provider,
      durationMinutes,
      messageCount: session.messages.length,
      toolsUsed,
      userMessages: userMessages || 'No user messages found',
      assistantResponses,
      assistantActions: assistantActions || 'No tool uses found',
    }

    return input
  }

  canExecute(context: ModelTaskContext): boolean {
    return super.canExecute(context) && !!context.session && context.session.messages.length > 0
  }

  processOutput(output: unknown, _context: ModelTaskContext): string {
    // Ensure output is a string and trim it
    return String(output).trim()
  }
}
