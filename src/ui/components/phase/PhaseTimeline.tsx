/**
 * PhaseTimeline - Main phase timeline container
 */

import { PhaseBlock } from './PhaseBlock.js'
import type { SessionPhase } from './PhaseBlock.js'

export interface SessionPhaseAnalysis {
  phases: SessionPhase[]
  totalPhases: number
  totalSteps: number
  sessionDurationMs: number
  pattern: string
}

interface PhaseTimelineProps {
  phaseAnalysis: SessionPhaseAnalysis
}

export function PhaseTimeline({ phaseAnalysis }: PhaseTimelineProps) {
  const { phases, totalPhases, totalSteps, sessionDurationMs, pattern } = phaseAnalysis

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m`
    }
    return `${seconds}s`
  }

  return (
    <div className="space-y-3">
      {/* Session Overview Card */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-3">
          <h3 className="text-sm font-semibold mb-2">Session Flow</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="stat bg-base-200 rounded-lg p-2">
              <div className="stat-title text-xs">Total Phases</div>
              <div className="stat-value text-sm">{totalPhases}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-2">
              <div className="stat-title text-xs">Total Steps</div>
              <div className="stat-value text-sm">{totalSteps}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-2">
              <div className="stat-title text-xs">Duration</div>
              <div className="stat-value text-sm">{formatDuration(sessionDurationMs)}</div>
            </div>
          </div>
          {pattern && (
            <div className="mt-2 p-2.5 bg-base-200/50 rounded-lg">
              <div className="text-xs font-medium text-base-content/70 mb-1">Pattern</div>
              <div className="text-xs text-base-content/80 font-mono break-words">{pattern}</div>
            </div>
          )}
        </div>
      </div>

      {/* Phase Blocks */}
      <div>
        {phases.map(phase => (
          <PhaseBlock
            key={`${phase.phaseType}-${phase.startStep}-${phase.endStep}`}
            phase={phase}
          />
        ))}
      </div>
    </div>
  )
}
