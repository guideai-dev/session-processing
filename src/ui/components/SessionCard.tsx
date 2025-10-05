/**
 * SessionCard - Display card for a single session
 *
 * CONVERTED TO PROPS-BASED: This component requires the following to be passed as props:
 * - session data
 * - isActive state (from WebSocket or other real-time source)
 * - ProviderIcon component (for rendering provider icons)
 * - Event handlers for interactions
 *
 * The parent component should handle:
 * - WebSocket connection for live session status
 * - Navigation
 * - Provider icon rendering
 */

import { ChartBarIcon, XCircleIcon, CloudArrowUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { RatingBadge } from './RatingBadge.js'
import type { SessionRating } from '../../utils/rating.js'

interface AgentSession {
  id: string
  sessionId: string
  provider: string
  username: string
  projectName: string
  sessionStartTime: string | null
  sessionEndTime: string | null
  fileSize: number | null
  durationMs: number | null
  processingStatus: string
  assessmentStatus: string
  assessmentRating?: string | null
  aiModelSummary?: string | null
  aiModelQualityScore?: number | null
  createdAt: string
  syncedToServer?: boolean
  syncFailedReason?: string | null
}

interface SessionCardProps {
  session: AgentSession
  isSelected?: boolean
  isActive?: boolean
  onSelect?: (checked: boolean) => void
  onViewSession?: (sessionId: string) => void
  onProcessSession?: (sessionId: string) => void
  onAssessSession?: (sessionId: string) => void
  onRateSession?: (sessionId: string, rating: SessionRating) => void | Promise<void>
  onSyncSession?: (sessionId: string) => void
  onShowSyncError?: (sessionId: string, error: string) => void
  isProcessing?: boolean
  ProviderIcon: React.ComponentType<{ providerId: string; size: number; className?: string }>
}

function SessionCard({
  session,
  isSelected = false,
  isActive = false,
  onSelect,
  onViewSession,
  onProcessSession,
  onAssessSession,
  onRateSession,
  onSyncSession,
  onShowSyncError,
  isProcessing = false,
  ProviderIcon,
}: SessionCardProps) {
  // Determine if processing from session status if not explicitly provided
  const actuallyProcessing = isProcessing || session.processingStatus === 'processing'

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString()
  }

  const formatShortDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatFileSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return null
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return 'N/A'
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelect) {
      onSelect(e.target.checked)
    }
  }

  const handleProcessClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onProcessSession) {
      onProcessSession(session.sessionId)
    }
  }

  const handleAssessClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAssessSession) {
      onAssessSession(session.sessionId)
    }
  }

  const handleRate = (rating: SessionRating) => {
    if (onRateSession) {
      onRateSession(session.sessionId, rating)
    }
  }

  const handleSyncClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If there's a sync error, show it
    if (session.syncFailedReason && onShowSyncError) {
      onShowSyncError(session.sessionId, session.syncFailedReason)
    }
    // If not synced and no error, trigger sync
    else if (!session.syncedToServer && onSyncSession) {
      onSyncSession(session.sessionId)
    }
  }

  const handleCardClick = () => {
    if (onViewSession) {
      onViewSession(session.sessionId)
    }
  }

  const getProcessingStatusInfo = (status: string) => {
    // For metrics-only sessions (no transcript file), show as "Metrics Only" with green styling
    const isMetricsOnly = session.fileSize === null || session.fileSize === undefined

    if (isMetricsOnly) {
      return {
        icon: <ChartBarIcon className="w-4 h-4" strokeWidth={2} />,
        color: 'text-success',
        bgColor: 'bg-success/20',
        label: 'Metrics Only - No transcript file to process',
        clickable: false
      }
    }

    switch (status) {
      case 'pending':
        return {
          icon: <ChartBarIcon className="w-4 h-4" strokeWidth={2} />,
          color: 'text-base-content/30',
          bgColor: 'bg-base-200',
          label: 'Pending Processing',
          clickable: true
        }
      case 'processing':
        return {
          icon: null, // Will use loading spinner instead
          color: 'text-info',
          bgColor: 'bg-info/20',
          label: 'Processing...',
          clickable: false
        }
      case 'completed':
        return {
          icon: <ChartBarIcon className="w-4 h-4" strokeWidth={2} />,
          color: 'text-success',
          bgColor: 'bg-success/20',
          label: 'Processed',
          clickable: true
        }
      case 'failed':
        return {
          icon: <XCircleIcon className="w-4 h-4" strokeWidth={2} />,
          color: 'text-error',
          bgColor: 'bg-error/20',
          label: 'Processing Failed',
          clickable: true
        }
      default:
        return {
          icon: <ChartBarIcon className="w-4 h-4" strokeWidth={2} />,
          color: 'text-base-content/30',
          bgColor: 'bg-base-200',
          label: 'Pending Processing',
          clickable: true
        }
    }
  }

  const getAssessmentStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: '✓',
          color: 'text-success',
          bgColor: 'bg-success/10',
          label: 'Assessment Complete',
          clickable: false
        }
      case 'in_progress':
        return {
          icon: '📝',
          color: 'text-info',
          bgColor: 'bg-info/10',
          label: 'Assessment In Progress',
          clickable: true
        }
      case 'not_started':
      default:
        return {
          icon: '📋',
          color: 'text-base-content/40',
          bgColor: 'bg-base-200',
          label: 'Assess Session',
          clickable: true
        }
    }
  }

  const getSyncStatusInfo = () => {
    // Priority: error > synced > not synced
    if (session.syncFailedReason) {
      return {
        icon: <ExclamationTriangleIcon className="w-4 h-4" strokeWidth={2} />,
        color: 'text-error',
        bgColor: 'bg-error/20',
        label: 'Sync Failed - Click to view error',
        clickable: true
      }
    } else if (session.syncedToServer) {
      return {
        icon: <CloudArrowUpIcon className="w-4 h-4" strokeWidth={2} />,
        color: 'text-success',
        bgColor: 'bg-success/20',
        label: 'Synced to server',
        clickable: false
      }
    } else {
      return {
        icon: <CloudArrowUpIcon className="w-4 h-4" strokeWidth={2} />,
        color: 'text-base-content/30',
        bgColor: 'bg-base-200',
        label: 'Click to sync to server',
        clickable: true
      }
    }
  }

  const processingInfo = getProcessingStatusInfo(session.processingStatus)
  const assessmentInfo = getAssessmentStatusInfo(session.assessmentStatus)
  const syncInfo = getSyncStatusInfo()

  // Render the card content
  const CardContent = (
    <>
      {/* Active indicator - pulsing badge in top right */}
      {isActive && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="relative">
            <span className="flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-success items-center justify-center">
                <span className="text-[10px] font-bold text-white">●</span>
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Top Row: Checkbox + Main Info + Status Indicators */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Checkbox */}
        {onSelect && (
          <div className="shrink-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm cursor-pointer"
              checked={isSelected}
              onChange={handleCheckboxChange}
            />
          </div>
        )}

        {/* Session Info - Main content */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 flex-1 min-w-0">
          {/* Provider + Username + Project Name + Active Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <ProviderIcon providerId={session.provider} size={16} />
            {isActive && (
              <span className="badge badge-success badge-xs gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                LIVE
              </span>
            )}
            {session.username && session.username.trim() !== '' && (
              <div className="badge badge-ghost badge-sm">
                @{session.username}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{session.projectName}</h3>
          </div>

          {/* Metadata - Stack on mobile, inline on desktop */}
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-4 text-xs text-base-content/70">
            {session.aiModelQualityScore !== null && session.aiModelQualityScore !== undefined && (
              <div className="flex items-center gap-1">
                <span className="hidden md:inline">Quality:</span>
                <span className={`font-medium ${
                  session.aiModelQualityScore >= 80 ? 'text-success' :
                  session.aiModelQualityScore >= 60 ? 'text-warning' :
                  'text-error'
                }`}>
                  {session.aiModelQualityScore}%
                </span>
              </div>
            )}
            {formatFileSize(session.fileSize) ? (
              <div className="flex items-center gap-1">
                <span className="hidden md:inline">Size:</span>
                <span className="font-medium">{formatFileSize(session.fileSize)}</span>
              </div>
            ) : (
              <div className="badge badge-ghost badge-xs">Metrics Only</div>
            )}
            <div className="flex items-center gap-1">
              <span className="hidden md:inline">Duration:</span>
              <span className="font-medium">{formatDuration(session.durationMs)}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span>{formatTime(session.sessionStartTime)}</span>
              <span>→</span>
              <span>{formatTime(session.sessionEndTime)}</span>
            </div>
            <div className="font-medium">
              {formatShortDate(session.sessionStartTime)}
            </div>
          </div>
        </div>

        {/* Status Indicators - Always visible, horizontal on mobile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Processing Status Indicator */}
          <div
            className={`flex items-center justify-center w-7 h-7 md:w-6 md:h-6 rounded-md ${processingInfo.bgColor} ${
              processingInfo.clickable && !actuallyProcessing ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            } transition-all tooltip tooltip-left`}
            data-tip={actuallyProcessing ? 'Processing...' : processingInfo.label}
            onClick={processingInfo.clickable && !actuallyProcessing ? handleProcessClick : undefined}
          >
            {actuallyProcessing ? (
              <span className="loading loading-spinner loading-xs text-info"></span>
            ) : (
              <span className={processingInfo.color}>
                {processingInfo.icon}
              </span>
            )}
          </div>

          {/* Rating Badge - Quick rating for the session (compact icon-only) */}
          {onRateSession && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center"
            >
              <RatingBadge
                rating={(session.assessmentRating as SessionRating) || null}
                onRate={handleRate}
                disabled={actuallyProcessing}
                size="md"
                compact={true}
              />
            </div>
          )}

          {/* Sync Status Indicator - Only show when onSyncSession or onShowSyncError is provided */}
          {(onSyncSession || onShowSyncError) && (
            <div
              className={`flex items-center justify-center w-7 h-7 md:w-6 md:h-6 rounded-md ${syncInfo.bgColor} ${
                syncInfo.clickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'
              } transition-all tooltip tooltip-left`}
              data-tip={syncInfo.label}
              onClick={syncInfo.clickable ? handleSyncClick : undefined}
            >
              <span className={syncInfo.color}>
                {syncInfo.icon}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary - Second row, if it exists */}
      {session.aiModelSummary && (
        <div className="text-xs text-base-content/60 pl-8 md:pl-12">
          {session.aiModelSummary}
        </div>
      )}
    </>
  )

  return (
    <div
      className={`relative flex flex-col gap-3 p-3 bg-base-100 border rounded transition-all ${
        isSelected ? 'border-primary bg-primary/5' : isActive ? 'border-2 border-success shadow-lg shadow-success/30' : 'border-base-300 hover:shadow-md hover:border-primary/50'
      } ${onViewSession ? 'cursor-pointer' : ''}`}
      onClick={onViewSession ? handleCardClick : undefined}
    >
      {CardContent}
    </div>
  )
}

export default SessionCard
