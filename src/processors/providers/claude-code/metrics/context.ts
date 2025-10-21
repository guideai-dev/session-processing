import type { BaseMetrics } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'

/**
 * Per-message token usage data for visualization
 */
export interface PerMessageTokens {
  step: number
  input_tokens: number
  output_tokens: number
  cache_created: number
  cache_read: number
  cumulative_input: number
  cumulative_output: number
}

/**
 * Context management metrics for tracking token usage and compaction events
 */
export interface ContextManagementMetrics extends BaseMetrics {
  total_input_tokens: number
  total_output_tokens: number
  total_cache_created: number
  total_cache_read: number
  context_length: number
  context_window_size: number
  context_utilization_percent: number
  compact_event_count: number
  compact_event_steps: string // JSON array
  avg_tokens_per_message: number
  messages_until_first_compact: number | null
  context_improvement_tips: string // JSON array
}

/**
 * Claude Context Management Processor
 *
 * Tracks token usage, cache efficiency, and context compaction events.
 * This helps identify sessions that hit context limits and provides
 * insights into token consumption patterns.
 */
export class ClaudeContextProcessor extends BaseMetricProcessor {
  readonly name = 'context'
  readonly metricType = 'context-management' as const
  readonly description = 'Tracks token usage, cache efficiency, and context management'

  // Claude Sonnet 4.5 context window
  private readonly CONTEXT_WINDOW_SIZE = 200000

  async process(session: ParsedSession): Promise<ContextManagementMetrics> {
    // Calculate totals
    const totals = this.calculateTotals(session)

    // Detect compact events
    const compactEvents = this.detectCompactEvents(session)

    // Calculate average input tokens per message (for messages that have token data)
    const avgTokensPerMessage = this.calculateAvgTokensPerMessage(session)

    // Calculate context utilization based on context_length
    const contextUtilization = (totals.contextLength / this.CONTEXT_WINDOW_SIZE) * 100

    // Generate improvement tips
    const improvementTips = this.generateImprovementTips(compactEvents, totals, contextUtilization)

    return {
      total_input_tokens: totals.totalInputTokens,
      total_output_tokens: totals.totalOutputTokens,
      total_cache_created: totals.totalCacheCreated,
      total_cache_read: totals.totalCacheRead,
      context_length: totals.contextLength,
      context_window_size: this.CONTEXT_WINDOW_SIZE,
      context_utilization_percent: contextUtilization,
      compact_event_count: compactEvents.count,
      compact_event_steps: JSON.stringify(compactEvents.steps),
      avg_tokens_per_message: avgTokensPerMessage,
      messages_until_first_compact: compactEvents.firstCompactStep,
      context_improvement_tips: JSON.stringify(improvementTips),
    }
  }

  /**
   * Calculate average input tokens per message
   */
  private calculateAvgTokensPerMessage(session: ParsedSession): number {
    let totalInputTokens = 0
    let messageCount = 0

    for (const message of session.messages) {
      const usage = message.metadata?.usage as
        | {
            input_tokens?: number
          }
        | undefined

      const inputTokens = usage?.input_tokens || 0
      if (inputTokens > 0) {
        totalInputTokens += inputTokens
        messageCount++
      }
    }

    return messageCount > 0 ? totalInputTokens / messageCount : 0
  }

  /**
   * Calculate token totals from the session
   *
   * Follows the reference implementation from ccstatusline:
   * - Sum all input_tokens, output_tokens, cache_created, cache_read
   * - Calculate context_length from most recent MAIN CHAIN message (not sidechain)
   */
  private calculateTotals(session: ParsedSession) {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheCreated = 0
    let totalCacheRead = 0
    let contextLength = 0
    let mostRecentTimestamp: Date | null = null
    let mostRecentUsage: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    } | null = null

    for (const message of session.messages) {
      const usage = message.metadata?.usage as
        | {
            input_tokens?: number
            output_tokens?: number
            cache_creation_input_tokens?: number
            cache_read_input_tokens?: number
          }
        | undefined

      if (usage) {
        // Sum all tokens (includes both main chain and sidechain)
        totalInputTokens += usage.input_tokens || 0
        totalOutputTokens += usage.output_tokens || 0
        totalCacheCreated += usage.cache_creation_input_tokens || 0
        totalCacheRead += usage.cache_read_input_tokens || 0

        // Track most recent MAIN CHAIN message for context_length
        // Skip sidechain messages (they don't represent the main conversation context)
        const isSidechain = message.metadata?.isSidechain === true
        if (
          !isSidechain &&
          message.timestamp &&
          (!mostRecentTimestamp || message.timestamp > mostRecentTimestamp)
        ) {
          mostRecentTimestamp = message.timestamp
          mostRecentUsage = usage
        }
      }
    }

    // Calculate context_length from most recent main chain message
    if (mostRecentUsage) {
      contextLength =
        (mostRecentUsage.input_tokens || 0) +
        (mostRecentUsage.cache_read_input_tokens || 0) +
        (mostRecentUsage.cache_creation_input_tokens || 0)
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreated,
      totalCacheRead,
      contextLength,
    }
  }

  /**
   * Detect compact events in the session
   *
   * Compaction events are ONLY the /compact command messages themselves,
   * not the assistant's response to the command.
   */
  private detectCompactEvents(session: ParsedSession): {
    count: number
    steps: number[]
    firstCompactStep: number | null
  } {
    const compactSteps: number[] = []

    session.messages.forEach((message, index) => {
      if (message.type === 'compact') {
        compactSteps.push(index + 1) // 1-based indexing
      }
    })

    return {
      count: compactSteps.length,
      steps: compactSteps,
      firstCompactStep: compactSteps.length > 0 ? compactSteps[0] : null,
    }
  }

  /**
   * Generate improvement tips based on context usage
   * NOTE: Excludes cache-related tips since users can't control caching
   */
  private generateImprovementTips(
    compactEvents: { count: number; steps: number[]; firstCompactStep: number | null },
    totals: {
      totalInputTokens: number
      totalOutputTokens: number
      totalCacheCreated: number
      totalCacheRead: number
      contextLength: number
    },
    contextUtilization: number
  ): string[] {
    const tips: string[] = []

    // Compact event warnings
    if (compactEvents.count > 0) {
      tips.push(
        `⚠️ Context compaction occurred ${compactEvents.count} time(s) - this negatively impacts quality`
      )
      tips.push('Break complex tasks into smaller, focused sessions to avoid hitting context limits')
      tips.push('Provide more specific prompts with clear scope to reduce context usage')
    }

    // High context usage warning
    if (contextUtilization > 80) {
      tips.push(
        `High context usage (${contextUtilization.toFixed(1)}%) - session approaching token limits`
      )
      tips.push('Consider /compact command proactively before reaching limits')
    } else if (contextUtilization > 60) {
      tips.push(`Moderate context usage (${contextUtilization.toFixed(1)}%) - monitor token consumption`)
    }

    // First compact timing
    if (compactEvents.firstCompactStep !== null && compactEvents.firstCompactStep < 10) {
      tips.push(
        'Compact occurred very early in session - consider reducing initial context or breaking task'
      )
    }

    // Positive feedback for efficient sessions
    if (compactEvents.count === 0 && contextUtilization < 50) {
      tips.push('✓ Excellent context management - no compaction needed, efficient token usage')
    }

    return tips
  }
}
