import { OpenCodeParser } from '../../../parsers/index.js'
import { type BaseMetricProcessor, BaseProviderProcessor } from '../../base/index.js'

import { OpenCodeEngagementProcessor } from './metrics/engagement.js'
import { OpenCodeErrorProcessor } from './metrics/error.js'
// Import metric processors
import { OpenCodePerformanceProcessor } from './metrics/performance.js'
import { OpenCodeQualityProcessor } from './metrics/quality.js'
import { OpenCodeUsageProcessor } from './metrics/usage.js'

/**
 * OpenCode uses Claude-like message format (Anthropic Messages API)
 * We reuse Claude Code's parser since the structure is identical
 */
export class OpenCodeProcessor extends BaseProviderProcessor {
  readonly providerName = 'opencode'
  readonly description = 'Processes OpenCode session logs with comprehensive metrics analysis'

  private parser = new OpenCodeParser()
  private metricProcessors: BaseMetricProcessor[]

  constructor() {
    super()

    // Initialize metric processors
    this.metricProcessors = [
      new OpenCodePerformanceProcessor(),
      new OpenCodeEngagementProcessor(),
      new OpenCodeQualityProcessor(),
      new OpenCodeUsageProcessor(),
      new OpenCodeErrorProcessor(),
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
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // OpenCode format detection: has sessionId instead of uuid
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line)

          const hasOpenCodeFields =
            parsedLine.sessionId &&
            parsedLine.timestamp &&
            parsedLine.type &&
            parsedLine.message &&
            (parsedLine.type === 'user' ||
              parsedLine.type === 'assistant' ||
              parsedLine.type === 'tool_use' ||
              parsedLine.type === 'tool_result')

          if (hasOpenCodeFields) {
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
}

// Export individual processors for testing
export {
  OpenCodePerformanceProcessor,
  OpenCodeEngagementProcessor,
  OpenCodeQualityProcessor,
  OpenCodeUsageProcessor,
  OpenCodeErrorProcessor,
  OpenCodeParser,
}
