/**
 * UsageMetricsSection - AI navigation efficiency and input quality analysis
 */

import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { MetricCard } from '../MetricCard.js'
import { MetricSection } from '../MetricSection.js'
import type { SessionMetricsUI } from '../MetricsOverview.js'

interface UsageMetricsSectionProps {
  usage: SessionMetricsUI['usage']
}

export function UsageMetricsSection({ usage }: UsageMetricsSectionProps) {
  if (!usage || (!usage.readWriteRatio && !usage.inputClarityScore)) {
    return null
  }

  return (
    <MetricSection
      title="Usage Efficiency"
      subtitle="AI navigation efficiency and input quality analysis"
      icon={<WrenchScrewdriverIcon />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <MetricCard
            label="Read/Write Ratio"
            value={usage.readWriteRatio ? Number.parseFloat(usage.readWriteRatio) : undefined}
            suffix=":1"
            tooltip="Reads per write (lower is better - high means AI is 'lost')"
            metricId="read-write-ratio"
          />
          <MetricCard
            label="Input Clarity Score"
            value={usage.inputClarityScore ? Number.parseFloat(usage.inputClarityScore) : undefined}
            type="percentage"
            tooltip="Technical terms and code snippets density"
            metricId="input-clarity-score"
          />
        </div>
      </div>
    </MetricSection>
  )
}
