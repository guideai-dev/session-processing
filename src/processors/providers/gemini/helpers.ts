/**
 * Gemini Code Parser Helpers
 *
 * Utility functions for extracting information from parsed Gemini Code sessions.
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
 * Skips tool messages to find the actual assistant response
 */
export function calculateResponseTimes(
  session: ParsedSession
): Array<{ userMessage: ParsedMessage; assistantMessage: ParsedMessage; responseTime: number }> {
  const responseTimes: Array<{
    userMessage: ParsedMessage
    assistantMessage: ParsedMessage
    responseTime: number
  }> = []

  for (let i = 0; i < session.messages.length; i++) {
    const current = session.messages[i]

    if (current.type === 'user_input') {
      // Find the next assistant_response message (skipping tool messages)
      for (let j = i + 1; j < session.messages.length; j++) {
        const candidate = session.messages[j]

        if (candidate.type === 'assistant_response') {
          const responseTime = candidate.timestamp.getTime() - current.timestamp.getTime()
          responseTimes.push({
            userMessage: current,
            assistantMessage: candidate,
            responseTime,
          })
          break // Found the response for this user message
        }

        // Stop if we hit another user message
        if (candidate.type === 'user_input') {
          break
        }
      }
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

/**
 * Extract thoughts from Gemini messages
 */
export function extractThoughts(
  session: ParsedSession
): Array<{ subject: string; description: string; timestamp: string }> {
  const thoughts: Array<{ subject: string; description: string; timestamp: string }> = []

  for (const message of session.messages) {
    if (message.metadata?.thoughts && Array.isArray(message.metadata.thoughts)) {
      thoughts.push(
        ...(message.metadata.thoughts as Array<{
          subject: string
          description: string
          timestamp: string
        }>)
      )
    }
  }

  return thoughts
}

/**
 * Calculate total tokens from Gemini session
 */
export function calculateTotalTokens(session: ParsedSession): {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalInput: number
  totalOutput: number
  totalCached: number
  cacheHitRate: number
  totalThoughts: number
  thinkingOverhead: number
  total: number
} {
  let inputTokens = 0
  let outputTokens = 0
  let cachedTokens = 0
  let thoughtsTokens = 0
  let toolTokens = 0

  for (const message of session.messages) {
    if (message.metadata?.tokens) {
      const tokens = message.metadata.tokens as {
        input?: number
        output?: number
        cached?: number
        thoughts?: number
        tool?: number
      }
      inputTokens += tokens.input || 0
      outputTokens += tokens.output || 0
      cachedTokens += tokens.cached || 0
      thoughtsTokens += tokens.thoughts || 0
      toolTokens += tokens.tool || 0
    }
  }

  const total = inputTokens + outputTokens + cachedTokens + thoughtsTokens + toolTokens
  const totalTokens = inputTokens + outputTokens
  const cacheHitRate =
    inputTokens + cachedTokens > 0 ? cachedTokens / (inputTokens + cachedTokens) : 0
  const thinkingOverhead = outputTokens > 0 ? thoughtsTokens / outputTokens : 0

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    totalInput: inputTokens,
    totalOutput: outputTokens,
    totalCached: cachedTokens,
    cacheHitRate,
    totalThoughts: thoughtsTokens,
    thinkingOverhead,
    total,
  }
}

/**
 * Analyze thinking depth from Gemini messages
 */
export function analyzeThinking(session: ParsedSession): {
  totalThoughts: number
  messagesWithThinking: number
  averageThinkingLength: number
  thinkingToOutputRatio: number
  avgThoughtsPerMessage: number
  maxThinkingDepth: number
  thinkingMessages: number
  thinkingMessagePercentage: number
} {
  const thoughts = extractThoughts(session)
  let messagesWithThinking = 0
  let totalThinkingLength = 0
  let totalOutputLength = 0
  let maxThinkingDepth = 0
  const totalMessages = session.messages.length
  const _totalAssistantMessages = session.messages.filter(
    m => m.type === 'assistant_response'
  ).length

  for (const message of session.messages) {
    if (message.type === 'assistant_response' && message.metadata?.thoughts) {
      const thoughtArray = message.metadata.thoughts
      if (Array.isArray(thoughtArray) && thoughtArray.length > 0) {
        messagesWithThinking++
        maxThinkingDepth = Math.max(maxThinkingDepth, thoughtArray.length)

        // Calculate thinking length
        for (const thought of thoughtArray) {
          if (typeof thought === 'object' && thought !== null) {
            const desc = (thought as { description?: string }).description || ''
            totalThinkingLength += desc.length
          }
        }
      }
    }

    if (message.type === 'assistant_response') {
      const text = extractTextContent(message)
      totalOutputLength += text.length
    }
  }

  return {
    totalThoughts: thoughts.length,
    messagesWithThinking,
    averageThinkingLength:
      messagesWithThinking > 0 ? totalThinkingLength / messagesWithThinking : 0,
    thinkingToOutputRatio: totalOutputLength > 0 ? totalThinkingLength / totalOutputLength : 0,
    avgThoughtsPerMessage: messagesWithThinking > 0 ? thoughts.length / messagesWithThinking : 0,
    maxThinkingDepth,
    thinkingMessages: messagesWithThinking,
    thinkingMessagePercentage: totalMessages > 0 ? (messagesWithThinking / totalMessages) * 100 : 0,
  }
}
