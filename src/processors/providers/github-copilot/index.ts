import { CopilotParser } from '../../../parsers/index.js'
import { type BaseMetricProcessor, BaseProviderProcessor } from '../../base/index.js'

import { CopilotEngagementProcessor } from './metrics/engagement.js'
import { CopilotErrorProcessor } from './metrics/error.js'
// Import simplified metric processors
import { CopilotPerformanceProcessor } from './metrics/performance.js'
import { CopilotQualityProcessor } from './metrics/quality.js'
import { CopilotUsageProcessor } from './metrics/usage.js'

export class GitHubCopilotProcessor extends BaseProviderProcessor {
  readonly providerName = 'github-copilot'
  readonly description = 'Processes GitHub Copilot session logs with comprehensive metrics analysis'

  private parser = new CopilotParser()
  private metricProcessors: BaseMetricProcessor[]

  constructor() {
    super()

    // Initialize simplified metric processors
    this.metricProcessors = [
      new CopilotPerformanceProcessor(),
      new CopilotEngagementProcessor(),
      new CopilotQualityProcessor(),
      new CopilotUsageProcessor(),
      new CopilotErrorProcessor(),
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

      // Check if it looks like GitHub Copilot format by finding the first valid JSON line
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line)

          // GitHub Copilot messages have: type, timestamp, and id fields
          // Types include: user, copilot, tool_call_requested, tool_call_completed, info
          const hasCopilotFields =
            parsedLine.timestamp &&
            parsedLine.type &&
            (parsedLine.type === 'user' ||
              parsedLine.type === 'copilot' ||
              parsedLine.type === 'tool_call_requested' ||
              parsedLine.type === 'tool_call_completed' ||
              parsedLine.type === 'info')

          if (hasCopilotFields) {
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
   * Validate GitHub Copilot specific content format
   */
  protected validateCopilotFormat(content: string): void {
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      throw new Error('No content lines found')
    }

    // Find and validate a few actual message lines
    let validMessageLines = 0
    const targetValidLines = Math.min(3, lines.length)

    for (const line of lines) {
      try {
        const message = JSON.parse(line)

        // Check if this looks like a GitHub Copilot message
        // Valid types: user, copilot, tool_call_requested, tool_call_completed, info
        if (message.timestamp && message.type) {
          const validTypes = [
            'user',
            'copilot',
            'tool_call_requested',
            'tool_call_completed',
            'info',
          ]
          if (validTypes.includes(message.type)) {
            // Validate timestamp format
            const timestamp = new Date(message.timestamp)
            if (!Number.isNaN(timestamp.getTime())) {
              validMessageLines++
              if (validMessageLines >= targetValidLines) {
                break
              }
            }
          }
        }
      } catch (_parseError) {}
    }

    if (validMessageLines === 0) {
      throw new Error('No valid GitHub Copilot message lines found')
    }
  }

  /**
   * Override parent validation to include GitHub Copilot specific checks
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

    // Then run GitHub Copilot specific validation
    this.validateCopilotFormat(content)
  }
}

// Export individual processors for testing
export {
  CopilotPerformanceProcessor,
  CopilotEngagementProcessor,
  CopilotQualityProcessor,
  CopilotUsageProcessor,
  CopilotErrorProcessor,
}
