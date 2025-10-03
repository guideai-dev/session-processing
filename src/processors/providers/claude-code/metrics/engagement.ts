import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { EngagementMetrics } from '@guideai/types'
import { ClaudeCodeParser } from '../parser.js'

export class ClaudeEngagementProcessor extends BaseMetricProcessor {
  readonly name = 'engagement'
  readonly metricType = 'engagement' as const
  readonly description = 'Measures interruption rate and session length for user engagement'

  private parser = new ClaudeCodeParser()

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
    const interruptions = this.parser.findInterruptions(session)
    const interruptionRate = Math.round((interruptions.length / assistantMessages.length) * 100)

    // Calculate session length in minutes (active engagement time)
    const sessionLengthMinutes = Math.round(session.duration / (1000 * 60))

    return {
      interruption_rate: interruptionRate,
      session_length_minutes: sessionLengthMinutes,

      // Additional context for improvement guidance
      metadata: {
        total_interruptions: interruptions.length,
        total_responses: assistantMessages.length,
        improvement_tips: this.generateImprovementTips(interruptionRate, sessionLengthMinutes)
      }
    }
  }

  private generateImprovementTips(interruptionRate: number, sessionLength: number): string[] {
    const tips: string[] = []

    if (interruptionRate > 50) {
      tips.push("High interruption rate suggests impatience - try letting AI finish responses")
      tips.push("Consider asking more specific questions to get better initial responses")
    }

    if (sessionLength > 60) { // > 1 hour
      tips.push("Long sessions may indicate unclear initial requirements")
      tips.push("Try breaking complex tasks into smaller, well-defined parts")
    }

    if (interruptionRate < 10 && sessionLength < 10) {
      tips.push("Great collaboration! You're patient and efficient with AI")
    }

    return tips
  }
}
