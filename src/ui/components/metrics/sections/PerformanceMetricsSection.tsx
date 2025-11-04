/**
 * PerformanceMetricsSection - AI response speed and task completion efficiency
 */

import { BoltIcon } from '@heroicons/react/24/outline'
import { MetricCard } from '../MetricCard.js'
import { MetricSection } from '../MetricSection.js'
import type { SessionMetricsUI } from '../MetricsOverview.js'

interface PerformanceMetricsSectionProps {
  performance: SessionMetricsUI['performance']
}

export function PerformanceMetricsSection({ performance }: PerformanceMetricsSectionProps) {
  if (!performance || (!performance.responseLatencyMs && !performance.taskCompletionTimeMs)) {
    return null
  }

  return (
    <MetricSection
      title="Performance"
      subtitle="AI response speed and task completion efficiency"
      icon={<BoltIcon />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <MetricCard
            label="Response Latency"
            value={
              performance.responseLatencyMs
                ? Number.parseFloat(performance.responseLatencyMs)
                : undefined
            }
            type="duration"
            tooltip="Average time to respond to user messages"
            metricId="response-latency"
          />
          <MetricCard
            label="Task Completion Time"
            value={
              performance.taskCompletionTimeMs
                ? Number.parseFloat(performance.taskCompletionTimeMs)
                : undefined
            }
            type="duration"
            tooltip="Total time to complete user's goal"
            metricId="task-completion-time"
          />
        </div>
      </div>
    </MetricSection>
  )
}
