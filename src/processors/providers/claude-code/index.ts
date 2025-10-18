import {
  BaseProviderProcessor,
  BaseMetricProcessor,
  GitDiffMetricProcessor,
} from '../../base/index.js'
import { ClaudeCodeParser } from './parser.js'

// Import simplified metric processors
import { ClaudePerformanceProcessor } from './metrics/performance.js'
import { ClaudeEngagementProcessor } from './metrics/engagement.js'
import { ClaudeQualityProcessor } from './metrics/quality.js'
import { ClaudeUsageProcessor } from './metrics/usage.js'
import { ClaudeErrorProcessor } from './metrics/error.js'

export class ClaudeCodeProcessor extends BaseProviderProcessor {
  readonly providerName = 'claude-code'
  readonly description = 'Processes Claude Code session logs with comprehensive metrics analysis'

  private parser = new ClaudeCodeParser()
  private metricProcessors: BaseMetricProcessor[]
  private gitDiffProcessor = new GitDiffMetricProcessor()

  constructor() {
    super()

    // Initialize simplified metric processors
    // NOTE: Git diff processor is NOT included here - it runs separately AFTER these
    this.metricProcessors = [
      new ClaudePerformanceProcessor(),
      new ClaudeEngagementProcessor(),
      new ClaudeQualityProcessor(),
      new ClaudeUsageProcessor(),
      new ClaudeErrorProcessor(),
    ]
  }

  parseSession(jsonlContent: string) {
    this.validateJsonlContent(jsonlContent)
    return this.parser.parseSession(jsonlContent)
  }

  getMetricProcessors(): BaseMetricProcessor[] {
    return this.metricProcessors
  }

  /**
   * Override to run git diff processor LAST with access to existing metrics
   */
  async processMetrics(jsonlContent: string, context: any): Promise<any[]> {
    const session = this.parseSession(jsonlContent)

    // Attach git diff data from context if available (desktop only)
    if (context.gitDiffData) {
      session.metadata = {
        ...session.metadata,
        gitDiff: context.gitDiffData,
      }
    }

    // Run standard metrics first
    const results = await super.processMetrics(jsonlContent, context)

    // Collect existing metrics for git diff processor
    const existingMetrics: any = {}
    for (const result of results) {
      if (result.metricType === 'performance') existingMetrics.performance = result.metrics
      if (result.metricType === 'usage') existingMetrics.usage = result.metrics
      if (result.metricType === 'error') existingMetrics.error = result.metrics
      if (result.metricType === 'engagement') existingMetrics.engagement = result.metrics
      if (result.metricType === 'quality') existingMetrics.quality = result.metrics
    }

    // Run git diff processor LAST with existing metrics
    try {
      const gitDiffMetrics = await this.gitDiffProcessor.processWithExistingMetrics(
        session,
        existingMetrics
      )
      // Only add if there's actual git data (total files > 0)
      if (gitDiffMetrics && gitDiffMetrics.git_total_files_changed > 0) {
        results.push({
          metricType: 'git-diff',
          metrics: gitDiffMetrics,
          processingTime: 0,
          metadata: {
            processor: 'git-diff',
            processingTime: 0,
            messageCount: session.messages.length,
            sessionDuration: session.duration,
          },
        })
      }
    } catch (error) {
      console.warn('Git diff processor failed (expected for server sessions):', error)
    }

    return results
  }

  canProcess(content: string): boolean {
    try {
      // Basic validation
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Check if it looks like Claude Code format by finding the first valid JSON line
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line)

          // Claude Code messages should have these fields
          const hasClaudeFields =
            parsedLine.uuid &&
            parsedLine.timestamp &&
            parsedLine.type &&
            parsedLine.message &&
            (parsedLine.type === 'user' || parsedLine.type === 'assistant')

          if (hasClaudeFields) {
            return true
          }
        } catch {
          // Skip non-JSON lines (like summary lines)
          continue
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Get processor information for debugging and monitoring
   */
  getProcessorInfo() {
    return {
      providerName: this.providerName,
      description: this.description,
      metricProcessors: this.metricProcessors.map(processor => ({
        name: processor.name,
        metricType: processor.metricType,
        description: processor.description,
      })),
      version: '1.0.0',
    }
  }

  /**
   * Validate Claude Code specific content format
   */
  protected validateClaudeCodeFormat(content: string): void {
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      throw new Error('No content lines found')
    }

    // Find and validate a few actual message lines (skip summary lines)
    let validMessageLines = 0
    const targetValidLines = Math.min(3, lines.length)

    for (const line of lines) {
      try {
        const message = JSON.parse(line)

        // Skip summary lines (they have type: "summary" and different structure)
        if (message.type === 'summary') {
          continue
        }

        // Check if this looks like a Claude Code message
        if (message.uuid && message.timestamp && message.type && message.message) {
          if (['user', 'assistant'].includes(message.type)) {
            // Validate timestamp format
            const timestamp = new Date(message.timestamp)
            if (!isNaN(timestamp.getTime())) {
              validMessageLines++
              if (validMessageLines >= targetValidLines) {
                break
              }
            }
          }
        }
      } catch (parseError) {
        // Skip lines that aren't valid JSON (though this should be rare after earlier validation)
        continue
      }
    }

    if (validMessageLines === 0) {
      throw new Error('No valid Claude Code message lines found')
    }
  }

  /**
   * Override parent validation to handle summary lines and include Claude Code specific checks
   */
  protected validateJsonlContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('No valid lines found in content')
    }

    // Find and validate at least a few JSON lines (skipping summary lines)
    let validJsonLines = 0
    const targetValidLines = Math.min(3, lines.length)

    for (const line of lines) {
      try {
        JSON.parse(line)
        validJsonLines++
        if (validJsonLines >= targetValidLines) {
          break
        }
      } catch {
        // Skip non-JSON lines (like summary lines)
        continue
      }
    }

    if (validJsonLines === 0) {
      throw new Error('No valid JSON lines found in content')
    }

    // Then run Claude Code specific validation
    this.validateClaudeCodeFormat(content)
  }
}

// Export individual processors for testing
export {
  ClaudePerformanceProcessor,
  ClaudeEngagementProcessor,
  ClaudeQualityProcessor,
  ClaudeUsageProcessor,
  ClaudeErrorProcessor,
  ClaudeCodeParser,
}
