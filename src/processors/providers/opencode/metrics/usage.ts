import type {
  ParsedMessage,
  ToolResultContent,
  ToolUseContent,
  UsageMetrics,
} from '@guideai-dev/types'
import { extractTextFromMessage, getUserMessages } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import * as helpers from './../helpers.js'

export class OpenCodeUsageProcessor extends BaseMetricProcessor {
  readonly name = 'usage'
  readonly metricType = 'usage' as const
  readonly description = 'Measures Read/Write ratio and input clarity for AI usage efficiency'

  async process(session: ParsedSession): Promise<UsageMetrics> {
    const toolUses = helpers.extractToolUses(session)
    const userMessages = session.messages.filter(m => m.type === 'user_input')

    // Calculate Read/Write ratio (key metric for efficiency)
    const readTools = ['Read', 'Grep', 'Glob', 'BashOutput'] // Tools that consume information
    const writeTools = ['Write', 'Edit'] // Tools that produce changes

    const readCount = toolUses.filter(tool => readTools.includes(tool.name)).length
    const writeCount = toolUses.filter(tool => writeTools.includes(tool.name)).length

    const readWriteRatio = writeCount > 0 ? Number((readCount / writeCount).toFixed(2)) : readCount

    // Calculate input clarity score (how technical and specific user inputs are)
    const inputClarityScore = this.calculateInputClarityScore(userMessages)

    // Calculate total lines read from actual tool results (for git diff efficiency ratios)
    const toolResults = helpers.extractToolResults(session)
    const totalLinesRead = this.calculateLinesRead(toolUses, toolResults)

    return {
      read_write_ratio: readWriteRatio,
      input_clarity_score: inputClarityScore,

      // Additional context for improvement guidance
      metadata: {
        read_operations: readCount,
        write_operations: writeCount,
        total_user_messages: userMessages.length,
        total_lines_read: totalLinesRead, // For git diff ratios
        improvement_tips: this.generateImprovementTips(readWriteRatio, inputClarityScore),
      },
    }
  }

  private calculateInputClarityScore(userMessages: ParsedMessage[]): number {
    if (userMessages.length === 0) return 0

    let totalScore = 0
    let totalWords = 0

    for (const message of userMessages) {
      const content = extractTextFromMessage(message)
      const words = content.split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length

      // Count technical terms
      const technicalTerms = this.countTechnicalTerms(content)

      // Count code snippets (inline code and code blocks)
      const codeSnippets = this.countCodeSnippets(content)

      // Count file references (paths, extensions)
      const fileReferences = this.countFileReferences(content)

      // Score based on technical content density
      const messageScore = technicalTerms + codeSnippets * 2 + fileReferences
      totalScore += messageScore
    }

    // Return as percentage of technical content
    const clarityScore = totalWords > 0 ? Math.round((totalScore / totalWords) * 100) : 0
    return Math.min(clarityScore, 100) // Cap at 100%
  }

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
      'deploy',
      'server',
      'client',
      'frontend',
      'backend',
    ]

    const contentLower = content.toLowerCase()
    return technicalKeywords.filter(keyword => contentLower.includes(keyword)).length
  }

  private countCodeSnippets(content: string): number {
    // Count code blocks (```) and inline code (`)
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length
    const inlineCode = (content.match(/`[^`\n]+`/g) || []).length
    return codeBlocks + inlineCode
  }

  private countFileReferences(content: string): number {
    // Count file paths and extensions
    const fileExtensions = /\.\w{1,4}(\s|$|[^\w])/g
    const pathPatterns = /[\/\\][\w\-\.\/\\]+/g

    const extensions = (content.match(fileExtensions) || []).length
    const paths = (content.match(pathPatterns) || []).length

    return extensions + paths
  }

  private generateImprovementTips(readWriteRatio: number, inputClarityScore: number): string[] {
    const tips: string[] = []

    if (readWriteRatio > 5) {
      tips.push("High Read/Write ratio suggests AI is 'lost' - provide specific file paths upfront")
      tips.push('Include relevant code context in your requests to reduce searching')
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

  private calculateLinesRead(toolUses: ToolUseContent[], toolResults: ToolResultContent[]): number {
    let total = 0

    // Map tool uses to their results by ID
    const resultMap = new Map()
    for (const result of toolResults) {
      if (result.tool_use_id) {
        resultMap.set(result.tool_use_id, result)
      }
    }

    for (const tool of toolUses) {
      const result = resultMap.get(tool.id)
      if (!result || !result.content) continue

      // Count actual lines in the result content
      if (tool.name === 'Read') {
        const content =
          typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        const lines = content.split('\n').length
        total += lines
      } else if (tool.name === 'Grep' || tool.name === 'Glob') {
        const content =
          typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        const lines = content.split('\n').filter((l: string) => l.trim()).length
        total += lines
      }
    }

    return total
  }
}
