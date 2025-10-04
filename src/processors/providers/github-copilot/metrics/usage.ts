import { BaseMetricProcessor } from '../../../base/metric-processor.js'
import type { ParsedSession } from '../../../base/types.js'
import type { UsageMetrics } from '@guideai-dev/types'
import { GitHubCopilotParser } from '../parser.js'

export class CopilotUsageProcessor extends BaseMetricProcessor {
  readonly name = 'usage'
  readonly metricType = 'usage' as const
  readonly description = 'Measures Read/Write ratio and input clarity for AI usage efficiency'

  private parser = new GitHubCopilotParser()

  async process(session: ParsedSession): Promise<UsageMetrics> {
    const toolUses = this.parser.extractToolUses(session)
    const userMessages = session.messages.filter(m => m.type === 'user')

    // Calculate Read/Write ratio (key metric for efficiency)
    // Copilot uses str_replace_editor for both reading and writing
    // bash can be either read or write depending on the command
    const readCount = this.countReadOperations(toolUses)
    const writeCount = this.countWriteOperations(toolUses)

    const readWriteRatio = writeCount > 0 ? Number((readCount / writeCount).toFixed(2)) : readCount

    // Calculate tool diversity (variety of tools used)
    const uniqueTools = new Set(toolUses.map(t => t.name))
    const toolDiversity = uniqueTools.size

    // Calculate bash command count
    const bashCommands = toolUses.filter(t => t.name === 'bash')
    const bashCommandCount = bashCommands.length

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
        improvement_tips: this.generateImprovementTips(readWriteRatio, inputClarityScore, toolDiversity),
        // Extra fields for analysis
        tool_diversity: toolDiversity,
        bash_command_count: bashCommandCount,
        unique_tools: Array.from(uniqueTools)
      } as any
    }
  }

  /**
   * Count read operations from Copilot tools
   * - str_replace_editor with "view" command
   * - bash with read-like commands (cat, grep, find, ls, etc.)
   */
  private countReadOperations(toolUses: any[]): number {
    let count = 0

    for (const tool of toolUses) {
      if (tool.name === 'str_replace_editor' && tool.input?.command === 'view') {
        count++
      } else if (tool.name === 'bash') {
        // Check if bash command is a read operation
        const command = tool.input?.command || ''
        const readCommands = ['cat', 'grep', 'find', 'ls', 'head', 'tail', 'less', 'more', 'git diff', 'git log', 'git status']
        if (readCommands.some(cmd => command.trim().startsWith(cmd))) {
          count++
        }
      }
    }

    return count
  }

  /**
   * Count write operations from Copilot tools
   * - str_replace_editor with "str_replace", "create", "insert" commands
   * - bash with write-like commands (echo, sed, awk, etc.)
   */
  private countWriteOperations(toolUses: any[]): number {
    let count = 0

    for (const tool of toolUses) {
      if (tool.name === 'str_replace_editor') {
        const command = tool.input?.command || ''
        const writeCommands = ['str_replace', 'create', 'insert', 'write']
        if (writeCommands.includes(command)) {
          count++
        }
      } else if (tool.name === 'bash') {
        // Check if bash command is a write operation
        const command = tool.input?.command || ''
        const writeCommands = ['echo', 'sed', 'awk', 'tee', 'git add', 'git commit', 'git push', 'npm install', 'pnpm install', 'yarn add']
        if (writeCommands.some(cmd => command.trim().startsWith(cmd)) || command.includes('>')) {
          count++
        }
      }
    }

    return count
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

  private generateImprovementTips(readWriteRatio: number, inputClarityScore: number, toolDiversity: number): string[] {
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

    if (toolDiversity > 5) {
      tips.push("High tool diversity shows AI is exploring multiple approaches")
    }

    if (toolDiversity === 1) {
      tips.push("Low tool diversity - task may have been very straightforward or too narrow")
    }

    return tips
  }
}
