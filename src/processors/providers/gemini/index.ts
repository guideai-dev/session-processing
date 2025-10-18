import { BaseProviderProcessor, BaseMetricProcessor } from '../../base/index.js'
import { GeminiParser } from './parser.js'

// Import simplified metric processors
import { GeminiPerformanceProcessor } from './metrics/performance.js'
import { GeminiEngagementProcessor } from './metrics/engagement.js'
import { GeminiQualityProcessor } from './metrics/quality.js'
import { GeminiUsageProcessor } from './metrics/usage.js'
import { GeminiErrorProcessor } from './metrics/error.js'

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

  parseSession(jsonContent: string) {
    this.validateJsonContent(jsonContent)
    return this.parser.parseSession(jsonContent)
  }

  getMetricProcessors(): BaseMetricProcessor[] {
    return this.metricProcessors
  }

  canProcess(content: string): boolean {
    try {
      // Check if content is JSONL with gemini_raw fields
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Look for at least one line with gemini_raw
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)

          // Check for gemini_raw field (Gemini JSONL format)
          if (parsed.gemini_raw) {
            const geminiMsg = parsed.gemini_raw

            // Verify it has Gemini-specific structure
            if (geminiMsg.type === 'gemini' || geminiMsg.type === 'user') {
              return true
            }
          }
        } catch {
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
   * Validate Gemini specific content format
   */
  protected validateGeminiFormat(content: string): void {
    try {
      const json = JSON.parse(content)

      if (!json.sessionId) {
        throw new Error('Missing sessionId field')
      }

      if (!json.projectHash) {
        throw new Error('Missing projectHash field')
      }

      if (!json.messages || !Array.isArray(json.messages)) {
        throw new Error('Missing or invalid messages array')
      }

      if (json.messages.length === 0) {
        throw new Error('No messages found in session')
      }

      // Validate at least one message has required fields
      const validMessage = json.messages.some(
        (m: any) => m.id && m.timestamp && m.type && m.content
      )

      if (!validMessage) {
        throw new Error('No valid messages found with required fields')
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid Gemini session format: ${error.message}`)
      }
      throw new Error('Invalid Gemini session format')
    }
  }

  /**
   * Override parent validation to handle JSONL format
   */
  protected validateJsonContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('No valid lines found in content')
    }

    // Validate that we have at least some valid JSON lines
    let validJsonLines = 0
    let hasGeminiRaw = false

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        validJsonLines++

        // Check for gemini_raw field (indicates Gemini JSONL format)
        if (parsed.gemini_raw) {
          hasGeminiRaw = true
        }
      } catch {
        // Skip invalid JSON lines
        continue
      }
    }

    if (validJsonLines === 0) {
      throw new Error('No valid JSON lines found in JSONL content')
    }

    if (!hasGeminiRaw) {
      throw new Error('No gemini_raw fields found - not a Gemini JSONL file')
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
