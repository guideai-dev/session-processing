import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { QualityMetrics } from '@guideai-dev/types'
import { GitHubCopilotParser } from '../parser.js'

export class CopilotQualityProcessor extends BaseMetricProcessor {
  readonly name = 'quality'
  readonly metricType = 'quality' as const
  readonly description = 'Measures task success rate, iteration count, and process quality'

  private parser = new GitHubCopilotParser()

  async process(session: ParsedSession): Promise<QualityMetrics> {
    const toolUses = this.parser.extractToolUses(session)
    const toolResults = this.parser.extractToolResults(session)
    const userMessages = session.messages.filter(m => m.type === 'user')
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    // Calculate task success rate (key metric for quality)
    const successfulOperations = toolResults.filter(result =>
      !this.hasErrorIndicators(result)
    ).length
    const totalOperations = toolResults.length
    const taskSuccessRate = totalOperations > 0
      ? Math.round((successfulOperations / totalOperations) * 100)
      : 0

    // Calculate iteration count (number of refinement cycles)
    const iterationCount = this.calculateIterations(userMessages, session)

    // Detect over the top affirmations
    const overTopAffirmations = this.detectOverTopAffirmations(session)

    // Detect cancellations (from info messages)
    const cancellations = this.detectCancellations(session)

    // Calculate process quality score (good AI usage practices)
    const processQualityScore = this.calculateProcessQuality(toolUses, session, cancellations)

    // Calculate average assistant response length (quality indicator)
    const avgResponseLength = this.calculateAverageResponseLength(assistantMessages)

    return {
      task_success_rate: taskSuccessRate,
      iteration_count: iterationCount,
      process_quality_score: processQualityScore,
      used_plan_mode: false, // Copilot doesn't have plan mode
      used_todo_tracking: false, // Copilot doesn't have todo tracking
      over_top_affirmations: overTopAffirmations.count,

      // Additional context for improvement guidance
      metadata: {
        successful_operations: successfulOperations,
        total_operations: totalOperations,
        over_top_affirmations_phrases: overTopAffirmations.phrases,
        improvement_tips: this.generateImprovementTips(taskSuccessRate, iterationCount, processQualityScore, cancellations),
        // Extra fields for analysis
        cancellations: cancellations,
        average_response_length: avgResponseLength
      } as any
    }
  }

  /**
   * Detect user cancellations from info messages
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
   * Calculate average assistant response length (quality indicator)
   */
  private calculateAverageResponseLength(assistantMessages: any[]): number {
    if (assistantMessages.length === 0) return 0

    let totalLength = 0
    let textMessages = 0

    for (const message of assistantMessages) {
      const text = this.extractContent(message)
      if (text && text.length > 0) {
        totalLength += text.length
        textMessages++
      }
    }

    return textMessages > 0 ? Math.round(totalLength / textMessages) : 0
  }

  private hasErrorIndicators(result: any): boolean {
    const resultStr = JSON.stringify(result).toLowerCase()
    const errorKeywords = [
      'error', 'failed', 'exception', 'not found',
      'permission denied', 'invalid', 'cannot', 'unable'
    ]
    return errorKeywords.some(keyword => resultStr.includes(keyword))
  }

  private calculateIterations(userMessages: any[], session: ParsedSession): number {
    // Context-based detection: only count user messages that follow assistant responses
    // and contain actual refinement/correction language
    let iterations = 0

    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i]

      // Only check user messages
      if (message.type !== 'user') continue

      // Check if this user message follows an assistant response
      const prevMessage = i > 0 ? session.messages[i - 1] : null
      if (!prevMessage || prevMessage.type !== 'assistant') continue

      const content = this.extractContent(message).toLowerCase()

      // More specific refinement patterns that indicate actual iterations
      const refinementPatterns = [
        // Direct corrections
        'actually,', 'instead,', 'wait,', 'no,', 'correction:',
        // Change requests
        'change that', 'modify that', 'update that', 'fix that',
        'make it', 'let\'s change', 'can you change',
        // Direction changes
        'different approach', 'try a different', 'let\'s try',
        'that\'s not', 'that won\'t work', 'that\'s wrong',
        // Refinements
        'rather than', 'instead of', 'better to',
        // Interruptions with corrections
        '[request interrupted by user]'
      ]

