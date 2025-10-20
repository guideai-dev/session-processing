import { type BaseMetricProcessor, BaseProviderProcessor } from '../../base/index.js'
import { GeminiParser } from './parser.js'

import { GeminiEngagementProcessor } from './metrics/engagement.js'
import { GeminiErrorProcessor } from './metrics/error.js'
// Import simplified metric processors
import { GeminiPerformanceProcessor } from './metrics/performance.js'
import { GeminiQualityProcessor } from './metrics/quality.js'
import { GeminiUsageProcessor } from './metrics/usage.js'

export class GeminiProcessor extends BaseProviderProcessor {
  readonly providerName = 'gemini-code'
  readonly description =
    'Processes Gemini Code session logs with thinking analysis and cache metrics'

  private parser = new GeminiParser()
  private metricProcessors: BaseMetricProcessor[]

  constructor() {
    super()

    // Initialize simplified metric processors
    this.metricProcessors = [
      new GeminiPerformanceProcessor(),
      new GeminiEngagementProcessor(),
      new GeminiQualityProcessor(),
      new GeminiUsageProcessor(),
      new GeminiErrorProcessor(),
    ]
  }

  parseSession(jsonContent: string, provider: string) {
    this.validateJsonContent(jsonContent)
    return this.parser.parseSession(jsonContent, provider)
  }

  getMetricProcessors(): BaseMetricProcessor[] {
    return this.metricProcessors
  }

  canProcess(content: string): boolean {
    try {
      // Gemini sessions are JSONL format (like Claude Code)
      if (!content.includes('\n')) {
        return false
      }

      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) {
        return false
      }

      // Check for Gemini-specific fields in any line
      for (const line of lines) {
        try {
          const data = JSON.parse(line)

          // Look for Gemini-specific markers
          if (
            data.type === 'gemini' ||
            data.gemini_thoughts ||
            data.gemini_tokens ||
            data.gemini_model
          ) {
            return true
          }
        } catch {}
      }

      return false
    } catch (_error) {
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
      features: [
        'Thinking analysis',
        'Cache efficiency metrics',
        'Token usage tracking',
        'Response time analysis',
        'Quality assessment with thinking depth',
      ],
    }
  }

  /**
   * Override parent validation to handle JSONL format
   */
  protected validateJsonContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

    // Gemini uses JSONL format like Claude Code
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      throw new Error('No valid JSONL lines found')
    }

    let hasValidMessage = false
    let hasGeminiFields = false
    let sessionId = ''

    for (let i = 0; i < lines.length; i++) {
      try {
        const data = JSON.parse(lines[i])

        // Track session ID
        if (data.sessionId && !sessionId) {
          sessionId = data.sessionId
        }

        // Check for valid message structure
        if (data.uuid && data.timestamp && data.type) {
          hasValidMessage = true
        }

        // Check for Gemini-specific fields
        if (
          data.type === 'gemini' ||
          data.gemini_thoughts ||
          data.gemini_tokens ||
          data.gemini_model
        ) {
          hasGeminiFields = true
        }
      } catch (_error) {
        throw new Error(`Invalid JSON on line ${i + 1}`)
      }
    }

    if (!sessionId) {
      throw new Error('No sessionId found in JSONL content')
    }

    if (!hasValidMessage) {
      throw new Error('No valid messages found with required fields')
    }

    if (!hasGeminiFields) {
      throw new Error('No Gemini-specific fields found in messages')
    }
  }
}

// Export individual processors for testing
export {
  GeminiPerformanceProcessor,
  GeminiEngagementProcessor,
  GeminiQualityProcessor,
  GeminiUsageProcessor,
  GeminiErrorProcessor,
  GeminiParser,
}
