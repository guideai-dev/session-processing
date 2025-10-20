import type { ParsedMessage, QualityMetrics } from '@guideai-dev/types'
import { extractTextFromMessage, isStructuredMessageContent } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/index.js'
import type { ParsedSession } from '../../../base/types.js'
import * as helpers from './../helpers.js'

export class GeminiQualityProcessor extends BaseMetricProcessor {
  readonly name = 'gemini-quality'
  readonly metricType = 'quality'
  readonly description = 'Assesses session quality including thinking depth analysis'

  async process(session: ParsedSession): Promise<QualityMetrics> {
    const thinkingAnalysis = helpers.analyzeThinking(session)
    const tokenStats = helpers.calculateTotalTokens(session)

    const assistantMessages = session.messages.filter(m => m.type === 'assistant')
    const userMessages = session.messages.filter(m => m.type === 'user')

    // Base quality metrics
    const avgMessageLength =
      assistantMessages.length > 0
        ? assistantMessages.reduce((sum, m) => {
            const text =
              typeof m.content === 'string'
                ? m.content
                : isStructuredMessageContent(m.content)
                  ? m.content.text || ''
                  : ''
            return sum + text.length
          }, 0) / assistantMessages.length
        : 0

    // Thinking depth score (0-100)
    // More thoughts per message indicates deeper analysis
    const thinkingDepthScore = Math.min(100, thinkingAnalysis.avgThoughtsPerMessage * 10)

    // Message detail score based on length (0-100)
    // Good: > 500 chars, Excellent: > 1000 chars
    const detailScore = Math.min(100, (avgMessageLength / 1000) * 100)

    // Completeness score based on turn-taking (0-100)
    const turns = Math.min(userMessages.length, assistantMessages.length)
    const completenessScore = Math.min(100, (turns / 5) * 100)

    // Cache efficiency bonus (better quality with good caching)
    const cacheBonus = tokenStats.cacheHitRate * 10

    // Thinking coverage (percentage of messages with thinking)
    const thinkingCoverageScore = thinkingAnalysis.thinkingMessagePercentage

    // Overall quality score (0-100)
    // Weighted combination of different quality factors
    const _overallQuality = Math.min(
      100,
      thinkingDepthScore * 0.3 +
        detailScore * 0.25 +
        completenessScore * 0.2 +
        thinkingCoverageScore * 0.15 +
        cacheBonus * 0.1
    )

    // Calculate basic iteration count (user corrections after assistant responses)
    const iterationCount = this.calculateIterations(session)

    // Simple task success estimation based on session completion
    const taskSuccessRate = this.estimateTaskSuccess(session, assistantMessages, userMessages)

    // Process quality based on thinking depth and message quality
    const processQualityScore = Math.round(
      thinkingDepthScore * 0.5 + detailScore * 0.3 + completenessScore * 0.2
    )

    // Return metrics matching QualityMetrics interface
    const metrics = {
      // Required QualityMetrics fields
      task_success_rate: taskSuccessRate,
      iteration_count: iterationCount,
      process_quality_score: processQualityScore,
      used_plan_mode: false, // Gemini doesn't have plan mode
      used_todo_tracking: false, // Gemini doesn't have todo tracking
      over_top_affirmations: 0, // Not applicable for Gemini

      // Additional metadata for Gemini-specific insights
      metadata: {
        successful_operations: assistantMessages.length, // All assistant responses
        total_operations: assistantMessages.length,
        improvement_tips: this.generateImprovementTips(
          taskSuccessRate,
          iterationCount,
          processQualityScore,
          thinkingAnalysis,
          tokenStats
        ),

        // Gemini-specific context
        thinking_depth_score: thinkingDepthScore,
        avg_thoughts_per_message: thinkingAnalysis.avgThoughtsPerMessage,
        cache_hit_rate: tokenStats.cacheHitRate,
        detail_score: detailScore,
        completeness_score: completenessScore,
      },
    }

    return metrics
  }

  private calculateIterations(session: ParsedSession): number {
    let iterations = 0

    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i]

      // Only check user messages
      if (message.type !== 'user') continue

      // Check if this user message follows an assistant response
      const prevMessage = i > 0 ? session.messages[i - 1] : null
      if (!prevMessage || prevMessage.type !== 'assistant') continue

      const content = extractTextFromMessage(message).toLowerCase()

      // Look for refinement/correction patterns
      const refinementPatterns = [
        'actually,',
        'instead,',
        'wait,',
        'no,',
        'correction:',
        'change that',
        'modify that',
        'update that',
        'fix that',
        'different approach',
        'try a different',
        "let's try",
        "that's not",
        "that won't work",
        "that's wrong",
        'rather than',
        'instead of',
        'better to',
      ]

      if (refinementPatterns.some(pattern => content.includes(pattern))) {
        iterations++
      }
    }

    return iterations
  }

  private estimateTaskSuccess(
    _session: ParsedSession,
    assistantMessages: ParsedMessage[],
    userMessages: ParsedMessage[]
  ): number {
    // Simple heuristic: if session ended naturally (not many recent errors)
    // and had reasonable back-and-forth, estimate success

    // Check for completion indicators
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null

    if (lastUserMessage) {
      const content = this.extractContent(lastUserMessage).toLowerCase()

      // Positive completion signals
      if (
        content.includes('thank') ||
        content.includes('perfect') ||
        content.includes('great') ||
        content.includes('done')
      ) {
        return 100
      }

      // Negative signals
      if (
        content.includes('error') ||
        content.includes('not working') ||
        content.includes('failed')
      ) {
        return 50
      }
    }

    // If we have a good number of exchanges, assume moderate success
    const turns = Math.min(userMessages.length, assistantMessages.length)
    if (turns >= 3) {
      return 75
    }

    return 60 // Default moderate success
  }

  private generateImprovementTips(
    taskSuccessRate: number,
    iterationCount: number,
    processQuality: number,
    thinkingAnalysis: ReturnType<typeof helpers.analyzeThinking>,
    tokenStats: ReturnType<typeof helpers.calculateTotalTokens>
  ): string[] {
    const tips: string[] = []

    if (taskSuccessRate < 70) {
      tips.push('Session may have ended with unresolved issues - ensure clear completion signals')
    }

    if (iterationCount > 10) {
      tips.push('Many refinements detected - consider providing more detailed initial context')
    }

    if (thinkingAnalysis.avgThoughtsPerMessage < 2) {
      tips.push('Low thinking depth - model may benefit from more complex prompts')
    }

    if (tokenStats.cacheHitRate > 0.5) {
      tips.push('Excellent cache usage - context is being reused efficiently')
    }

    if (processQuality > 75) {
      tips.push('High quality session with good thinking depth and detail')
    }

    return tips
  }
}
