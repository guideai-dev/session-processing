/**
 * Token extraction and aggregation utilities for transcript visualization
 *
 * Handles token data extraction from various AI provider message formats
 * and provides both per-message and cumulative token calculations.
 *
 * Uses the SAME logic as the session-processing metrics to ensure consistency:
 * - Claude Code & Codex: metadata.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}
 * - Gemini: metadata.tokens.{input, output, cached, thoughts, tool}
 * - Excludes sidechain messages from main context calculations
 */

import type { TimelineItem, TimelineMessage } from './timelineTypes.js'
import { isTimelineGroup, isTimelineMessage } from './timelineTypes.js'

/**
 * Token data for a single message
 * Matches the structure used in PerMessageTokens from metrics
 */
export interface MessageTokenData {
  messageId: string
  messageIndex: number
  inputTokens: number
  outputTokens: number
  cacheCreated: number
  cacheRead: number
  totalTokens: number
  isSidechain: boolean // Track sidechain status for potential filtering
}

/**
 * Token data with cumulative totals (for context length visualization)
 * Shows how context grows over time as messages are added
 *
 * Note: cacheRead is NOT accumulated here because it's already cumulative
 * from the API (cache_read_input_tokens shows total cached tokens up to that point)
 */
export interface CumulativeTokenData extends MessageTokenData {
  cumulativeInput: number
  cumulativeOutput: number
  cumulativeCacheCreated: number
  cumulativeTotal: number
}

/**
 * Extract token usage from Claude Code and Codex message metadata
 * Both providers use the same usage schema.
 * Matches the exact field names from ClaudeContextProcessor and CodexContextProcessor.
 */
function extractClaudeTokens(metadata: Record<string, unknown>): {
  input: number
  output: number
  cacheCreated: number
  cacheRead: number
} {
  const usage = metadata?.usage as
    | {
        input_tokens?: number
        output_tokens?: number
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
      }
    | undefined

  return {
    input: usage?.input_tokens || 0,
    output: usage?.output_tokens || 0,
    cacheCreated: usage?.cache_creation_input_tokens || 0,
    cacheRead: usage?.cache_read_input_tokens || 0,
  }
}

/**
 * Extract token usage from Gemini message metadata
 * Matches the structure from calculateTotalTokens() in gemini/helpers.ts
 */
function extractGeminiTokens(metadata: Record<string, unknown>): {
  input: number
  output: number
  cacheCreated: number
  cacheRead: number
} {
  const tokens = metadata?.tokens as
    | {
        input?: number
        output?: number
        cached?: number
        thoughts?: number
        tool?: number
      }
    | undefined

  return {
    input: tokens?.input || 0,
    output: tokens?.output || 0,
    cacheCreated: 0, // Gemini doesn't have separate cache_creation
    cacheRead: tokens?.cached || 0,
  }
}

/**
 * Extract token usage from a timeline message
 * Supports multiple provider formats (Claude, Gemini, etc.)
 */
export function extractMessageTokens(message: TimelineMessage): {
  input: number
  output: number
  cacheCreated: number
  cacheRead: number
  isSidechain: boolean
} {
  const metadata = message.originalMessage.metadata || {}

  // Check if this is a sidechain message (used in metrics to calculate context_length)
  const isSidechain = metadata.isSidechain === true

  // Try Claude format first (most common)
  if (metadata.usage) {
    return {
      ...extractClaudeTokens(metadata),
      isSidechain,
    }
  }

  // Try Gemini format
  if (metadata.tokens) {
    return {
      ...extractGeminiTokens(metadata),
      isSidechain,
    }
  }

  // No token data found
  return {
    input: 0,
    output: 0,
    cacheCreated: 0,
    cacheRead: 0,
    isSidechain,
  }
}

/**
 * Calculate per-message token data from timeline items
 * Includes ALL messages (main chain and sidechain) for total token visualization
 */
