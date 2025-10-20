import type { ParsedMessage, UsageMetrics } from '@guideai-dev/types'
import { extractTextFromMessage, isStructuredMessageContent } from '@guideai-dev/types'
import { BaseMetricProcessor } from '../../../base/index.js'
import type { ParsedSession } from '../../../base/types.js'
import { GeminiParser } from '../parser.js'

export class GeminiUsageProcessor extends BaseMetricProcessor {
  readonly name = 'gemini-usage'
  readonly metricType = 'usage'
  readonly description =
    'Analyzes token usage patterns including cache efficiency and thinking overhead'

  private parser = new GeminiParser()

  async process(session: ParsedSession): Promise<UsageMetrics> {
    const tokenStats = this.parser.calculateTotalTokens(session)
    const _thinkingAnalysis = this.parser.analyzeThinking(session)

    // Calculate message-level statistics
    const messagesWithTokens = session.messages.filter(m => m.metadata?.tokens)
    const _assistantMessages = session.messages.filter(m => m.type === 'assistant')
    const userMessages = session.messages.filter(m => m.type === 'user')

    const avgInputTokens =
      messagesWithTokens.length > 0 ? tokenStats.totalInput / messagesWithTokens.length : 0

    const avgOutputTokens =
      messagesWithTokens.length > 0 ? tokenStats.totalOutput / messagesWithTokens.length : 0

    const _avgCachedTokens =
      messagesWithTokens.length > 0 ? tokenStats.totalCached / messagesWithTokens.length : 0

    const _avgThinkingTokens =
      messagesWithTokens.length > 0 ? tokenStats.totalThoughts / messagesWithTokens.length : 0

    // Calculate cache efficiency score (0-100)
    const cacheEfficiencyScore = Math.min(100, tokenStats.cacheHitRate * 100)

    // Calculate thinking efficiency (lower overhead is better)
    const thinkingEfficiencyScore =
      tokenStats.thinkingOverhead > 0 ? Math.max(0, 100 - tokenStats.thinkingOverhead * 100) : 100

    // Overall token efficiency (combination of cache usage and low thinking overhead)
    const overallEfficiency = cacheEfficiencyScore * 0.6 + thinkingEfficiencyScore * 0.4

    // Extract tools from Gemini format
    const tools = this.extractTools(session)
    const readOps = tools.filter(t =>
      ['read', 'search', 'list'].some(op => t.name.toLowerCase().includes(op))
    ).length
    const writeOps = tools.filter(t =>
      ['write', 'edit', 'create', 'update', 'delete'].some(op => t.name.toLowerCase().includes(op))
    ).length

    // Calculate read/write ratio (Gemini equivalent)
    const readWriteRatio = writeOps > 0 ? Number((readOps / writeOps).toFixed(2)) : readOps

    // Calculate input clarity based on message length and detail
    const inputClarityScore = this.calculateInputClarityScore(userMessages)

    // Calculate total lines read from tool results (for git diff efficiency ratios)
    const totalLinesRead = this.calculateLinesRead(tools, session)

    // Return metrics matching UsageMetrics interface
    const metrics = {
      // Required UsageMetrics fields
      read_write_ratio: readWriteRatio,
      input_clarity_score: inputClarityScore,

      // Additional metadata for Gemini-specific insights
      metadata: {
        read_operations: readOps,
        write_operations: writeOps,
        total_user_messages: userMessages.length,
        total_lines_read: totalLinesRead, // For git diff ratios
        improvement_tips: this.generateImprovementTips(readWriteRatio, inputClarityScore),

        // Gemini-specific token metrics
        total_tokens: tokenStats.total,
        total_input_tokens: tokenStats.totalInput,
        total_output_tokens: tokenStats.totalOutput,
        total_cached_tokens: tokenStats.totalCached,
        total_thinking_tokens: tokenStats.totalThoughts,
        cache_hit_rate: tokenStats.cacheHitRate,
        thinking_overhead: tokenStats.thinkingOverhead,
        avg_input_tokens: avgInputTokens,
        avg_output_tokens: avgOutputTokens,
        cache_efficiency_score: cacheEfficiencyScore,
        overall_token_efficiency: overallEfficiency,
      },
    }

    return metrics
  }

  private extractTools(session: ParsedSession): Array<{ name: string; timestamp: Date }> {
    const tools: Array<{ name: string; timestamp: Date }> = []

    for (const message of session.messages) {
      // Extract from content.toolUses (new JSONL format)
      if (isStructuredMessageContent(message.content)) {
        for (const tool of message.content.toolUses) {
          tools.push({ name: tool.name || 'unknown', timestamp: message.timestamp })
        }
        // Tool results are tracked but don't have names
      }
    }

    return tools
  }

  private calculateInputClarityScore(userMessages: ParsedMessage[]): number {
    if (userMessages.length === 0) return 0

    let totalScore = 0
    let totalWords = 0

    for (const message of userMessages) {
      const content = extractTextFromMessage(message)
      const words = content.split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length

      // Count technical indicators
      const technicalTerms = this.countTechnicalTerms(content)
      const codeSnippets = this.countCodeSnippets(content)
      const fileReferences = this.countFileReferences(content)

      const messageScore = technicalTerms + codeSnippets * 2 + fileReferences
      totalScore += messageScore
    }

    const clarityScore = totalWords > 0 ? Math.round((totalScore / totalWords) * 100) : 0
    return Math.min(clarityScore, 100)
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
    ]

    const contentLower = content.toLowerCase()
    return technicalKeywords.filter(keyword => contentLower.includes(keyword)).length
  }

  private countCodeSnippets(content: string): number {
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length
    const inlineCode = (content.match(/`[^`\n]+`/g) || []).length
    return codeBlocks + inlineCode
  }

  private countFileReferences(content: string): number {
    const fileExtensions = /\.\w{1,4}(\s|$|[^\w])/g
    const pathPatterns = /[\/\\][\w\-\.\/\\]+/g

    const extensions = (content.match(fileExtensions) || []).length
    const paths = (content.match(pathPatterns) || []).length

    return extensions + paths
  }

  private generateImprovementTips(readWriteRatio: number, inputClarityScore: number): string[] {
    const tips: string[] = []

    if (readWriteRatio > 5) {
      tips.push('High Read/Write ratio - consider providing specific file paths upfront')
    }

    if (readWriteRatio <= 2) {
      tips.push('Excellent efficiency! Model found and modified files quickly')
    }

    if (inputClarityScore < 20) {
      tips.push('Low input clarity - try including more technical details and code examples')
    }

    if (inputClarityScore > 50) {
      tips.push('Great technical communication! Clear inputs lead to better results')
    }

    return tips
  }

  private calculateLinesRead(
    _tools: Array<{ name: string; timestamp: Date }>,
    session: ParsedSession
  ): number {
    let total = 0

    // Extract from content.toolResults (new JSONL format)
    for (const message of session.messages) {
      if (isStructuredMessageContent(message.content)) {
        for (const result of message.content.toolResults) {
          const content = result.content
          if (typeof content === 'string') {
            total += content.split('\n').filter((l: string) => l.trim()).length
          }
        }
      }
    }

    return total
  }
}
