import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { UsageMetrics } from '@guideai/types'
import { ClaudeCodeParser } from '../parser.js'

export class ClaudeUsageProcessor extends BaseMetricProcessor {
  readonly name = 'usage'
  readonly metricType = 'usage' as const
  readonly description = 'Measures Read/Write ratio and input clarity for AI usage efficiency'

  private parser = new ClaudeCodeParser()

  async process(session: ParsedSession): Promise<UsageMetrics> {
    const toolUses = this.parser.extractToolUses(session)
    const userMessages = session.messages.filter(m => m.type === 'user')

    // Calculate Read/Write ratio (key metric for efficiency)
    const readTools = ['Read', 'Grep', 'Glob', 'BashOutput'] // Tools that consume information
    const writeTools = ['Write', 'Edit'] // Tools that produce changes

    const readCount = toolUses.filter(tool => readTools.includes(tool.name)).length
    const writeCount = toolUses.filter(tool => writeTools.includes(tool.name)).length

    const readWriteRatio = writeCount > 0 ? Number((readCount / writeCount).toFixed(2)) : readCount

    // Calculate input clarity score (how technical and specific user inputs are)
    const inputClarityScore = this.calculateInputClarityScore(userMessages)

    return {
      read_write_ratio: readWriteRatio,
      input_clarity_score: inputClarityScore,

      // Additional context for improvement guidance
      metadata: {
        read_operations: readCount,
        write_operations: writeCount,
        total_user_messages: userMessages.length,
        improvement_tips: this.generateImprovementTips(readWriteRatio, inputClarityScore)
      }
    }
  }

  private calculateInputClarityScore(userMessages: any[]): number {
    if (userMessages.length === 0) return 0

    let totalScore = 0
    let totalWords = 0

    for (const message of userMessages) {
      const content = this.extractContent(message)
      const words = content.split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length

      // Count technical terms
      const technicalTerms = this.countTechnicalTerms(content)

      // Count code snippets (inline code and code blocks)
      const codeSnippets = this.countCodeSnippets(content)

      // Count file references (paths, extensions)
      const fileReferences = this.countFileReferences(content)

      // Score based on technical content density
      const messageScore = technicalTerms + (codeSnippets * 2) + fileReferences
      totalScore += messageScore
    }

    // Return as percentage of technical content
    const clarityScore = totalWords > 0 ? Math.round((totalScore / totalWords) * 100) : 0
    return Math.min(clarityScore, 100) // Cap at 100%
  }

  private countTechnicalTerms(content: string): number {
    const technicalKeywords = [
      'function', 'variable', 'class', 'method', 'api', 'database', 'query',
      'component', 'interface', 'type', 'import', 'export', 'async', 'await',
      'typescript', 'javascript', 'react', 'node', 'npm', 'pnpm', 'package',
      'schema', 'table', 'column', 'index', 'migration', 'build', 'test',
      'lint', 'format', 'deploy', 'server', 'client', 'frontend', 'backend'
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
      tips.push("Include relevant code context in your requests to reduce searching")
    }

    if (readWriteRatio <= 2) {
      tips.push("Excellent efficiency! AI found and modified files quickly")
    }

    if (inputClarityScore < 20) {
      tips.push("Low input clarity - try including more technical details and code examples")
      tips.push("Specify exact file paths and function names for better results")
    }

    if (inputClarityScore > 50) {
      tips.push("Great technical communication! Clear, specific inputs lead to better results")
    }

    return tips
  }
}
