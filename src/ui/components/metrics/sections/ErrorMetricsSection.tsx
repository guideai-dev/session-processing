/**
 * ErrorMetricsSection - Error tracking and recovery patterns
 */

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { MetricCard } from '../MetricCard.js'
import { MetricSection } from '../MetricSection.js'
import type { SessionMetricsUI } from '../MetricsOverview.js'

interface ErrorMetricsSectionProps {
  error: SessionMetricsUI['error']
}

export function ErrorMetricsSection({ error }: ErrorMetricsSectionProps) {
  if (!error || error.errorCount === undefined || error.errorCount === null) {
    return null
  }

  return (
    <MetricSection
      title="Errors & Recovery"
      subtitle="Error tracking and recovery patterns"
      icon={<ExclamationTriangleIcon />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            label="Error Count"
            value={error.errorCount}
            tooltip="Total number of errors encountered"
            metricId="error-count"
          />
          <MetricCard
            label="Fatal Errors"
            value={error.fatalErrors || 0}
            tooltip="Critical errors that stopped progress"
            metricId="fatal-errors"
          />
          <MetricCard
            label="Recovery Attempts"
            value={error.recoveryAttempts || 0}
            tooltip="Number of times AI retried after errors"
            metricId="recovery-attempts"
          />
          <MetricCard
            label="Error Types"
            value={error.errorTypes?.length || 0}
            tooltip="Unique categories of errors"
          />
        </div>

        {/* Error Types List */}
        {error.errorTypes && error.errorTypes.length > 0 && (
          <div className="card bg-base-100 p-4">
            <h4 className="font-semibold mb-3">Error Categories</h4>
            <div className="flex flex-wrap gap-2">
              {error.errorTypes.map((errorType: string) => (
                <span key={errorType} className="badge badge-error badge-outline">
                  {errorType.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </MetricSection>
  )
}
