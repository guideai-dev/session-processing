import { useEffect, useMemo, useState } from 'react'
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { ListBulletIcon } from '@heroicons/react/24/solid'
import {
  extractTodosAuto,
  formatDuration,
  groupTodoLists,
  type EnrichedTodoItem,
  type TodoListGroup,
} from '../utils/todos/index.js'

interface SessionTodosTabProps {
  session: {
    sessionId: string
  }
  fileContent: string | null
}

export function SessionTodosTab({ fileContent }: SessionTodosTabProps) {
  const [showAll, setShowAll] = useState(() => {
    const saved = localStorage.getItem('sessionTodosShowAll')
    return saved !== null ? saved === 'true' : true // Default to true (show all)
  })
  const todoUpdates = useMemo(() => extractTodosAuto(fileContent || ''), [fileContent])

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
