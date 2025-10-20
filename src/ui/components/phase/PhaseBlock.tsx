/**
 * PhaseBlock - Individual phase container with border, header, stats, and summary
 */

import { PhaseHeader } from './PhaseHeader.js'
import { getPhaseBorderColor } from './PhaseIcon.js'
import type { SessionPhaseType } from './PhaseIcon.js'
import { PhaseStats } from './PhaseStats.js'
import { PhaseSummary } from './PhaseSummary.js'

export interface SessionPhase {
  phaseType: SessionPhaseType
  startStep: number
  endStep: number
  stepCount: number
  summary: string
  durationMs: number
  timestamp?: string
}

interface PhaseBlockProps {
  phase: SessionPhase
}

export function PhaseBlock({ phase }: PhaseBlockProps) {
  const borderColor = getPhaseBorderColor(phase.phaseType)

  return (
    <div
      className={`bg-base-100 border-l-4 ${borderColor} rounded-r mb-3 font-mono text-sm shadow-md`}
    >
      <div className="p-3">
        <PhaseHeader phaseType={phase.phaseType} />
        <PhaseStats
          startStep={phase.startStep}
          endStep={phase.endStep}
          stepCount={phase.stepCount}
          durationMs={phase.durationMs}
          timestamp={phase.timestamp}
        />
        <PhaseSummary summary={phase.summary} />
      </div>
    </div>
  )
}
