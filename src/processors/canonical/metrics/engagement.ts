/**
 * Unified Engagement Metrics Processor
 *
 * Works for all providers using the canonical format.
 * Measures interruption rate and session length.
 */

import type { EngagementMetrics } from '@guideai-dev/types'
import type { ParsedMessage, ParsedSession } from '../../../parsers/base/types.js'
import { BaseMetricProcessor } from '../../base/metric-processor.js'

export class CanonicalEngagementProcessor extends BaseMetricProcessor {
  readonly name = 'canonical-engagement'
  readonly metricType = 'engagement' as const
  readonly description = 'Measures interruption rate and session length (unified for all providers)'

  async process(session: ParsedSession): Promise<EngagementMetrics> {
    const userMessages = session.messages.filter(m => m.type === 'user')
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    if (userMessages.length === 0 || assistantMessages.length === 0) {
      return {
        interruption_rate: 0,
        session_length_minutes: 0,
      }
    }

    // Calculate interruption rate
    const interruptions = this.findInterruptions(session.messages)
    const interruptionRate = Math.round((interruptions.length / assistantMessages.length) * 100)

    // Calculate session length in minutes
    const sessionLengthMinutes = Math.round(session.duration / (1000 * 60))

    return {
      interruption_rate: interruptionRate,
      session_length_minutes: sessionLengthMinutes,
      metadata: {
        total_interruptions: interruptions.length,
        total_responses: assistantMessages.length,
        improvement_tips: this.generateImprovementTips(interruptionRate, sessionLengthMinutes),
      },
    }
  }

  /**
   * Find interruption messages
   * An interruption is when:
   * 1. User sends consecutive messages (without assistant response in between)
   * 2. User message contains interruption keywords (stop, wait, actually, no)
   */
  private findInterruptions(messages: ParsedMessage[]): ParsedMessage[] {
    const interruptions: ParsedMessage[] = []

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i]
      const previous = messages[i - 1]

      // Type 1: Consecutive user messages
      if (current.type === 'user' && previous.type === 'user') {
        interruptions.push(current)
        continue
      }

      // Type 2: User message with interruption keywords
      if (current.type === 'user') {
        const content = this.extractTextContent(current).toLowerCase()
        const hasInterruptionKeyword =
          content.includes('wait') ||
          content.includes('stop') ||
          content.includes('actually') ||
          content.startsWith('no, ') ||
          content.includes('cancel')

        if (hasInterruptionKeyword) {
          interruptions.push(current)
        }
      }
    }

    return interruptions
  }

  /**
   * Extract text content from message (handles both string and structured content)
   */
  private extractTextContent(message: ParsedMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    // Structured content
    if (message.content.text) {
      return message.content.text
    }

    return ''
  }

  /**
   * Generate improvement tips based on metrics
   */
  private generateImprovementTips(interruptionRate: number, sessionLength: number): string[] {
    const tips: string[] = []

    if (interruptionRate > 50) {
      tips.push('High interruption rate - consider providing more context upfront')
      tips.push('Note: Some interruptions are effective when steering AI back on track')
    }

    if (sessionLength > 60) {
      tips.push("Long session - ensure you're making steady progress on your task")
      tips.push('Consider whether initial requirements were comprehensive enough')
    }

    if (interruptionRate < 10 && sessionLength < 30) {
      tips.push('Excellent collaboration! Efficient session with minimal course corrections')
    }

    return tips
  }
}
