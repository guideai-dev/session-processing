/**
 * Claude Code Todo Extractor - Extracts todos from TodoWrite tool
 */

import type { TodoExtractor, TodoItem, TodoUpdate } from './types.js'

export class ClaudeCodeTodoExtractor implements TodoExtractor {
  readonly providerName = 'claude-code'

  extractTodos(fileContent: string): TodoUpdate[] {
    if (!fileContent) return []

    const updates: TodoUpdate[] = []
    const lines = fileContent.split('\n').filter(l => l.trim())

    let messageIndex = 0
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        messageIndex++

        // Look for assistant messages with TodoWrite tool use
        if (entry.type === 'assistant' && entry.message?.content) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use' && block.name === 'TodoWrite' && block.input?.todos) {
              updates.push({
                id: block.id,
                timestamp: entry.timestamp,
                todos: block.input.todos as TodoItem[],
                messageIndex,
              })
            }
          }
        }
      } catch {
        // Skip invalid lines
      }
    }

    return updates
  }
}
