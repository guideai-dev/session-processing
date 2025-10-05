/**
 * PhaseHeader - Icon and title row for a phase
 */

import { getPhaseIcon, getPhaseColor, formatPhaseType } from './PhaseIcon.js'
import type { SessionPhaseType } from './PhaseIcon.js'

interface PhaseHeaderProps {
  phaseType: SessionPhaseType
}

export function PhaseHeader({ phaseType }: PhaseHeaderProps) {
  const IconComponent = getPhaseIcon(phaseType)
  const colorClass = getPhaseColor(phaseType)
  const formattedType = formatPhaseType(phaseType)

  return (
    <div className="flex items-center gap-2 mb-2">
      <IconComponent className={`w-5 h-5 ${colorClass}`} />
      <span className="font-medium text-sm text-base-content">{formattedType}</span>
    </div>
  )
}
