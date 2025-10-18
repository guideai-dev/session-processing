import { ClaudeCodeParser } from '../claude-code/parser.js'
import type { ParsedSession } from '../../base/types.js'

/**
 * OpenCodeParser extends ClaudeCodeParser but sets provider to 'opencode'
 * OpenCode uses the same message format as Claude Code (Anthropic Messages API)
 * but has lowercase tool names that need to be normalized to title case
 */
export class OpenCodeParser extends ClaudeCodeParser {
  parseSession(jsonlContent: string): ParsedSession {
    const session = super.parseSession(jsonlContent)

    // Normalize tool names from lowercase to title case
    // OpenCode uses: read, write, edit, bash, glob, etc.
    // Metrics expect: Read, Write, Edit, Bash, Glob, etc.
    this.normalizeToolNames(session)

    // Override provider from 'claude-code' to 'opencode'
    return {
      ...session,
      provider: 'opencode',
    }
  }

  /**
   * Normalize tool names to title case for consistency with other processors
   */
  private normalizeToolNames(session: ParsedSession): void {
    for (const message of session.messages) {
      // Normalize tool uses
      if (message.content?.toolUses) {
        for (const toolUse of message.content.toolUses) {
          toolUse.name = this.toTitleCase(toolUse.name)
        }
      }

      // Update hasToolUses metadata if toolUses array was modified
      if (message.metadata && message.content?.toolUses) {
        message.metadata.hasToolUses = message.content.toolUses.length > 0
        message.metadata.toolCount = message.content.toolUses.length
      }
    }
  }

  /**
   * Convert tool name to title case
   */
  private toTitleCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Override calculateResponseTimes to handle OpenCode's message structure
   * where tool_use messages appear between user and assistant messages
   */
  calculateResponseTimes(
    session: ParsedSession
  ): Array<{ userMessage: any; assistantMessage: any; responseTime: number }> {
    const responseTimes: Array<{ userMessage: any; assistantMessage: any; responseTime: number }> =
      []

    for (let i = 0; i < session.messages.length; i++) {
      const current = session.messages[i]

      // Look for user messages
      if (current.type === 'user') {
        // Find the next assistant message, skipping over system messages (tool_use/tool_result)
        for (let j = i + 1; j < session.messages.length; j++) {
          const next = session.messages[j]

          if (next.type === 'assistant') {
            const responseTime = next.timestamp.getTime() - current.timestamp.getTime()
            responseTimes.push({
              userMessage: current,
              assistantMessage: next,
              responseTime,
            })
            break // Found the assistant response, move to next user message
          }

          // If we hit another user message before finding an assistant, break
          if (next.type === 'user') {
            break
          }
        }
      }
    }

    return responseTimes
  }
}
