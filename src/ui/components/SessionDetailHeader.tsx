/**
 * SessionDetailHeader - Shared session detail header component
 *
 * Displays session metadata, stats, and action buttons for session detail pages.
 * Used by both desktop and server apps for consistent UI.
 */

import { RatingBadge } from './RatingBadge.js'
import type { SessionRating } from '../../utils/rating.js'

export interface SessionDetailHeaderProps {
  // Session data
  session: {
    provider: string
    projectName: string
    sessionStartTime: string | null
    durationMs: number | null
    fileSize?: number
    username?: string
    userAvatarUrl?: string
    project?: {
      name: string
      gitRemoteUrl?: string
      cwd?: string
    }
    cwd?: string // For desktop (direct cwd field)
    aiModelSummary?: string
  }

  // Optional stats
  messageCount?: number

  // Rating
  rating?: SessionRating | null
  onRate?: (rating: SessionRating) => void | Promise<void>

  // Action handlers
  onProcessSession?: () => void
  onAssessSession?: () => void
  onCwdClick?: (path: string) => void | Promise<void> // Desktop only

  // Status states
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  isProcessing?: boolean
  assessmentStatus?: 'not_started' | 'in_progress' | 'completed'

  // Desktop-specific sync status
  syncStatus?: {
    synced: boolean
    failed: boolean
    reason?: string
    onSync?: () => void
    onShowError?: (error: string) => void
  }

  // Required component injection
  ProviderIcon: React.ComponentType<{ providerId: string; size: number }>
}

