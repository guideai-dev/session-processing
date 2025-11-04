/**
 * QualityMetricsSection - Task success rates and AI usage process quality
 */

import {
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline'
import { MetricCard } from '../MetricCard.js'
import { MetricSection } from '../MetricSection.js'
import type { SessionMetricsUI } from '../MetricsOverview.js'

interface QualityMetricsSectionProps {
  quality: SessionMetricsUI['quality']
}

export function QualityMetricsSection({ quality }: QualityMetricsSectionProps) {
  if (!quality) {
    return null
  }

  return (
    <MetricSection
      title="Quality"
      subtitle="Task success rates and AI usage process quality"
      icon={<CheckCircleIcon />}
    >
      <div className="space-y-4">
        {/* Plan Mode Usage - Prominent Display */}
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 ${quality.usedPlanMode ? 'text-green-500' : 'text-gray-400'}`}
              >
                {quality.usedPlanMode ? <CheckCircleIcon /> : <MinusCircleIcon />}
              </div>
              <div>
                <h4 className="font-semibold text-sm">Used Plan Mode</h4>
                <p className="text-xs text-base-content/70">
                  {quality.usedPlanMode
                    ? 'Excellent! Used proper planning discipline'
                    : 'Consider using plan mode for complex tasks'}
                </p>
              </div>
            </div>
            <div
              className={`badge ${quality.usedPlanMode ? 'badge-success' : 'badge-ghost'} font-medium`}
            >
              {quality.usedPlanMode ? '✓ Yes' : '✗ No'}
            </div>
          </div>
          {quality.exitPlanModeCount && quality.exitPlanModeCount > 0 && (
            <div className="text-xs text-base-content/60 mt-2">
              Used ExitPlanMode {quality.exitPlanModeCount} time(s)
            </div>
          )}
        </div>

        {/* Todo Tracking Usage */}
        <div className="card bg-base-100 border border-base-300 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 ${quality.usedTodoTracking ? 'text-green-500' : 'text-gray-400'}`}
              >
                {quality.usedTodoTracking ? <ClipboardDocumentListIcon /> : <MinusCircleIcon />}
              </div>
              <div>
                <h4 className="font-medium text-sm">Todo Tracking</h4>
                <p className="text-xs text-base-content/70">
                  {quality.usedTodoTracking
                    ? 'Great task organization!'
                    : 'TodoWrite helps track progress'}
                </p>
              </div>
            </div>
            <div className={`badge ${quality.usedTodoTracking ? 'badge-success' : 'badge-ghost'}`}>
              {quality.usedTodoTracking ? '✓ Yes' : '✗ No'}
            </div>
          </div>
          {quality.todoWriteCount && quality.todoWriteCount > 0 && (
            <div className="text-xs text-base-content/60 mt-1">
              Used TodoWrite {quality.todoWriteCount} time(s)
            </div>
          )}
        </div>

        {/* Over the Top Affirmations Card */}
        {quality.overTopAffirmations !== undefined && quality.overTopAffirmations !== null && (
          <div className="card bg-base-100 border border-base-300 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 ${quality.overTopAffirmations > 0 ? 'text-yellow-500' : 'text-green-500'}`}
                >
                  {quality.overTopAffirmations > 0 ? (
                    <ExclamationCircleIcon />
                  ) : (
                    <CheckCircleIcon />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-sm">Over-the-Top Affirmations</h4>
                  <p className="text-xs text-base-content/70">
                    {quality.overTopAffirmations === 0
                      ? 'Professional tone maintained'
                      : `${quality.overTopAffirmations} excessive affirmations detected`}
                  </p>
                </div>
              </div>
              <div
                className={`badge ${quality.overTopAffirmations === 0 ? 'badge-success' : 'badge-warning'}`}
              >
                {quality.overTopAffirmations}
              </div>
            </div>
            {quality.overTopAffirmationsPhrases &&
              quality.overTopAffirmationsPhrases.length > 0 && (
                <div className="text-xs text-base-content/60 mt-1">
                  Phrases: {quality.overTopAffirmationsPhrases.join(', ')}
                </div>
              )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            label="Task Success Rate"
            value={quality.taskSuccessRate ? Number.parseFloat(quality.taskSuccessRate) : undefined}
            type="percentage"
            tooltip="Percentage of operations that succeeded"
            metricId="task-success-rate"
          />
          <MetricCard
            label="Iteration Count"
            value={quality.iterationCount}
            tooltip="Number of refinement cycles needed"
            metricId="iteration-count"
          />
          <MetricCard
            label="Process Quality Score"
            value={
              quality.processQualityScore
                ? Number.parseFloat(quality.processQualityScore)
                : undefined
            }
            type="percentage"
            tooltip="Score for good AI usage practices (plan mode gives 30pts, todo tracking gives 20pts)"
            metricId="process-quality-score"
          />
          <MetricCard
            label="Affirmations"
            value={quality.overTopAffirmations || 0}
            tooltip="Count of over-the-top affirmations like 'You're absolutely right!'"
            metricId="affirmations"
          />
        </div>
      </div>
    </MetricSection>
  )
}
