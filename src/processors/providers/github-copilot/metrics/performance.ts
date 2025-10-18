import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { PerformanceMetrics } from '@guideai-dev/types'
import { GitHubCopilotParser } from '../parser.js'

export class CopilotPerformanceProcessor extends BaseMetricProcessor {
  readonly name = 'performance'
  readonly metricType = 'performance' as const
  readonly description = 'Measures response latency, tool execution time, and task completion time'

  private parser = new GitHubCopilotParser()

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

    // Calculate tool execution times (time between tool_call_requested and tool_call_completed)
    const toolExecutionTimes = this.calculateToolExecutionTimes(session)
    const averageToolExecutionTime =
      toolExecutionTimes.length > 0
        ? toolExecutionTimes.reduce((sum, time) => sum + time, 0) / toolExecutionTimes.length
        : 0

    // Calculate task completion time (total session duration)
    const taskCompletionTime = session.duration

    return {
      response_latency_ms: Math.round(averageResponseTime),
      task_completion_time_ms: taskCompletionTime,

      // Additional context for improvement guidance
      metadata: {
        total_responses: responseTimes.length,
        improvement_tips: this.generateImprovementTips(
          averageResponseTime,
          taskCompletionTime,
          averageToolExecutionTime
        ),
        // Extra fields for analysis (not in type definition but useful)
        ...(toolExecutionTimes.length > 0 && {
          total_tool_executions: toolExecutionTimes.length,
          average_tool_execution_ms: Math.round(averageToolExecutionTime),
          min_tool_execution_ms: Math.round(Math.min(...toolExecutionTimes)),
          max_tool_execution_ms: Math.round(Math.max(...toolExecutionTimes)),
        }),
      } as any,
    }
  }

  /**
   * Calculate tool execution times by linking tool_call_requested to tool_call_completed via callId
   */
  private calculateToolExecutionTimes(session: ParsedSession): number[] {
    const executionTimes: number[] = []

    // Build a map of tool calls by their callId
    const toolCalls = new Map<string, { requestTime: Date; name: string }>()

    for (const message of session.messages) {
      // Tool call requested
      if (message.content?.toolUses && message.content.toolUses.length > 0) {
        for (const toolUse of message.content.toolUses) {
          toolCalls.set(toolUse.id, {
            requestTime: message.timestamp,
            name: toolUse.name,
          })
        }
      }

      // Tool call completed
      if (message.content?.toolResults && message.content.toolResults.length > 0) {
        for (const toolResult of message.content.toolResults) {
          const toolCall = toolCalls.get(toolResult.tool_use_id)
          if (toolCall) {
            const executionTime = message.timestamp.getTime() - toolCall.requestTime.getTime()
            executionTimes.push(executionTime)
          }
        }
      }
    }

    return executionTimes
  }

  private generateImprovementTips(
    responseLatency: number,
    completionTime: number,
    toolExecutionTime: number
  ): string[] {
    const tips: string[] = []

    if (responseLatency > 10000) {
      // > 10 seconds
      tips.push('Consider breaking complex requests into smaller, more specific tasks')
      tips.push('Provide more context upfront to reduce AI thinking time')
    }

    if (toolExecutionTime > 5000) {
      // > 5 seconds average tool execution
      tips.push('Tool execution is slow - this may indicate large files or complex operations')
      tips.push('Consider optimizing file operations or breaking down complex bash commands')
    }

    if (completionTime > 1800000) {
      // > 30 minutes
      tips.push('Try to be more specific in your initial request to reduce back-and-forth')
      tips.push('Consider providing code examples or file paths to speed up the process')
    }

    if (responseLatency < 3000 && toolExecutionTime < 1000 && completionTime < 300000) {
      tips.push('⚡ Excellent performance! Fast responses and efficient tool execution')
    }

    return tips
  }
}
