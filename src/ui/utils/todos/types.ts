/**
 * Shared types for todo extraction across providers
 */

export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

export interface TodoUpdate {
  id: string
  timestamp: string
  todos: TodoItem[]
  messageIndex: number
}

export interface EnrichedTodoItem extends TodoItem {
  startTime?: string
  endTime?: string
  durationMs?: number
}

export interface TodoListGroup {
  id: string // Hash of todo contents
  updates: TodoUpdate[]
  latestUpdate: TodoUpdate
  enrichedTodos: EnrichedTodoItem[]
  firstSeen: string
  lastSeen: string
}

/**
 * Interface for provider-specific todo extractors
 */
export interface TodoExtractor {
  /**
   * Extract todo updates from session file content
   */
  extractTodos(fileContent: string): TodoUpdate[]

  /**
   * Provider name
   */
  readonly providerName: string
}
