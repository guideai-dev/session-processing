import type { PerformanceMetrics } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import { ClaudeCodeParser } from '../parser.js'

export class ClaudePerformanceProcessor extends BaseMetricProcessor {
  readonly name = 'performance'
  readonly metricType = 'performance' as const
  readonly description = 'Measures response latency and task completion time'

  private parser = new ClaudeCodeParser()

  async process(session: ParsedSession): Promise<PerformanceMetrics> {
    const messages = session.messages

    if (messages.length === 0) {
      return {
        response_latency_ms: 0,
        task_completion_time_ms: 0,
      }
    }

    // Calculate response latency (average time between user message and assistant response)
    const responseTimes = this.parser.calculateResponseTimes(session)
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, rt) => sum + rt.responseTime, 0) / responseTimes.length
        : 0

    // Calculate task completion time (total session duration)
    const taskCompletionTime = session.duration

    return {
      response_latency_ms: Math.round(averageResponseTime),
      task_completion_time_ms: taskCompletionTime,

      // Additional context for improvement guidance
      metadata: {
        total_responses: responseTimes.length,
        improvement_tips: this.generateImprovementTips(averageResponseTime, taskCompletionTime),
      },
    }
  }

  private generateImprovementTips(responseLatency: number, completionTime: number): string[] {
    const tips: string[] = []

    if (responseLatency > 10000) {
      // > 10 seconds
      tips.push('Consider breaking complex requests into smaller, more specific tasks')
      tips.push('Provide more context upfront to reduce AI thinking time')
    }

    if (completionTime > 1800000) {
      // > 30 minutes
      tips.push('Try to be more specific in your initial request to reduce back-and-forth')
      tips.push('Consider providing code examples or file paths to speed up the process')
    }

    return tips
  }
}
