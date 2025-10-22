import { useEffect, useMemo, useState } from 'react'
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { ListBulletIcon } from '@heroicons/react/24/solid'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

interface TodoUpdate {
  id: string
  timestamp: string
  todos: TodoItem[]
  messageIndex: number
}

interface EnrichedTodoItem extends TodoItem {
  startTime?: string
  endTime?: string
  durationMs?: number
}

interface TodoListGroup {
  id: string // Hash of todo contents
  updates: TodoUpdate[]
  latestUpdate: TodoUpdate
  enrichedTodos: EnrichedTodoItem[]
  firstSeen: string
  lastSeen: string
}

interface SessionTodosTabProps {
  session: {
    sessionId: string
  }
  fileContent: string | null
}

function parseTodosFromSession(fileContent: string | null): TodoUpdate[] {
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

// Enrich todos with timing info by searching through ALL session updates
function enrichTodosWithTiming(
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

function formatDuration(ms: number): string {
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

// Simple hash function for creating unique IDs
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Create a unique ID for a todo list based on its first item only
// This allows lists to grow/shrink while still being recognized as the same list
// The first item never changes, but subsequent items often do
function getTodoListId(todos: TodoItem[]): string {
  if (todos.length === 0) return 'empty'

  // Use only the first item to identify the list
  // This way, lists that differ in any other items are still grouped together
  return simpleHash(todos[0].content)
}

// Find unique todo lists, keeping only the LATEST occurrence of each
function groupTodoLists(allUpdates: TodoUpdate[]): TodoListGroup[] {
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

export function SessionTodosTab({ fileContent }: SessionTodosTabProps) {
  const [showAll, setShowAll] = useState(() => {
    const saved = localStorage.getItem('sessionTodosShowAll')
    return saved !== null ? saved === 'true' : true // Default to true (show all)
  })
  const todoUpdates = useMemo(() => parseTodosFromSession(fileContent), [fileContent])

  // Group todo lists by content
  const todoGroups = useMemo(() => groupTodoLists(todoUpdates), [todoUpdates])

  // Get the latest group (most recent todo list) - groups are sorted most recent first
  const latestGroup = todoGroups.length > 0 ? todoGroups[0] : null

  // Save showAll preference to localStorage
  useEffect(() => {
    localStorage.setItem('sessionTodosShowAll', String(showAll))
  }, [showAll])

  // Calculate stats for the latest group (or all groups if showing all)
  const stats = useMemo(() => {
    const todos = showAll
      ? todoGroups.flatMap(g => g.enrichedTodos)
      : (latestGroup?.enrichedTodos || [])

    const total = todos.length
    const completed = todos.filter(t => t.status === 'completed').length
    const inProgress = todos.filter(t => t.status === 'in_progress').length
    const pending = todos.filter(t => t.status === 'pending').length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, inProgress, pending, percent }
  }, [todoGroups, latestGroup, showAll])

  // Empty state
  if (todoUpdates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-base-content/60">
        <ListBulletIcon className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No todos found</p>
        <p className="text-sm mt-1">This session didn't use TodoWrite tracking</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Stats Header */}
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="badge badge-lg gap-2">
                <CheckCircleIcon className="w-4 h-4" />
                {stats.completed} / {stats.total} completed
              </div>
              {stats.inProgress > 0 && (
                <div className="badge badge-primary badge-lg gap-2">
                  <ClockIcon className="w-4 h-4" />
                  {stats.inProgress} in progress
                </div>
              )}
              {stats.pending > 0 && (
                <div className="badge badge-ghost badge-lg">
                  {stats.pending} pending
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Show All / Latest Only Toggle */}
              {todoGroups.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className={`btn btn-sm ${!showAll ? 'btn-primary' : 'btn-ghost'}`}
                  title={showAll ? 'Show latest list only' : 'Show all todo lists'}
                >
                  {showAll ? 'Latest Only' : `All ${todoGroups.length} Lists`}
                </button>
              )}
              <progress
                className="progress progress-primary w-32"
                value={stats.percent}
                max="100"
              />
              <span className="text-sm font-medium text-base-content/70 min-w-[3rem] text-right">
                {stats.percent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Display todos */}
      {showAll ? (
        // Show all groups
        <div className="space-y-6">
          {todoGroups.map((group, groupIdx) => (
            <div key={group.id} className="space-y-2">
              {/* Group Header */}
              {todoGroups.length > 1 && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-base-content/70">
                    List {todoGroups.length - groupIdx}
                  </h3>
                  <div className="text-xs text-base-content/50">
                    {group.updates.length} update{group.updates.length > 1 ? 's' : ''} •
                    {new Date(group.firstSeen).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Todos in this group */}
              <div className="space-y-2">
                {group.enrichedTodos.map((todo, todoIdx) => (
                  <TodoCard
                    key={`${group.id}-${todoIdx}`}
                    todo={todo}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show only latest group
        latestGroup && (
          <div className="space-y-2">
            {latestGroup.enrichedTodos.map((todo, todoIdx) => (
              <TodoCard
                key={`${latestGroup.id}-${todoIdx}`}
                todo={todo}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

// Extracted TodoCard component for reuse
function TodoCard({ todo }: { todo: EnrichedTodoItem }) {
  const statusColors = {
    completed: 'bg-base-200 border-success',
    in_progress: 'bg-primary border-primary border-2',
    pending: 'bg-base-100 border-base-300',
  }

  const StatusIcon = {
    completed: CheckCircleIcon,
    in_progress: ClockIcon,
    pending: ListBulletIcon,
  }[todo.status]

  const iconColors = {
    completed: 'text-success',
    in_progress: 'text-primary-content',
    pending: 'text-base-content opacity-30',
  }

  const textColors = {
    completed: 'text-base-content opacity-60',
    in_progress: 'text-primary-content font-semibold',
    pending: 'text-base-content opacity-40',
  }

  return (
    <div className={`card border ${statusColors[todo.status]}`}>
      <div className="card-body p-3">
        <div className="flex items-start gap-3">
          <StatusIcon
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[todo.status]}`}
          />
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${textColors[todo.status]} ${
                todo.status === 'completed' ? 'line-through' : ''
              }`}
            >
              {todo.content}
            </p>
            {todo.status === 'in_progress' && (
              <p className="text-xs text-primary-content opacity-80 mt-1 italic font-medium">
                {todo.activeForm}
              </p>
            )}
            {todo.status === 'completed' && todo.durationMs && (
              <div className="flex items-center gap-2 mt-2 text-xs text-base-content opacity-50">
                <ClockIcon className="w-3 h-3" />
                <span>{formatDuration(todo.durationMs)}</span>
                {todo.startTime && (
                  <>
                    <span>•</span>
                    <span>
                      {new Date(todo.startTime).toLocaleTimeString()} → {new Date(todo.endTime!).toLocaleTimeString()}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            {todo.status === 'completed' && (
              <span className="badge badge-success badge-sm">Done</span>
            )}
            {todo.status === 'in_progress' && (
              <span className="badge badge-accent badge-sm font-semibold">Active</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
