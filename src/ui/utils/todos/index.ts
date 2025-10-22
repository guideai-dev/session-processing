/**
 * Todo extraction and processing utilities
 */

export * from './types.js'
export * from './extractTodosClaudeCode.js'
export * from './extractTodosCodex.js'
export * from './todoUtils.js'

import { ClaudeCodeTodoExtractor } from './extractTodosClaudeCode.js'
import { CodexTodoExtractor } from './extractTodosCodex.js'
import type { TodoExtractor, TodoUpdate } from './types.js'

/**
 * Registry of available todo extractors
 */
const extractors: TodoExtractor[] = [
  new ClaudeCodeTodoExtractor(),
  new CodexTodoExtractor(),
]

/**
 * Auto-detect provider and extract todos
 * Tries all extractors and returns results from the first one that finds todos
 */
export function extractTodosAuto(fileContent: string): TodoUpdate[] {
  if (!fileContent) return []

  // Try each extractor
  for (const extractor of extractors) {
    const todos = extractor.extractTodos(fileContent)
    if (todos.length > 0) {
      return todos
    }
  }

  return []
}

/**
 * Get extractor for specific provider
 */
export function getExtractorForProvider(providerName: string): TodoExtractor | null {
  return extractors.find(e => e.providerName === providerName) || null
}
