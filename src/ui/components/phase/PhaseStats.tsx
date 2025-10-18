/**
 * PhaseStats - Step range and duration display for a phase
 */

interface PhaseStatsProps {
  startStep: number
  endStep: number
  stepCount: number
  durationMs: number
  timestamp?: string
}

export function PhaseStats({
  startStep,
  endStep,
  stepCount,
  durationMs,
  timestamp,
}: PhaseStatsProps) {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
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

  const formatTimestamp = (ts: string): string => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="flex flex-wrap gap-3 text-xs text-base-content/70 mb-2">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">Steps:</span>
        <span>
          {startStep}-{endStep}
        </span>
        <span className="text-base-content/50">({stepCount} messages)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-medium">Duration:</span>
        <span>{formatDuration(durationMs)}</span>
      </div>
      {timestamp && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Started:</span>
          <span>{formatTimestamp(timestamp)}</span>
        </div>
      )}
    </div>
  )
}
