import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { EngagementMetrics } from '@guideai-dev/types'
import { GitHubCopilotParser } from '../parser.js'

export class CopilotEngagementProcessor extends BaseMetricProcessor {
  readonly name = 'engagement'
  readonly metricType = 'engagement' as const
  readonly description = 'Measures interruption rate and session length for user engagement'

  private parser = new GitHubCopilotParser()

  async process(session: ParsedSession): Promise<EngagementMetrics> {
    const userMessages = session.messages.filter(m => m.type === 'user')
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    if (userMessages.length === 0 || assistantMessages.length === 0) {
      return {
        interruption_rate: 0,
        session_length_minutes: 0
      }
    }

    // Calculate interruption rate (key metric for user patience)
    // Count both parser-detected interruptions and info message cancellations
    const interruptions = this.parser.findInterruptions(session)
    const cancellations = this.detectCancellations(session)
    const totalInterruptions = interruptions.length + cancellations

    const interruptionRate = Math.round((totalInterruptions / assistantMessages.length) * 100)

    // Calculate session length in minutes (active engagement time)
    const sessionLengthMinutes = Math.round(session.duration / (1000 * 60))

    // Calculate conversation turns (user-assistant exchanges)
    const conversationTurns = this.calculateConversationTurns(session)

    // Calculate average time per turn
    const avgTimePerTurn = conversationTurns > 0
      ? Math.round(session.duration / conversationTurns / 1000) // seconds per turn
      : 0

    return {
      interruption_rate: interruptionRate,
      session_length_minutes: sessionLengthMinutes,

      // Additional context for improvement guidance
      metadata: {
        total_interruptions: totalInterruptions,
        total_responses: assistantMessages.length,
        improvement_tips: this.generateImprovementTips(interruptionRate, sessionLengthMinutes, conversationTurns),
        // Extra fields for analysis
        interruptions_from_parser: interruptions.length,
        cancellations_from_info: cancellations,
        conversation_turns: conversationTurns,
        avg_seconds_per_turn: avgTimePerTurn
      } as any
    }
  }

  /**
   * Detect cancellations from info messages (e.g., "Operation cancelled by user")
   */
  private detectCancellations(session: ParsedSession): number {
    let count = 0
    for (const message of session.messages) {
      if (message.metadata?.isInfo && message.content?.text) {
        const text = message.content.text.toLowerCase()
        if (text.includes('cancelled') || text.includes('canceled')) {
          count++
        }
      }
    }
    return count
  }

  /**
   * Calculate conversation turns (user-assistant exchanges)
   */
  private calculateConversationTurns(session: ParsedSession): number {
    let turns = 0
    let lastType: string | null = null

    for (const message of session.messages) {
      if (message.type === 'user' && lastType !== 'user') {
        turns++
      }
      lastType = message.type
    }

    return turns
  }

  private generateImprovementTips(interruptionRate: number, sessionLength: number, conversationTurns: number): string[] {
    const tips: string[] = []

    if (interruptionRate > 50) {
      tips.push("High interruption rate - consider whether initial prompt provided enough context")
      tips.push("Note: Some interruptions are effective steering when AI goes off track")
    }

    if (sessionLength > 60) { // > 1 hour
      tips.push("Long session - complex tasks take time, ensure you're making steady progress")
      tips.push("Consider whether initial requirements and context were comprehensive")
    }

    if (conversationTurns > 20) {
      tips.push("Many conversation turns - consider providing more comprehensive context upfront")
      tips.push("Try bundling related requests to reduce back-and-forth")
    }

    if (interruptionRate < 10 && sessionLength < 30 && conversationTurns <= 10) {
      tips.push("⚡ Great collaboration! Efficient session with clear direction")
    } else if (interruptionRate < 10 && sessionLength < 30) {
      tips.push("✨ Good collaboration! Effective steering with reasonable session length")
    }

    return tips
  }
}
