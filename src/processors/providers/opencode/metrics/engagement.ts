import type { EngagementMetrics } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import { OpenCodeParser } from '../parser.js'

export class OpenCodeEngagementProcessor extends BaseMetricProcessor {
  readonly name = 'engagement'
  readonly metricType = 'engagement' as const
  readonly description = 'Measures interruption rate and session length for user engagement'

  private parser = new OpenCodeParser()

  async process(session: ParsedSession): Promise<EngagementMetrics> {
    const userMessages = session.messages.filter(m => m.type === 'user')
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    if (userMessages.length === 0 || assistantMessages.length === 0) {
      return {
        interruption_rate: 0,
        session_length_minutes: 0,
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
        improvement_tips: this.generateImprovementTips(interruptionRate, sessionLengthMinutes),
      },
    }
  }

  private generateImprovementTips(interruptionRate: number, sessionLength: number): string[] {
    const tips: string[] = []

    if (interruptionRate > 50) {
      tips.push('High interruption rate - consider whether initial prompt provided enough context')
      tips.push('Note: Some interruptions are effective steering when AI goes off track')
    }

    if (sessionLength > 60) {
      // > 1 hour
      tips.push("Long session - complex tasks take time, ensure you're making steady progress")
      tips.push('Consider whether initial requirements and context were comprehensive')
    }

    if (interruptionRate < 10 && sessionLength < 30) {
      tips.push('Excellent collaboration! Efficient session with minimal course corrections')
    }

    return tips
  }
}
