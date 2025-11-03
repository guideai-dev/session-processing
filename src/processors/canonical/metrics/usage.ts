/**
 * Unified Usage Metrics Processor
 *
 * Works for all providers using the canonical format.
 * Measures Read/Write ratio and input clarity.
 */

import type { ToolResultContent, ToolUseContent, UsageMetrics } from '@guideai-dev/types'
import { isStructuredMessageContent } from '@guideai-dev/types'
import type { ParsedMessage, ParsedSession } from '../../../parsers/base/types.js'
import { BaseMetricProcessor } from '../../base/metric-processor.js'

export class CanonicalUsageProcessor extends BaseMetricProcessor {
  readonly name = 'canonical-usage'
  readonly metricType = 'usage' as const
  readonly description = 'Measures Read/Write ratio and input clarity (unified for all providers)'

  async process(session: ParsedSession): Promise<UsageMetrics> {
    const toolUses = this.extractToolUses(session)
    const toolResults = this.extractToolResults(session)
    const userMessages = session.messages.filter(m => m.type === 'user')

    // Calculate Read/Write ratio
    const readTools = ['Read', 'Grep', 'Glob', 'BashOutput']
    const writeTools = ['Write', 'Edit']

    const readCount = toolUses.filter(tool => readTools.includes(tool.name)).length
    const writeCount = toolUses.filter(tool => writeTools.includes(tool.name)).length

    const readWriteRatio = writeCount > 0 ? Number((readCount / writeCount).toFixed(2)) : readCount

    // Calculate input clarity score
    const inputClarityScore = this.calculateInputClarityScore(userMessages)

    // Calculate total lines read
    const totalLinesRead = this.calculateLinesRead(toolUses, toolResults)

    return {
      read_write_ratio: readWriteRatio,
      input_clarity_score: inputClarityScore,
      metadata: {
        read_operations: readCount,
        write_operations: writeCount,
        total_user_messages: userMessages.length,
        total_lines_read: totalLinesRead,
        improvement_tips: this.generateImprovementTips(readWriteRatio, inputClarityScore),
      },
    }
  }

  /**
   * Extract tool uses from session
   */
  private extractToolUses(session: ParsedSession): ToolUseContent[] {
    const toolUses: ToolUseContent[] = []

    for (const message of session.messages) {
      if (isStructuredMessageContent(message.content) && message.content.toolUse) {
        toolUses.push(message.content.toolUse)
      }
    }

    return toolUses
  }

  /**
   * Extract tool results from session
   */
  private extractToolResults(session: ParsedSession): ToolResultContent[] {
    const toolResults: ToolResultContent[] = []

    for (const message of session.messages) {
      if (isStructuredMessageContent(message.content) && message.content.toolResult) {
        toolResults.push(message.content.toolResult)
      }
    }

    return toolResults
  }

  /**
   * Calculate input clarity score based on technical content
   */
  private calculateInputClarityScore(userMessages: ParsedMessage[]): number {
    if (userMessages.length === 0) return 0

    let totalScore = 0
    let totalWords = 0

    for (const message of userMessages) {
      const content = this.extractTextContent(message)
      const words = content.split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length

      // Count technical indicators
      const technicalTerms = this.countTechnicalTerms(content)
      const codeSnippets = this.countCodeSnippets(content)
      const fileReferences = this.countFileReferences(content)

      // Weighted score
      const messageScore = technicalTerms + codeSnippets * 2 + fileReferences
      totalScore += messageScore
    }

    // Return as percentage
    const clarityScore = totalWords > 0 ? Math.round((totalScore / totalWords) * 100) : 0
    return Math.min(clarityScore, 100)
  }

  /**
   * Extract text content from message
   */
  private extractTextContent(message: ParsedMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    if (message.content.text) {
      return message.content.text
    }

    return ''
  }

  /**
   * Count technical keywords in content
   */
  private countTechnicalTerms(content: string): number {
    const technicalKeywords = [
      'function',
      'variable',
      'class',
      'method',
      'api',
      'database',
      'query',
      'component',
      'interface',
      'type',
      'import',
      'export',
      'async',
      'await',
      'typescript',
      'javascript',
      'react',
      'node',
      'npm',
      'pnpm',
      'package',
      'schema',
      'table',
      'column',
      'index',
      'migration',
      'build',
      'test',
      'lint',
      'format',
      'server',
      'client',
    ]

    const contentLower = content.toLowerCase()
    return technicalKeywords.filter(keyword => contentLower.includes(keyword)).length
  }

  /**
   * Count code snippets in content
   */
  private countCodeSnippets(content: string): number {
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length
    const inlineCode = (content.match(/`[^`\n]+`/g) || []).length
    return codeBlocks + inlineCode
  }

  /**
   * Count file references in content
   */
  private countFileReferences(content: string): number {
    const fileExtensions = /\.\w{1,4}(\s|$|[^\w])/g
    const pathPatterns = /[\/\\][\w\-\.\/\\]+/g

    const extensions = (content.match(fileExtensions) || []).length
    const paths = (content.match(pathPatterns) || []).length

    return extensions + paths
  }

  /**
   * Calculate total lines read from tool results
   */
  private calculateLinesRead(toolUses: ToolUseContent[], toolResults: ToolResultContent[]): number {
    let total = 0

    // Map tool uses to results
    const resultMap = new Map<string, ToolResultContent>()
    for (const result of toolResults) {
      if (result.tool_use_id) {
        resultMap.set(result.tool_use_id, result)
      }
    }

    for (const tool of toolUses) {
      const result = resultMap.get(tool.id)
      if (!result || !result.content) continue

      // Count lines for read operations
      if (tool.name === 'Read' || tool.name === 'Grep' || tool.name === 'Glob') {
        const content =
          typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        const lines = content.split('\n').filter(l => l.trim()).length
        total += lines
      }
    }

    return total
  }

  /**
   * Generate improvement tips
   */
  private generateImprovementTips(readWriteRatio: number, inputClarityScore: number): string[] {
    const tips: string[] = []

    if (readWriteRatio > 5) {
      tips.push(
        'High Read/Write ratio suggests AI is searching - provide specific file paths upfront'
      )
      tips.push('Include relevant code context in your requests to reduce exploration')
    }

    if (readWriteRatio <= 2) {
      tips.push('Excellent efficiency! AI found and modified files quickly')
    }

    if (inputClarityScore < 20) {
      tips.push('Low input clarity - try including more technical details and code examples')
      tips.push('Specify exact file paths and function names for better results')
    }

    if (inputClarityScore > 50) {
      tips.push('Great technical communication! Clear, specific inputs lead to better results')
    }

    return tips
  }
}