      // Only count if message contains refinement patterns
      if (refinementPatterns.some(pattern => content.includes(pattern))) {
        iterations++
      }
    }

    return iterations
  }

  private calculateProcessQuality(toolUses: any[], session: ParsedSession, cancellations: number): number {
    let score = 50 // Start at 50 as baseline

    // Check for "View before Edit" pattern (good practice with str_replace_editor)
    const viewCommands = toolUses.filter(tool =>
      tool.name === 'str_replace_editor' && tool.input?.command === 'view'
    )
    const editCommands = toolUses.filter(tool =>
      tool.name === 'str_replace_editor' &&
      ['str_replace', 'create', 'insert'].includes(tool.input?.command || '')
    )

    if (viewCommands.length > 0 && editCommands.length > 0) {
      score += 20 // Good: viewing before editing
    }

    // Check for proper testing/checking patterns (bash commands)
    const bashTools = toolUses.filter(tool => tool.name === 'bash')

    if (bashTools.length > 0 && editCommands.length > 0) {
      score += 15 // Good: running commands/tests
    }

    // Check for incremental approach (multiple small edits vs one big change)
    if (editCommands.length > 1 && editCommands.length <= 5) {
      score += 10 // Good: incremental changes
    }

    // Penalty for cancellations (indicates impatience or unclear direction)
    if (cancellations > 0) {
      score -= cancellations * 5 // -5 per cancellation
    }

    // Check for excessive searching (indicates lost/inefficient behavior)
    const searchRatio = viewCommands.length / (editCommands.length || 1)
    if (searchRatio <= 3) {
      score += 5 // Bonus: efficient view-to-edit ratio
    } else if (searchRatio > 10) {
      score -= 15 // Penalty for excessive searching
    }

    // Check for tool diversity (using multiple tools shows thorough approach)
    const uniqueTools = new Set(toolUses.map(t => t.name))
    if (uniqueTools.size > 2) {
      score += 10 // Good: using multiple tools appropriately
    }

    return Math.max(0, Math.min(score, 100))
  }

  private generateImprovementTips(taskSuccessRate: number, iterationCount: number, processQuality: number, cancellations: number): string[] {
    const tips: string[] = []

    if (taskSuccessRate < 70) {
      tips.push("Low success rate - ensure comprehensive upfront context (file paths, specs, code examples)")
      tips.push("Consider improving documentation to reduce AI exploration")
    }

    if (iterationCount > 10) {
      tips.push("Many iterations - consider whether initial prompt provided enough technical detail and context")
      tips.push("Provide examples or templates upfront to reduce back-and-forth")
    }

    if (processQuality < 50) {
      tips.push("Improve process by providing file paths and context upfront to reduce searching")
      tips.push("Let AI view files before making changes for better context")
    }

    if (cancellations > 3) {
      tips.push("High cancellation rate - consider whether initial specs and context were clear")
      tips.push("Note: Some cancellations are effective steering when AI goes off track")
    }

    // Excellent practices recognition
    if (taskSuccessRate > 80 && iterationCount <= 5 && processQuality > 75 && cancellations <= 1) {
      tips.push("🌟 Outstanding! Efficient execution with clear context and effective steering")
    } else if (taskSuccessRate > 75 && processQuality > 70 && cancellations <= 2) {
      tips.push("✨ Great collaboration! Effective context and process discipline")
    } else if (taskSuccessRate > 80 && iterationCount <= 5) {
      tips.push("Excellent! High success rate with minimal iteration shows clear direction")
    }

    return tips
  }

  private detectOverTopAffirmations(session: ParsedSession): { count: number; phrases: string[] } {
    // Patterns to detect over-the-top affirmations
    const affirmationPatterns = [
      // Direct affirmations
      /\byou'?re\s+right\b/i,
      /\byou'?re\s+absolutely\s+right\b/i,
      /\byou'?re\s+completely\s+right\b/i,
      /\byou'?re\s+totally\s+right\b/i,
      /\byou'?re\s+100%\s+right\b/i,
      /\byou'?re\s+spot\s+on\b/i,
      /\byou'?re\s+exactly\s+right\b/i,
      /\bexactly!?\s*$/i,
      /\babsolutely!?\s*$/i,
      /\bperfect!?\s*$/i,
      /\bbrilliant!?\s*$/i,
      /\bexcellent!?\s*$/i,
      // Variations
      /\bthat'?s\s+absolutely\s+right\b/i,
      /\bthat'?s\s+completely\s+correct\b/i,
      /\bthat'?s\s+exactly\s+right\b/i,
      /\bthat'?s\s+spot\s+on\b/i,
      /\bthat'?s\s+perfect\b/i,
      // Over-enthusiastic responses
      /\byes!+\s*$/i,
      /\bawesome!+\s*$/i,
      /\bfantastic!+\s*$/i,
      /\bwonderful!+\s*$/i,
    ]

    let totalCount = 0
    const foundPhrases: string[] = []

    // Check assistant messages for over-the-top affirmations
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    for (const message of assistantMessages) {
      const content = this.extractContent(message).toLowerCase()

      for (const pattern of affirmationPatterns) {
        const matches = content.match(pattern)
        if (matches) {
          totalCount++
          foundPhrases.push(matches[0])
        }
      }
    }

    return {
      count: totalCount,
      phrases: Array.from(new Set(foundPhrases)) // Remove duplicates
    }
  }
}
