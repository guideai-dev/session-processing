/**
 * Shared utilities for processing todos
 */

import type { EnrichedTodoItem, TodoItem, TodoListGroup, TodoUpdate } from './types.js'

/**
 * Simple hash function for creating unique IDs
 */
export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Create a unique ID for a todo list based on its first item only
 * This allows lists to grow/shrink while still being recognized as the same list
 * The first item never changes, but subsequent items often do
 */
export function getTodoListId(todos: TodoItem[]): string {
  if (todos.length === 0) return 'empty'

  // Use only the first item to identify the list
  // This way, lists that differ in any other items are still grouped together
  return simpleHash(todos[0].content)
}

/**
 * Enrich todos with timing info by searching through ALL session updates
 */
export function enrichTodosWithTiming(
  latestUpdate: TodoUpdate,
  allUpdates: TodoUpdate[]
): EnrichedTodoItem[] {
  const enrichedTodos: EnrichedTodoItem[] = []

  // For each todo in the latest version, track its timing across ALL updates in the entire session
  for (const latestTodo of latestUpdate.todos) {
    let startTime: string | undefined
    let endTime: string | undefined

    // Search through ALL updates chronologically to find status changes for THIS specific todo
    for (const update of allUpdates) {
      // Find this todo in the current update by matching content
      const todoInUpdate = update.todos.find(t => t.content === latestTodo.content)

      if (!todoInUpdate) continue

      // Record when it first became in_progress
      if (todoInUpdate.status === 'in_progress' && !startTime) {
        startTime = update.timestamp
      }

      // Record when it completed
      if (todoInUpdate.status === 'completed' && !endTime) {
        endTime = update.timestamp
      }
    }

    // Calculate duration if both times exist
    const durationMs = startTime && endTime
      ? new Date(endTime).getTime() - new Date(startTime).getTime()
      : undefined

    enrichedTodos.push({
      ...latestTodo,
      startTime,
      endTime,
      durationMs,
    })
  }

  return enrichedTodos
}

/**
 * Find unique todo lists, keeping only the LATEST occurrence of each
 */
export function groupTodoLists(allUpdates: TodoUpdate[]): TodoListGroup[] {
  // Map of list ID -> latest update with that ID
  const latestByListId = new Map<string, { update: TodoUpdate; allMatches: TodoUpdate[] }>()

  // Process chronologically - later updates overwrite earlier ones
  for (const update of allUpdates) {
    const listId = getTodoListId(update.todos)

    if (!latestByListId.has(listId)) {
      latestByListId.set(listId, { update, allMatches: [update] })
    } else {
      const existing = latestByListId.get(listId)!
      existing.allMatches.push(update)
      existing.update = update // Keep the latest one
    }
  }

  // Convert to TodoListGroup array
  const groups: TodoListGroup[] = []
  for (const [id, { update: latestUpdate, allMatches }] of latestByListId.entries()) {
    // Enrich todos with timing info from ALL updates (not just this list's updates)
    const enrichedTodos = enrichTodosWithTiming(latestUpdate, allUpdates)

    groups.push({
      id,
      updates: allMatches, // All updates for this specific list
      latestUpdate,
      enrichedTodos,
      firstSeen: allMatches[0].timestamp,
      lastSeen: latestUpdate.timestamp,
    })
  }

  // Sort by last seen (most recent first when showing all)
  return groups.sort((a, b) =>
    new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  )
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}
