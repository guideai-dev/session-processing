import { BaseMetricProcessor } from '../../../base/index.js'
import type { ParsedSession, SessionMetricsData } from '../../../base/types.js'
import { GeminiParser } from '../parser.js'

export class GeminiPerformanceProcessor extends BaseMetricProcessor {
  readonly name = 'gemini-performance'
  readonly metricType = 'performance'
  readonly description = 'Analyzes response times and session performance'

  private parser = new GeminiParser()

  async process(session: ParsedSession): Promise<SessionMetricsData> {
    const responseTimes = this.parser.calculateResponseTimes(session)

    if (responseTimes.length === 0) {
      return this.getEmptyMetrics(session)
    }

    const times = responseTimes.map(rt => rt.responseTime)
    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length
    const minResponseTime = Math.min(...times)
    const maxResponseTime = Math.max(...times)

    // Calculate median
    const sortedTimes = [...times].sort((a, b) => a - b)
    const medianResponseTime =
      sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)]

    // Calculate 95th percentile
    const p95Index = Math.floor(sortedTimes.length * 0.95)
    const p95ResponseTime = sortedTimes[p95Index] || maxResponseTime

    // Analyze response time trends
    const firstHalfAvg =
      times.slice(0, Math.floor(times.length / 2)).reduce((a, b) => a + b, 0) /
      Math.floor(times.length / 2)
    const secondHalfAvg =
      times.slice(Math.floor(times.length / 2)).reduce((a, b) => a + b, 0) /
      (times.length - Math.floor(times.length / 2))

    const responseTimeImprovement =
      firstHalfAvg > 0 ? ((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100 : 0

    // Performance score (0-100, lower response time is better)
    // Good: < 5s, Acceptable: < 10s, Slow: > 10s
    const performanceScore = Math.max(
      0,
      Math.min(100, 100 - ((avgResponseTime / 1000 - 3) / 12) * 100)
    )

    // Return metrics matching PerformanceMetrics interface
    const metrics = {
      // Required PerformanceMetrics fields
      response_latency_ms: avgResponseTime,
      task_completion_time_ms: session.duration,

      // Additional metadata for detailed performance insights
      metadata: {
        total_responses: responseTimes.length,
        improvement_tips: this.generateImprovementTips(avgResponseTime, responseTimeImprovement),

        // Detailed timing statistics
        min_response_time: minResponseTime,
        max_response_time: maxResponseTime,
        median_response_time: medianResponseTime,
        p95_response_time: p95ResponseTime,
        avg_response_time_seconds: avgResponseTime / 1000,
        session_duration_minutes: session.duration / 60000,
        performance_score: performanceScore,
        response_time_variability: maxResponseTime - minResponseTime,
        response_time_improvement_pct: responseTimeImprovement,
        responses_per_minute:
          session.duration > 0 ? responseTimes.length / (session.duration / 60000) : 0,
        first_half_avg_response_time: firstHalfAvg,
        second_half_avg_response_time: secondHalfAvg,
      },
    }

    return metrics
  }

  private getEmptyMetrics(session: ParsedSession) {
    return {
      response_latency_ms: 0,
      task_completion_time_ms: session.duration,
      metadata: {
        total_responses: 0,
        improvement_tips: ['No response times recorded - session may be too short'],
        min_response_time: 0,
        max_response_time: 0,
        median_response_time: 0,
        p95_response_time: 0,
        avg_response_time_seconds: 0,
        session_duration_minutes: session.duration / 60000,
        performance_score: 0,
        response_time_variability: 0,
        response_time_improvement_pct: 0,
        responses_per_minute: 0,
        first_half_avg_response_time: 0,
        second_half_avg_response_time: 0,
      },
    }
  }

  private generateImprovementTips(avgResponseTime: number, improvement: number): string[] {
    const tips: string[] = []

    const avgSeconds = avgResponseTime / 1000

    if (avgSeconds < 5) {
      tips.push('Excellent response times - model is performing very well')
    } else if (avgSeconds < 10) {
      tips.push('Good response times - consider optimizing complex queries if needed')
    } else {
      tips.push('Slow response times - consider breaking down complex requests')
    }

    if (improvement > 20) {
      tips.push('Great improvement! Response times got faster throughout the session')
    } else if (improvement < -20) {
      tips.push('Response times slowed down - may indicate increasing complexity')
    }

    return tips
  }
}
