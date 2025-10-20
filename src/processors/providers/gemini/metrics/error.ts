import { BaseMetricProcessor } from '../../../base/index.js'

import type { ErrorMetrics } from '@guideai-dev/types'
import { filterErrorResults, isErrorResult, isStructuredMessageContent } from '@guideai-dev/types'
import type { ParsedSession } from '../../../base/types.js'

export class GeminiErrorProcessor extends BaseMetricProcessor {
  readonly name = 'gemini-error'
  readonly metricType = 'error'
  readonly description = 'Detects and analyzes errors and issues in Gemini sessions'

  async process(session: ParsedSession): Promise<ErrorMetrics> {
    const errors: Array<{
      messageId: string
      timestamp: Date
      errorType: string
      description: string
    }> = []

    const warnings: Array<{
      messageId: string
      timestamp: Date
      warningType: string
      description: string
    }> = []

    // Analyze each message for errors or warnings
    for (const message of session.messages) {
      const text =
        typeof message.content === 'string'
          ? message.content
          : isStructuredMessageContent(message.content)
            ? message.content.text || ''
            : ''

      // Check for error indicators in content
      if (this.containsErrorPattern(text)) {
        errors.push({
          messageId: message.id,
          timestamp: message.timestamp,
          errorType: 'content_error',
          description: 'Error pattern detected in message content',
        })
      }

      // Check for API errors or failures
      if (this.containsApiError(text)) {
        errors.push({
          messageId: message.id,
          timestamp: message.timestamp,
          errorType: 'api_error',
          description: 'API error or failure detected',
        })
      }

      // Check for incomplete responses
      if (message.type === 'assistant' && this.isIncompleteResponse(text)) {
        warnings.push({
          messageId: message.id,
          timestamp: message.timestamp,
          warningType: 'incomplete_response',
          description: 'Response appears to be incomplete or truncated',
        })
      }

      // Check for missing token data (could indicate issues)
      if (message.type === 'assistant' && !message.metadata?.tokens) {
        warnings.push({
          messageId: message.id,
          timestamp: message.timestamp,
          warningType: 'missing_token_data',
          description: 'Token usage data not available',
        })
      }

      // Check for missing thoughts (unusual for Gemini)
      if (message.type === 'assistant' && !message.metadata?.thoughts) {
        warnings.push({
          messageId: message.id,
          timestamp: message.timestamp,
          warningType: 'missing_thoughts',
          description: 'Thinking data not available (unusual for Gemini)',
        })
      }
    }

    const totalMessages = session.messages.length
    const errorRate = totalMessages > 0 ? (errors.length / totalMessages) * 100 : 0
    const warningRate = totalMessages > 0 ? (warnings.length / totalMessages) * 100 : 0

    // Health score (0-100, higher is better)
    const healthScore = Math.max(0, 100 - (errorRate * 10 + warningRate * 2))

    // Categorize error types
    const errorTypes = Array.from(new Set(errors.map(e => e.errorType)))
    const lastError = errors.length > 0 ? errors[errors.length - 1] : null

    // Count recovery attempts (consecutive errors on same type)
    let recoveryAttempts = 0
    for (let i = 1; i < errors.length; i++) {
      if (errors[i].errorType === errors[i - 1].errorType) {
        recoveryAttempts++
      }
    }

    // Identify fatal errors (API errors are more serious)
    const fatalErrors = errors.filter(e => e.errorType === 'api_error').length

    // Return metrics matching ErrorMetrics interface
    const metrics = {
      // Required ErrorMetrics fields
      error_count: errors.length,
      error_types: errorTypes,
      last_error_message: lastError ? lastError.description : undefined,
      recovery_attempts: recoveryAttempts,
      fatal_errors: fatalErrors,

      // Additional metadata for detailed error insights
      metadata: {
        improvement_tips: this.generateImprovementTips(errors.length, warnings.length, healthScore),

        // Detailed error statistics
        health_score: healthScore,
        total_errors: errors.length,
        error_rate: errorRate,
        has_errors: errors.length > 0,
        total_warnings: warnings.length,
        warning_rate: warningRate,
        has_warnings: warnings.length > 0,
        content_errors: errors.filter(e => e.errorType === 'content_error').length,
        api_errors: errors.filter(e => e.errorType === 'api_error').length,
        incomplete_responses: warnings.filter(w => w.warningType === 'incomplete_response').length,
        missing_token_data: warnings.filter(w => w.warningType === 'missing_token_data').length,
        missing_thoughts: warnings.filter(w => w.warningType === 'missing_thoughts').length,
        total_messages: totalMessages,
        messages_with_issues: errors.length + warnings.length,
        issue_rate:
          totalMessages > 0 ? ((errors.length + warnings.length) / totalMessages) * 100 : 0,
        error_details: errors,
        warning_details: warnings,
      },
    }

    return metrics
  }

  private containsErrorPattern(text: string): boolean {
    const errorPatterns = [
      /error:/i,
      /failed to/i,
      /exception/i,
      /stack trace/i,
      /\berror\b.*\boccurred\b/i,
    ]

    return errorPatterns.some(pattern => pattern.test(text))
  }

  private containsApiError(text: string): boolean {
    const apiErrorPatterns = [
      /api error/i,
      /rate limit/i,
      /quota exceeded/i,
      /authentication failed/i,
      /request failed/i,
      /status code:\s*[45]\d{2}/i,
    ]

    return apiErrorPatterns.some(pattern => pattern.test(text))
  }

  private isIncompleteResponse(text: string): boolean {
    // Check for common indicators of incomplete responses
    if (text.length < 10) return true

    const incompletePatterns = [
      /\.\.\.$/, // Ends with ellipsis
      /[^.!?]$/, // Doesn't end with punctuation (but longer than a word)
    ]

    return text.length > 50 && incompletePatterns.some(pattern => pattern.test(text))
  }

  private generateImprovementTips(
    errorCount: number,
    warningCount: number,
    healthScore: number
  ): string[] {
    const tips: string[] = []

    if (errorCount === 0 && warningCount === 0) {
      tips.push('Perfect session with no errors or warnings')
      return tips
    }

    if (errorCount > 0) {
      tips.push(`Found ${errorCount} error(s) - review error messages for details`)
    }

    if (warningCount > 5) {
      tips.push('Many warnings detected - check for missing data or incomplete responses')
    }

    if (healthScore < 50) {
      tips.push('Low health score - session had significant issues that need attention')
    } else if (healthScore > 80) {
      tips.push('Good health score - minor issues only')
    }

    return tips
  }
}
