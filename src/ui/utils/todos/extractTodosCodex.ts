/**
 * Codex Todo Extractor - Extracts todos from update_plan tool
 */

import type { TodoExtractor, TodoItem, TodoUpdate } from './types.js'

interface CodexPlanItem {
  status: 'pending' | 'in_progress' | 'completed'
  step: string
}

interface CodexPlan {
  plan: CodexPlanItem[]
}

export class CodexTodoExtractor implements TodoExtractor {
  readonly providerName = 'codex'

  extractTodos(fileContent: string): TodoUpdate[] {
    if (!fileContent) return []

    const updates: TodoUpdate[] = []
    const lines = fileContent.split('\n').filter(l => l.trim())

    let messageIndex = 0
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        messageIndex++

        // Look for response_item with function_call type and update_plan name
        if (
          entry.type === 'response_item' &&
          entry.payload?.type === 'function_call' &&
          entry.payload?.name === 'update_plan' &&
          entry.payload?.arguments
        ) {
          const args = this.parseArguments(entry.payload.arguments)
          if (args?.plan && Array.isArray(args.plan)) {
            updates.push({
              id: entry.payload.call_id || `${messageIndex}`,
              timestamp: entry.timestamp,
              todos: this.mapCodexPlanToTodos(args.plan),
              messageIndex,
            })
          }
        }
      } catch {
        // Skip invalid lines
      }
    }

    return updates
  }

  /**
   * Parse JSON arguments from string or return as-is if already an object
   */
  private parseArguments(args: string | Record<string, unknown>): CodexPlan | null {
    try {
      if (typeof args === 'string') {
        const parsed = JSON.parse(args) as unknown
        return this.isCodexPlan(parsed) ? parsed : null
      }
      return this.isCodexPlan(args) ? args : null
    } catch {
      return null
    }
  }

  /**
   * Type guard for CodexPlan
   */
  private isCodexPlan(value: unknown): value is CodexPlan {
    return (
      typeof value === 'object' &&
      value !== null &&
      'plan' in value &&
      Array.isArray((value as Record<string, unknown>).plan)
    )
  }

  /**
   * Map Codex plan items to TodoItem format
   */
  private mapCodexPlanToTodos(plan: CodexPlanItem[]): TodoItem[] {
    return plan.map(item => ({
      content: item.step,
      status: item.status,
      activeForm: this.generateActiveForm(item.step),
    }))
  }

  /**
   * Generate present continuous form from imperative step
   * Examples:
   * - "Inspect existing tests" → "Inspecting existing tests"
   * - "Assess test quality" → "Assessing test quality"
   * - "Summarize findings" → "Summarizing findings"
   */
  private generateActiveForm(step: string): string {
    // Common verb mappings
    const verbMappings: Record<string, string> = {
      'Inspect': 'Inspecting',
      'Assess': 'Assessing',
      'Summarize': 'Summarizing',
      'Analyze': 'Analyzing',
      'Create': 'Creating',
      'Update': 'Updating',
      'Fix': 'Fixing',
      'Implement': 'Implementing',
      'Design': 'Designing',
      'Test': 'Testing',
      'Build': 'Building',
      'Review': 'Reviewing',
      'Refactor': 'Refactoring',
      'Add': 'Adding',
      'Remove': 'Removing',
      'Modify': 'Modifying',
      'Write': 'Writing',
      'Read': 'Reading',
      'Parse': 'Parsing',
      'Validate': 'Validating',
      'Generate': 'Generating',
      'Configure': 'Configuring',
      'Install': 'Installing',
      'Deploy': 'Deploying',
      'Run': 'Running',
      'Execute': 'Executing',
      'Check': 'Checking',
      'Verify': 'Verifying',
      'Debug': 'Debugging',
      'Optimize': 'Optimizing',
      'Migrate': 'Migrating',
      'Convert': 'Converting',
      'Extract': 'Extracting',
      'Merge': 'Merging',
      'Split': 'Splitting',
      'Combine': 'Combining',
      'Format': 'Formatting',
      'Clean': 'Cleaning',
      'Archive': 'Archiving',
      'Restore': 'Restoring',
      'Backup': 'Backing up',
      'Sync': 'Syncing',
      'Load': 'Loading',
      'Save': 'Saving',
      'Delete': 'Deleting',
      'Fetch': 'Fetching',
      'Send': 'Sending',
      'Receive': 'Receiving',
      'Process': 'Processing',
      'Transform': 'Transforming',
      'Compile': 'Compiling',
      'Link': 'Linking',
      'Package': 'Packaging',
      'Publish': 'Publishing',
      'Download': 'Downloading',
      'Upload': 'Uploading',
    }

    // Find first word (verb)
    const words = step.split(' ')
    const firstWord = words[0]

    if (firstWord && verbMappings[firstWord]) {
      return verbMappings[firstWord] + step.slice(firstWord.length)
    }

    // Fallback: just add "ing" to first word if possible
    if (firstWord && firstWord.length > 3) {
      const lowerFirst = firstWord.toLowerCase()
      // Simple heuristic: add "ing" or "ing" with doubled consonant
      if (lowerFirst.endsWith('e')) {
        return firstWord.slice(0, -1) + 'ing' + step.slice(firstWord.length)
      }
      return firstWord + 'ing' + step.slice(firstWord.length)
    }

    // Ultimate fallback
    return step
  }
}
