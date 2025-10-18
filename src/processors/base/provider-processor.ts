import type { BaseMetricProcessor } from './metric-processor.js'
import type { ParsedSession, ProcessorResult, ProcessorContext } from './types.js'

export abstract class BaseProviderProcessor {
  abstract readonly providerName: string
  abstract readonly description: string

  /**
   * Parse the raw JSONL content into a structured session object
   * Each provider implements this differently based on their log format
   */
  abstract parseSession(jsonlContent: string): ParsedSession

  /**
   * Get all metric processors for this provider
   * Each provider should return the same set of processors for consistency
   */
  abstract getMetricProcessors(): BaseMetricProcessor[]

  /**
   * Check if this processor can handle the given content
   * Default implementation just checks if content is valid JSON lines
   */
  canProcess(content: string): boolean {
    try {
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length === 0) return false

      // Try to parse first line as JSON to verify format
      JSON.parse(lines[0])
      return true
    } catch {
      return false
    }
  }

  /**
   * Process all metrics for a session
   * This orchestrates running all metric processors sequentially to ensure completion
   * Returns array of ProcessorResults - caller is responsible for storage
   */
  async processMetrics(
    jsonlContent: string,
    context: ProcessorContext
  ): Promise<ProcessorResult[]> {
    const session = this.parseSession(jsonlContent)
    const processors = this.getMetricProcessors()

    console.log(
      `Processing session ${context.sessionId} with ${processors.length} metric processors (SEQUENTIAL):`,
      processors.map(p => `${p.name} (${p.metricType})`).join(', ')
    )

    // Run all processors sequentially to ensure each completes before the next
    const successfulResults: ProcessorResult[] = []

    for (const processor of processors) {
      try {
        console.log(`→ Starting processor ${processor.name} (${processor.metricType})`)

        if (!processor.canProcess(session)) {
          console.warn(
            `  ⊘ Processor ${processor.name} cannot process session ${session.sessionId}`
          )
          continue
        }

        const result = await processor.processToResult(session)

        if (!result || !result.metrics) {
          console.warn(`  ⚠ Processor ${processor.name} returned empty/null result`)
          continue
        }

        const metricCount = Object.keys(result.metrics).length
        const nonNullMetrics = Object.entries(result.metrics).filter(
          ([k, v]) => v !== null && v !== undefined
        ).length

        console.log(
          `  ✓ Processor ${processor.name} completed: ${nonNullMetrics}/${metricCount} non-null metrics`
        )
        console.log(`    Metrics: ${JSON.stringify(result.metrics)}`)

        successfulResults.push(result)
      } catch (error) {
        console.error(`  ✗ Processor ${processor.name} FAILED with error:`, error)
        console.error(`    Error details:`, error instanceof Error ? error.stack : error)
      }
    }

    console.log(
      `✓ Completed ${successfulResults.length}/${processors.length} processors successfully`
    )

    if (successfulResults.length === 0) {
      console.error(`⚠ WARNING: NO processors succeeded for session ${context.sessionId}!`)
    }

    return successfulResults
  }

  /**
   * Validate JSONL content format
   */
  protected validateJsonlContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty')
    }

    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('No valid lines found in content')
    }

    // Validate first few lines as JSON
    const linesToCheck = Math.min(3, lines.length)
    for (let i = 0; i < linesToCheck; i++) {
      try {
        JSON.parse(lines[i])
      } catch (error) {
        throw new Error(`Invalid JSON on line ${i + 1}: ${lines[i]}`)
      }
    }
  }

  /**
   * Extract timestamps from raw message data
   * Helper method for providers to implement
   */
  protected parseTimestamp(timestampStr: string | undefined): Date | null {
    if (!timestampStr) return null

    try {
      const date = new Date(timestampStr)
      if (isNaN(date.getTime())) {
        console.warn(`Invalid timestamp: ${timestampStr}`)
        return null
      }
      return date
    } catch (error) {
      console.warn(`Failed to parse timestamp: ${timestampStr}`, error)
      return null
    }
  }

  /**
   * Calculate session duration from start and end times
   */
  protected calculateDuration(startTime: Date | null, endTime: Date | null): number {
    if (!startTime || !endTime) return 0
    return Math.max(0, endTime.getTime() - startTime.getTime())
  }

  /**
   * Generate a unique message ID if not provided
   */
  protected generateMessageId(index: number, timestamp?: Date): string {
    const time = timestamp ? timestamp.getTime() : Date.now()
    return `msg_${time}_${index}`
  }
}
