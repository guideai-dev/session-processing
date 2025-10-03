/**
 * SessionCard - Display card for a single session
 *
 * CONVERTED TO PROPS-BASED: This component requires the following to be passed as props:
 * - session data
 * - isActive state (from WebSocket or other real-time source)
 * - ProviderIcon component (provider-specific icons)
 * - Event handlers for interactions
 *
 * The parent component should handle:
 * - WebSocket connection for live session status
 * - Navigation (Link component)
 * - Provider icon rendering
 */

interface AgentSession {
  id: string
  sessionId: string
  provider: string
  username: string
  projectName: string
  sessionStartTime: string | null
  sessionEndTime: string | null
  fileSize: number
  durationMs: number | null
  processingStatus: string
  assessmentStatus: string
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
  onSyncSession?: (sessionId: string) => void
  onShowSyncError?: (sessionId: string, error: string) => void
  isProcessing?: boolean
  // Component injections
  ProviderIcon?: React.ComponentType<{ providerId: string; size: number }>
  LinkComponent?: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>
}

function SessionCard({
  session,
  isSelected = false,
  isActive = false,
  onSelect,
  onViewSession,
  onProcessSession,
  onAssessSession,
  onSyncSession,
  onShowSyncError,
  isProcessing = false,
  ProviderIcon,
  LinkComponent,
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

  const formatFileSize = (bytes: number) => {
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
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          label: 'Pending Processing',
          clickable: true
        }
      case 'processing':
        return {
          icon: '🔄',
          color: 'text-info',
          bgColor: 'bg-info/10',
          label: 'Processing...',
          clickable: false
        }
      case 'completed':
        return {
          icon: '✅',
          color: 'text-success',
          bgColor: 'bg-success/10',
          label: 'Processed',
          clickable: true
        }
      case 'failed':
        return {
          icon: '❌',
          color: 'text-error',
          bgColor: 'bg-error/10',
          label: 'Processing Failed',
          clickable: true
        }
      default:
        return {
          icon: '⏳',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
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
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        color: 'text-error',
        bgColor: 'bg-error/10',
        label: 'Sync Failed - Click to view error',
        clickable: true
      }
    } else if (session.syncedToServer) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
        color: 'text-success',
        bgColor: 'bg-success/10',
        label: 'Synced to server',
        clickable: false
      }
    } else {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        ),
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
        <div
          onClick={handleCardClick}
          className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 flex-1 min-w-0 cursor-pointer"
        >
          {/* Provider + Username + Project Name + Active Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {ProviderIcon && <ProviderIcon providerId={session.provider} size={16} />}
            {isActive && (
              <span className="badge badge-success badge-xs gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
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
            <div className="flex items-center gap-1">
              <span className="hidden md:inline">Size:</span>
              <span className="font-medium">{formatFileSize(session.fileSize)}</span>
            </div>
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
            className={`flex items-center justify-center w-10 h-10 md:w-8 md:h-8 rounded-full ${processingInfo.bgColor} ${
              processingInfo.clickable && !actuallyProcessing ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            } transition-all tooltip tooltip-left`}
            data-tip={actuallyProcessing ? 'Processing...' : processingInfo.label}
            onClick={processingInfo.clickable && !actuallyProcessing ? handleProcessClick : undefined}
          >
            {actuallyProcessing ? (
              <span className="loading loading-spinner loading-xs text-info"></span>
            ) : (
              <span className={`text-base md:text-sm ${processingInfo.color}`}>
                {processingInfo.icon}
              </span>
            )}
          </div>

          {/* Sync Status Indicator */}
          <div
            className={`flex items-center justify-center w-10 h-10 md:w-8 md:h-8 rounded-full ${syncInfo.bgColor} ${
              syncInfo.clickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            } transition-all tooltip tooltip-left`}
            data-tip={syncInfo.label}
            onClick={syncInfo.clickable ? handleSyncClick : undefined}
          >
            <span className={syncInfo.color}>
              {syncInfo.icon}
            </span>
          </div>
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
    <div className={`relative flex flex-col gap-3 p-3 bg-base-100 border rounded transition-all ${
      isSelected ? 'border-primary bg-primary/5' : isActive ? 'border-2 border-success/60 shadow-lg shadow-success/20' : 'border-base-300 hover:shadow-md hover:border-primary/50'
    }`}>
      {CardContent}
    </div>
  )
}

export default SessionCard