export function calculatePerMessageTokens(items: TimelineItem[]): MessageTokenData[] {
  const result: MessageTokenData[] = []
  let messageIndex = 0

  for (const item of items) {
    if (isTimelineMessage(item)) {
      const tokens = extractMessageTokens(item)
      result.push({
        messageId: item.id,
        messageIndex,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        cacheCreated: tokens.cacheCreated,
        cacheRead: tokens.cacheRead,
        totalTokens: tokens.input + tokens.output, // Only billable tokens
        isSidechain: tokens.isSidechain,
      })
      messageIndex++
    } else if (isTimelineGroup(item)) {
      // For groups, process each message in the group
      for (const groupMessage of item.messages) {
        const tokens = extractMessageTokens(groupMessage)
        result.push({
          messageId: groupMessage.id,
          messageIndex,
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          cacheCreated: tokens.cacheCreated,
          cacheRead: tokens.cacheRead,
          totalTokens: tokens.input + tokens.output, // Only billable tokens
          isSidechain: tokens.isSidechain,
        })
        messageIndex++
      }
    }
  }

  return result
}

/**
 * Calculate cumulative token data (actual context size as it grows)
 *
 * Shows the ACTUAL context composition at each message point:
 * - cache_read_input_tokens: Already cumulative from API (total cached tokens)
 * - input_tokens: NEW tokens for this message (not cumulative - fresh per message)
 * - output_tokens: Cumulative sum of all outputs generated so far
 *
 * Total context = cacheRead + input + cumulativeOutput
 *
 * This matches what the API actually sees as context and should equal the
 * context_length metric on the metrics page.
 *
 * IMPORTANT: Unlike billable token tracking which sums ALL inputs, this shows
 * the actual context window composition where cache_read represents reused tokens.
 */
export function calculateCumulativeTokens(items: TimelineItem[]): CumulativeTokenData[] {
  const perMessageData = calculatePerMessageTokens(items)
  const result: CumulativeTokenData[] = []

  let cumulativeOutput = 0
  let cumulativeCacheCreated = 0
  let lastCacheRead = 0 // Track last non-zero cache read value

  for (const data of perMessageData) {
    // Output accumulates (all responses generated so far)
    cumulativeOutput += data.outputTokens
    cumulativeCacheCreated += data.cacheCreated

    // Cache reads are cumulative from the API, but may be 0 for some messages
    // Carry forward the last known value to maintain cumulative nature
    if (data.cacheRead > 0) {
      lastCacheRead = data.cacheRead
    }

    // For cumulative view:
    // - cumulativeInput is NOT used (we show per-message input instead)
    // - Total context = cacheRead + input + cumulativeOutput
    result.push({
      ...data,
      cacheRead: lastCacheRead, // Total cached tokens (from API)
      cumulativeInput: data.inputTokens, // Per-message new input (NOT summed)
      cumulativeOutput,
      cumulativeCacheCreated,
      cumulativeTotal: lastCacheRead + data.inputTokens + cumulativeOutput, // Actual context size
    })
  }

  return result
}

/**
 * Format token data for recharts (stacked bar chart)
 * Returns data in the format recharts expects for stacked bars
 *
 * Key naming convention matches how tokens are labeled in the UI:
 * - input: Input tokens (user + assistant input)
 * - output: Output tokens (assistant response)
 * - cacheCreated: Cache creation tokens
 * - cacheRead: Cache read tokens
 */
export interface RechartsTokenData {
  index: number
  messageId: string
  input: number
  output: number
  cacheCreated: number
  cacheRead: number
  total: number
  isSidechain: boolean
}

export function formatForRecharts(
  tokenData: MessageTokenData[] | CumulativeTokenData[],
  mode: 'per-message' | 'cumulative'
): RechartsTokenData[] {
  return tokenData.map((data) => {
    if (mode === 'cumulative' && 'cumulativeInput' in data) {
      return {
        index: data.messageIndex,
        messageId: data.messageId,
        input: data.cumulativeInput,
        output: data.cumulativeOutput,
        cacheCreated: data.cumulativeCacheCreated,
        cacheRead: data.cacheRead, // Use raw value - already cumulative from API
        total: data.cumulativeTotal,
        isSidechain: data.isSidechain,
      }
    }

    // Per-message mode: hide cache reads (they're cumulative, not per-message)
    return {
      index: data.messageIndex,
      messageId: data.messageId,
      input: data.inputTokens,
      output: data.outputTokens,
      cacheCreated: data.cacheCreated,
      cacheRead: 0, // Hide cache reads in per-message mode
      total: data.totalTokens,
      isSidechain: data.isSidechain,
    }
  })
}