export function SessionDetailHeader({
  session,
  messageCount,
  rating,
  onRate,
  onProcessSession,
  onAssessSession,
  onCwdClick,
  processingStatus = 'pending',
  isProcessing = false,
  assessmentStatus = 'not_started',
  syncStatus,
  ProviderIcon,
}: SessionDetailHeaderProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return 'N/A'
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const actuallyProcessing = isProcessing || processingStatus === 'processing'
  const workingDirectory = session.project?.cwd || session.cwd

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        {/* Header with user info, project, time, and actions */}
        <div className="mb-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
            {/* Left: User/Project Info */}
            <div className="flex items-center gap-2 flex-wrap">
              {session.username && session.userAvatarUrl && (
                <>
                  <a
                    href={`https://github.com/${session.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    title={`View @${session.username} on GitHub`}
                  >
                    <img
                      src={session.userAvatarUrl}
                      alt={session.username}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <span className="font-semibold text-lg md:text-xl hover:underline">
                      @{session.username}
                    </span>
                  </a>
                  <span className="text-base-content/50 text-sm">•</span>
                </>
              )}
              <span className="font-medium text-base md:text-lg">{session.projectName}</span>
              <span className="text-base-content/50 text-sm">•</span>
              <span className="text-sm text-base-content/70">
                {formatDate(session.sessionStartTime)}
              </span>

              {/* Sync Status Icon (desktop only) */}
              {syncStatus && (
                <>
                  {syncStatus.failed ? (
                    <div
                      className="tooltip tooltip-bottom cursor-pointer hover:scale-110 transition-transform"
                      data-tip="Sync failed - Click to view error"
                      onClick={() => syncStatus.onShowError?.(syncStatus.reason || 'Unknown error')}
                    >
                      <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  ) : syncStatus.synced ? (
                    <div className="tooltip tooltip-bottom" data-tip="Synced to server">
                      <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="tooltip tooltip-bottom cursor-pointer hover:scale-110 transition-transform"
                      data-tip="Click to sync to server"
                      onClick={syncStatus.onSync}
                    >
                      <svg className="w-4 h-4 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Action Buttons (desktop only) */}
            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              {onProcessSession && (
                <button
                  onClick={onProcessSession}
                  disabled={actuallyProcessing}
                  className={`btn btn-xs gap-1.5 ${
                    processingStatus === 'completed' ? 'btn-secondary' : 'btn-warning'
                  }`}
                  title={
                    actuallyProcessing
                      ? 'Processing...'
                      : processingStatus === 'completed'
                        ? 'Metrics already processed'
                        : 'Process session with AI'
                  }
                >
                  {actuallyProcessing ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <span className="hidden lg:inline text-xs">
                    {actuallyProcessing
                      ? 'Processing...'
                      : processingStatus === 'completed'
                        ? 'Metrics Processed ✓'
                        : 'Process Session'}
                  </span>
                </button>
              )}
              {onAssessSession && (
                <button
                  onClick={onAssessSession}
                  className={`btn btn-xs gap-1.5 ${
                    assessmentStatus === 'completed' ? 'btn-secondary' : 'btn-accent'
                  }`}
                  title={
                    assessmentStatus === 'completed'
                      ? 'Assessment complete'
                      : assessmentStatus === 'in_progress'
                        ? 'Continue assessment'
                        : 'Start session assessment'
                  }
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden lg:inline text-xs">
                    {assessmentStatus === 'completed'
                      ? 'Assessed ✓'
                      : assessmentStatus === 'in_progress'
                        ? 'Assessment In Progress'
                        : 'Assess Session'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile: Action Buttons */}
          {(onProcessSession || onAssessSession) && (
            <div className="md:hidden mb-2 flex gap-1.5">
              {onProcessSession && (
                <button
                  onClick={onProcessSession}
                  disabled={actuallyProcessing}
                  className={`btn btn-xs gap-1.5 ${
                    processingStatus === 'completed' ? 'btn-secondary' : 'btn-warning'
                  }`}
                >
                  {actuallyProcessing ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <span className="text-xs">
                    {actuallyProcessing
                      ? 'Processing...'
                      : processingStatus === 'completed'
                        ? 'Processed ✓'
                        : 'Process'}
                  </span>
                </button>
              )}
              {onAssessSession && (
                <button
                  onClick={onAssessSession}
                  className={`btn btn-xs gap-1.5 ${
                    assessmentStatus === 'completed' ? 'btn-secondary' : 'btn-accent'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs">
                    {assessmentStatus === 'completed'
                      ? 'Assessed ✓'
                      : assessmentStatus === 'in_progress'
                        ? 'In Progress'
                        : 'Assess'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Session Stats Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="stat bg-base-200 rounded-lg p-2.5">
            <div className="stat-title text-xs">Provider</div>
            <div className="stat-value text-sm flex items-center gap-1.5">
              <ProviderIcon providerId={session.provider} size={16} />
              {session.provider}
            </div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-2.5">
            <div className="stat-title text-xs">Duration</div>
            <div className="stat-value text-sm">{formatDuration(session.durationMs)}</div>
          </div>
          {messageCount !== undefined && (
            <div className="stat bg-base-200 rounded-lg p-2.5">
              <div className="stat-title text-xs">Messages</div>
              <div className="stat-value text-sm">{messageCount}</div>
            </div>
          )}
          {session.fileSize !== undefined && (
            <div className="stat bg-base-200 rounded-lg p-2.5">
              <div className="stat-title text-xs">Size</div>
              <div className="stat-value text-sm">{formatFileSize(session.fileSize)}</div>
            </div>
          )}
          {onRate && (
            <div className="stat bg-base-200 rounded-lg p-2.5">
              <div className="stat-title text-xs">Rating</div>
              <div className="stat-value text-sm flex items-center justify-center">
                <RatingBadge rating={rating || null} onRate={onRate} size="md" />
              </div>
            </div>
          )}
        </div>

        {/* Project and Working Directory - 2 columns below stats */}
        {(session.project || workingDirectory) && (
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Project Info */}
            {session.project && (
              <div className="stat bg-base-200 rounded-lg p-2.5">
                <div className="stat-title text-xs mb-1">Project</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="stat-value text-sm">{session.project.name}</div>
                  {session.project.gitRemoteUrl && (
                    <a
                      href={session.project.gitRemoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-base-content/60 hover:text-primary transition-colors flex-shrink-0"
                      title={session.project.gitRemoteUrl}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          fillRule="evenodd"
                          d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="hidden sm:inline truncate max-w-[150px]">
                        {session.project.gitRemoteUrl.replace(/^https?:\/\/(www\.)?/, '')}
                      </span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Working Directory */}
            {workingDirectory && (
              <div className="stat bg-base-200 rounded-lg p-2.5">
                <div className="stat-title text-xs flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Working Directory
                </div>
                <div className="stat-value text-sm mt-1">
                  {onCwdClick ? (
                    <button
                      onClick={() => onCwdClick(workingDirectory)}
                      className="text-left hover:text-primary transition-colors font-mono break-all text-xs"
                      title="Click to open in OS"
                    >
                      {workingDirectory}
                    </button>
                  ) : (
                    <span className="font-mono break-all text-xs">{workingDirectory}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Summary */}
        {session.aiModelSummary && (
          <div className="mt-2 bg-base-200/50 border border-base-300 rounded-lg p-3">
            <p className="text-sm text-base-content">{session.aiModelSummary}</p>
          </div>
        )}
      </div>
    </div>
  )
}
