/**
 * Claude Code Parser Helpers
 *
 * Utility functions for extracting information from parsed Claude Code sessions.
 * Used by metric processors.
 */

import type { ToolResultContent, ToolUseContent } from '@guideai-dev/types'
import { isStructuredMessageContent } from '@guideai-dev/types'
import type { ParsedMessage, ParsedSession } from '../../base/types.js'

/**
 * Extract all tool uses from the session
 */
export function extractToolUses(session: ParsedSession): ToolUseContent[] {
  const toolUses: ToolUseContent[] = []

  for (const message of session.messages) {
    if (isStructuredMessageContent(message.content)) {
      toolUses.push(...message.content.toolUses)
    }
  }

  return toolUses
}

/**
 * Extract all tool results from the session
 */
export function extractToolResults(session: ParsedSession): ToolResultContent[] {
  const toolResults: ToolResultContent[] = []

  for (const message of session.messages) {
    if (isStructuredMessageContent(message.content)) {
      toolResults.push(...message.content.toolResults)
    }
  }

  return toolResults
}

/**
 * Find messages that indicate real interruptions
 */
export function findInterruptions(session: ParsedSession): ParsedMessage[] {
  const interruptions: ParsedMessage[] = []

  for (const message of session.messages) {
    if (message.type === 'user_input' && isInterruptionMessage(message)) {
      interruptions.push(message)
    }
  }

  return interruptions
}

/**
 * Find messages where the agent stopped/asked for input/confirmation
 */
export function findAgentStops(session: ParsedSession): ParsedMessage[] {
  const stops: ParsedMessage[] = []

  for (let i = 0; i < session.messages.length - 1; i++) {
    const current = session.messages[i]
    const next = session.messages[i + 1]

    if (
      current.type === 'assistant_response' &&
      next.type === 'user_input' &&
      !isInterruptionMessage(next)
    ) {
      stops.push(current)
    }
  }

  return stops
}

/**
 * Calculate response times between user inputs and assistant responses
 */
export function calculateResponseTimes(
  session: ParsedSession
): Array<{ userMessage: ParsedMessage; assistantMessage: ParsedMessage; responseTime: number }> {
  const responseTimes: Array<{
    userMessage: ParsedMessage
    assistantMessage: ParsedMessage
    responseTime: number
  }> = []

  for (let i = 0; i < session.messages.length - 1; i++) {
    const current = session.messages[i]
    const next = session.messages[i + 1]

    if (current.type === 'user_input' && next.type === 'assistant_response') {
      const responseTime = next.timestamp.getTime() - current.timestamp.getTime()
      responseTimes.push({
        userMessage: current,
        assistantMessage: next,
        responseTime,
      })
    }
  }

  return responseTimes
}

/**
 * Check if a message is an interruption message
 */
function isInterruptionMessage(message: ParsedMessage): boolean {
  const content = extractTextContent(message)
  return (
    content.includes('[Request interrupted by user for tool use]') ||
    content.includes('[Request interrupted by user]') ||
    content.includes('Request interrupted by user')
  )
}

/**
 * Extract text content from a message regardless of its structure
 */
function extractTextContent(message: ParsedMessage): string {
  if (typeof message.content === 'string') {
    return message.content
  }

  if (isStructuredMessageContent(message.content)) {
    return message.content.text || ''
  }

  return ''
}
