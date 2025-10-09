import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { QualityMetrics } from '@guideai-dev/types'
import { ClaudeCodeParser } from '../parser.js'

export class ClaudeQualityProcessor extends BaseMetricProcessor {
  readonly name = 'quality'
  readonly metricType = 'quality' as const
  readonly description = 'Measures task success rate, iteration count, and process quality'

  private parser = new ClaudeCodeParser()

  async process(session: ParsedSession): Promise<QualityMetrics> {
    const toolUses = this.parser.extractToolUses(session)
    const toolResults = this.parser.extractToolResults(session)
    const userMessages = session.messages.filter(m => m.type === 'user')

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

    // Detect plan mode and todo tracking usage
    const planModeUsage = this.detectPlanModeUsage(toolUses)
    const todoTrackingUsage = this.detectTodoTrackingUsage(toolUses)

    // Detect over the top affirmations
    const overTopAffirmations = this.detectOverTopAffirmations(session)

    // Calculate process quality score (good AI usage practices)
    const processQualityScore = this.calculateProcessQuality(toolUses, session, planModeUsage.used, todoTrackingUsage.used)

    return {
      task_success_rate: taskSuccessRate,
      iteration_count: iterationCount,
      process_quality_score: processQualityScore,
      used_plan_mode: planModeUsage.used,
      used_todo_tracking: todoTrackingUsage.used,
      over_top_affirmations: overTopAffirmations.count,

      // Additional context for improvement guidance
      metadata: {
        successful_operations: successfulOperations,
        total_operations: totalOperations,
        exit_plan_mode_count: planModeUsage.count,
        todo_write_count: todoTrackingUsage.count,
        over_top_affirmations_phrases: overTopAffirmations.phrases,
        improvement_tips: this.generateImprovementTips(taskSuccessRate, iterationCount, processQualityScore, planModeUsage.used, todoTrackingUsage.used)
      }
    }
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

  private detectPlanModeUsage(toolUses: any[]): { used: boolean; count: number } {
    const exitPlanModeTools = toolUses.filter(tool => tool.name === 'ExitPlanMode')
    return {
      used: exitPlanModeTools.length > 0,
      count: exitPlanModeTools.length
    }
  }

  private detectTodoTrackingUsage(toolUses: any[]): { used: boolean; count: number } {
    const todoWriteTools = toolUses.filter(tool => tool.name === 'TodoWrite')
    return {
      used: todoWriteTools.length > 0,
      count: todoWriteTools.length
    }
  }

  private calculateProcessQuality(toolUses: any[], session: ParsedSession, usedPlanMode: boolean, usedTodoTracking: boolean): number {
    let score = 0
    const maxScore = 100

    // HIGHEST PRIORITY: Plan mode usage (shows excellent AI process discipline)
    if (usedPlanMode) {
      score += 30 // Excellent: used proper planning mode
    }

    // HIGH PRIORITY: Todo tracking (shows task organization)
    if (usedTodoTracking) {
      score += 20 // Great: used todo tracking for organization
    }

    // Check for "Read before Write" pattern (good practice)
    const readTools = ['Read', 'Grep', 'Glob']
    const writeTools = ['Write', 'Edit']

    const reads = toolUses.filter(tool => readTools.includes(tool.name))
    const writes = toolUses.filter(tool => writeTools.includes(tool.name))

    if (reads.length > 0 && writes.length > 0) {
      score += 25 // Good: reading before writing
    }

    // Check for proper testing/checking patterns
    const testingTools = ['Bash', 'BashOutput']
    const testing = toolUses.filter(tool => testingTools.includes(tool.name))

    if (testing.length > 0 && writes.length > 0) {
      score += 15 // Good: running commands/tests after changes
    }

    // Check for incremental approach (multiple small edits vs one big change)
    if (writes.length > 1 && writes.length <= 5) {
      score += 10 // Good: incremental changes
    }

    // Check for excessive searching (indicates lost/inefficient behavior)
    const searchRatio = reads.length / (writes.length || 1)
    if (searchRatio <= 2) {
      score += 0 // Baseline: efficient search-to-edit ratio (no penalty/bonus)
    } else {
      score -= 10 // Penalty for excessive searching
    }

    return Math.max(0, Math.min(score, maxScore))
  }

  private generateImprovementTips(taskSuccessRate: number, iterationCount: number, processQuality: number, usedPlanMode: boolean, usedTodoTracking: boolean): string[] {
    const tips: string[] = []

    // Determine if there are actual quality issues
    const hasQualityIssues = taskSuccessRate < 70 || iterationCount > 10 || processQuality < 50

    // Plan mode and todo tracking tips (quality-specific)
    if (hasQualityIssues || processQuality < 60) {
      if (!usedPlanMode && !usedTodoTracking) {
        tips.push("🎯 For complex tasks, use plan mode to organize your approach upfront")
        tips.push("📋 Consider using TodoWrite to track progress on multi-step tasks")
      } else if (!usedPlanMode) {
        tips.push("🎯 Try using plan mode to outline your approach before starting complex tasks")
      } else if (!usedTodoTracking) {
        tips.push("📋 Consider using TodoWrite to track progress and ensure all steps are completed")
      }
    }

    // Task success and iteration tips (reframed for context quality)
    if (taskSuccessRate < 70) {
      tips.push("Low success rate - ensure comprehensive upfront context (file paths, specs, code examples)")
      tips.push("Consider improving documentation (CLAUDE.md) to reduce AI exploration")
    }

    if (iterationCount > 10) {
      tips.push("Many iterations - consider whether initial prompt provided enough technical detail and context")
    }

    // Excellent practices recognition
    if (usedPlanMode && usedTodoTracking && taskSuccessRate > 80 && iterationCount <= 5 && processQuality > 80) {
      tips.push("🌟 Outstanding! Excellent process discipline with plan mode, todo tracking, and clear context")
    } else if ((usedPlanMode || usedTodoTracking) && taskSuccessRate > 75 && processQuality > 70) {
      tips.push("✨ Great collaboration! Your use of planning tools shows excellent AI process discipline")
    } else if (taskSuccessRate > 80 && iterationCount <= 5 && processQuality > 70) {
      tips.push("Excellent! Effective context and steering led to efficient execution")
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
