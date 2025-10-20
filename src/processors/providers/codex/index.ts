import { CodexParser } from '../../../parsers/index.js'
import { type BaseMetricProcessor, BaseProviderProcessor } from '../../base/index.js'

import { CodexEngagementProcessor } from './metrics/engagement.js'
import { CodexErrorProcessor } from './metrics/error.js'
// Import simplified metric processors
import { CodexPerformanceProcessor } from './metrics/performance.js'
import { CodexQualityProcessor } from './metrics/quality.js'
import { CodexUsageProcessor } from './metrics/usage.js'

export class CodexProcessor extends BaseProviderProcessor {
  readonly providerName = 'codex'
  readonly description = 'Processes Codex session logs with comprehensive metrics analysis'

  private parser = new CodexParser()
  private metricProcessors: BaseMetricProcessor[]

  constructor() {
    super()

    // Initialize simplified metric processors
    this.metricProcessors = [
      new CodexPerformanceProcessor(),
      new CodexEngagementProcessor(),
      new CodexQualityProcessor(),
      new CodexUsageProcessor(),
      new CodexErrorProcessor(),
    ]
  }

  parseSession(jsonlContent: string, _provider: string) {
    this.validateJsonlContent(jsonlContent)
    return this.parser.parseSession(jsonlContent)
  }

  getMetricProcessors(): BaseMetricProcessor[] {
    return this.metricProcessors
  }

  canProcess(content: string): boolean {
    try {
      // Basic validation
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Check if it looks like Codex format by finding the first valid JSON line
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line)

          // Codex messages have these field patterns
          const hasCodexFields =
            parsedLine.timestamp &&
            parsedLine.type &&
            parsedLine.payload &&
            (parsedLine.type === 'session_meta' ||
              parsedLine.type === 'response_item' ||
              parsedLine.type === 'event_msg' ||
              parsedLine.type === 'turn_context')

          if (hasCodexFields) {
            return true
          }
        } catch {}
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
   * Validate Codex specific content format
   */
  protected validateCodexFormat(content: string): void {
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      throw new Error('No content lines found')
    }

    // Find and validate a few actual message lines
    let validMessageLines = 0
    const targetValidLines = Math.min(3, lines.length)

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        // Check if this looks like a Codex entry
        if (entry.timestamp && entry.type && entry.payload) {
          // Validate timestamp format
          const timestamp = new Date(entry.timestamp)
          if (!Number.isNaN(timestamp.getTime())) {
            validMessageLines++
            if (validMessageLines >= targetValidLines) {
              break
            }
          }
        }
      } catch (_parseError) {}
    }

    if (validMessageLines === 0) {
      throw new Error('No valid Codex message lines found')
    }
  }

  /**
   * Override parent validation to include Codex specific checks
   */
  protected validateJsonlContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('No valid lines found in content')
    }

    // Find and validate at least a few JSON lines
    let validJsonLines = 0
    const targetValidLines = Math.min(3, lines.length)

    for (const line of lines) {
      try {
        JSON.parse(line)
        validJsonLines++
        if (validJsonLines >= targetValidLines) {
          break
        }
      } catch {}
    }

    if (validJsonLines === 0) {
      throw new Error('No valid JSON lines found in content')
    }

    // Then run Codex specific validation
    this.validateCodexFormat(content)
  }
}

// Export individual processors for testing
export {
  CodexPerformanceProcessor,
  CodexEngagementProcessor,
  CodexQualityProcessor,
  CodexUsageProcessor,
  CodexErrorProcessor,
  CodexParser,
}
