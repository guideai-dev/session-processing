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
      // A Gemini session is a single JSON object, not JSONL
      if (content.includes('\n')) {
        console.log('Gemini canProcess: rejecting content with newlines');
        return false
      }

      const data = JSON.parse(content)
      console.log('Gemini canProcess: parsed data', !!data);

      // Check for top-level fields
      if (!data.sessionId || !data.projectHash || !data.messages) {
        console.log(
          'Gemini canProcess: missing top-level fields',
          !!data.sessionId,
          !!data.projectHash,
          !!data.messages
        );
        return false
      }

      // Check for Gemini-specific fields within messages
      const hasGeminiFields = data.messages.some(
        (m: any) => m.thoughts || m.tokens
      )
      console.log('Gemini canProcess: hasGeminiFields', hasGeminiFields);

      return hasGeminiFields
    } catch (error) {
      console.error('Gemini canProcess: error', error);
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
   * Override parent validation to handle JSON format
   */
  protected validateJsonContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

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

      const hasGeminiFields = json.messages.some(
        (m: any) => m.thoughts || m.tokens
      )

      if (!hasGeminiFields) {
        throw new Error('No Gemini-specific fields found in messages')
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format')
      }
      if (error instanceof Error) {
        throw new Error(`Invalid Gemini session format: ${error.message}`)
      }
      throw new Error('Invalid Gemini session format')
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
