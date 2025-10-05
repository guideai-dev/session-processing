/**
 * PhaseSummary - Summary text display for a phase
 */

interface PhaseSummaryProps {
  summary: string
}

export function PhaseSummary({ summary }: PhaseSummaryProps) {
  return (
    <div className="text-sm text-base-content/80 leading-relaxed">
      {summary}
    </div>
  )
}
