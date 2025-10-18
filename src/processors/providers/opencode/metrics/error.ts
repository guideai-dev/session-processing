import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { ErrorMetrics } from '@guideai-dev/types'
import { OpenCodeParser } from '../parser.js'

export class OpenCodeErrorProcessor extends BaseMetricProcessor {
  readonly name = 'error'
  readonly metricType = 'error' as const
  readonly description = 'Tracks errors, failures, and recovery patterns during session'

  private parser = new OpenCodeParser()

  async process(session: ParsedSession): Promise<ErrorMetrics> {
    const toolResults = this.parser.extractToolResults(session)
    const toolUses = this.parser.extractToolUses(session)

    if (toolResults.length === 0) {
      return {
        error_count: 0,
        error_types: [],
        last_error_message: undefined,
        recovery_attempts: 0,
        fatal_errors: 0,
      }
    }

    // Extract errors from tool results
    const errors = this.extractErrors(toolResults)
    const errorTypes = this.categorizeErrors(errors)
    const recoveryAttempts = this.countRecoveryAttempts(session, errors)
    const fatalErrors = this.countFatalErrors(errors, toolUses)

    return {
      error_count: errors.length,
      error_types: Array.from(new Set(errorTypes)), // Unique error types
      last_error_message: errors.length > 0 ? errors[errors.length - 1].message : undefined,
      recovery_attempts: recoveryAttempts,
      fatal_errors: fatalErrors,
    }
  }

  private extractErrors(
    toolResults: any[]
  ): Array<{ message: string; tool: string; severity: 'warning' | 'error' | 'fatal' }> {
    const errors: Array<{
      message: string
      tool: string
      severity: 'warning' | 'error' | 'fatal'
    }> = []

    for (const result of toolResults) {
      const resultStr = JSON.stringify(result).toLowerCase()
      const errorIndicators = this.getErrorIndicators(resultStr, result)

      if (errorIndicators.hasError) {
        errors.push({
          message: errorIndicators.message || 'Unknown error',
          tool: result.name || 'unknown',
          severity: errorIndicators.severity,
        })
      }
    }

    return errors
  }

  private getErrorIndicators(
    resultStr: string,
    result: any
  ): {
    hasError: boolean
    message?: string
    severity: 'warning' | 'error' | 'fatal'
  } {
    // OpenCode tool results have an explicit is_error field - use it first
    if (result.is_error !== undefined) {
      if (result.is_error === true) {
        return {
          hasError: true,
          message:
            typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
          severity: 'error',
        }
      }
      // If is_error is false, this is not an error
      return { hasError: false, severity: 'warning' }
    }

    // Check for explicit error in result
    if (result.error || result.status === 'error') {
      return {
        hasError: true,
        message: typeof result.error === 'string' ? result.error : JSON.stringify(result.error),
        severity: 'error',
      }
    }

    // Fatal error keywords
    const fatalKeywords = [
      'fatal error',
      'critical error',
      'cannot continue',
      'system failure',
      'unrecoverable',
    ]

    // Error keywords
    const errorKeywords = [
      'error:',
      'exception',
      'failed',
      'failure',
      'permission denied',
      'access denied',
      'not found',
      'does not exist',
      'invalid',
      'cannot',
      'unable to',
      'could not',
    ]

    // Warning keywords (less severe)
    const warningKeywords = ['warning:', 'deprecated', 'caution', 'notice']

    for (const keyword of fatalKeywords) {
      if (resultStr.includes(keyword)) {
        return {
          hasError: true,
          message: this.extractErrorMessage(resultStr, keyword),
          severity: 'fatal',
        }
      }
    }

    for (const keyword of errorKeywords) {
      if (resultStr.includes(keyword)) {
        return {
          hasError: true,
          message: this.extractErrorMessage(resultStr, keyword),
          severity: 'error',
        }
      }
    }

    for (const keyword of warningKeywords) {
      if (resultStr.includes(keyword)) {
        return {
          hasError: true,
          message: this.extractErrorMessage(resultStr, keyword),
          severity: 'warning',
        }
      }
    }

    return { hasError: false, severity: 'warning' }
  }

  private extractErrorMessage(resultStr: string, keyword: string): string {
    const index = resultStr.indexOf(keyword)
    if (index === -1) return keyword

    // Extract a reasonable chunk around the keyword
    const start = Math.max(0, index - 50)
    const end = Math.min(resultStr.length, index + 200)
    const chunk = resultStr.substring(start, end).trim()

    // Try to extract just the error line
    const lines = chunk.split('\n')
    const errorLine = lines.find(line => line.includes(keyword))

    return errorLine ? errorLine.trim() : chunk
  }

  private categorizeErrors(
    errors: Array<{ message: string; tool: string; severity: string }>
  ): string[] {
    const categories = new Set<string>()

    for (const error of errors) {
      const message = error.message.toLowerCase()
      const tool = error.tool

      // File system errors
      if (message.includes('not found') || message.includes('does not exist')) {
        categories.add('file_not_found')
      } else if (message.includes('permission denied') || message.includes('access denied')) {
        categories.add('permission_error')
      } else if (
        message.includes('file') &&
        (message.includes('error') || message.includes('failed'))
      ) {
        categories.add('file_operation_error')
      }

      // Code/syntax errors
      else if (message.includes('syntax error') || message.includes('parse error')) {
        categories.add('syntax_error')
      } else if (message.includes('type error') || message.includes('undefined')) {
        categories.add('type_error')
      }

      // Runtime errors
      else if (message.includes('timeout') || message.includes('timed out')) {
        categories.add('timeout_error')
      } else if (message.includes('connection') && message.includes('failed')) {
        categories.add('connection_error')
      }

      // Tool-specific errors
      else if (tool === 'Bash' && message.includes('command')) {
        categories.add('command_error')
      } else if (tool === 'Grep' || tool === 'Glob') {
        categories.add('search_error')
      } else if (tool === 'Read' || tool === 'Write' || tool === 'Edit') {
        categories.add('file_operation_error')
      }

      // Generic error if no category matched
      else {
        categories.add('unknown_error')
      }
    }

    return Array.from(categories)
  }

  private countRecoveryAttempts(
    session: ParsedSession,
    errors: Array<{ message: string; tool: string; severity: string }>
  ): number {
    // Recovery attempt is when the same tool is used again after a failure
    // or when a different approach is tried after an error

    let recoveryCount = 0
    const toolUses = this.parser.extractToolUses(session)
    const errorTools = errors.map(e => e.tool)

    // Simple heuristic: count retries of the same tool type after errors
    for (let i = 0; i < toolUses.length - 1; i++) {
      const currentTool = toolUses[i].name
      const nextTool = toolUses[i + 1].name

      // If this tool had an error and the next use is the same tool, it's likely a recovery attempt
      if (errorTools.includes(currentTool) && currentTool === nextTool) {
        recoveryCount++
      }
    }

    return recoveryCount
  }

  private countFatalErrors(
    errors: Array<{ message: string; tool: string; severity: string }>,
    toolUses: any[]
  ): number {
    // Fatal errors are those that stop progress
    let fatalCount = 0

    for (const error of errors) {
      // Explicit fatal severity
      if (error.severity === 'fatal') {
        fatalCount++
        continue
      }

      // Errors that typically can't be recovered from
      const fatalPatterns = [
        'permission denied',
        'access denied',
        'authentication failed',
        'authorization failed',
        'quota exceeded',
        'out of memory',
        'disk full',
      ]

      const message = error.message.toLowerCase()
      if (fatalPatterns.some(pattern => message.includes(pattern))) {
        fatalCount++
      }
    }

    return fatalCount
  }
}
