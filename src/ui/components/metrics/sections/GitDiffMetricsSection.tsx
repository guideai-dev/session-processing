/**
 * GitDiffMetricsSection - Git diff analysis and navigation efficiency
 */

import { ChartBarIcon } from '@heroicons/react/24/outline'
import { MetricCard } from '../MetricCard.js'
import { MetricSection } from '../MetricSection.js'
import type { SessionMetricsUI } from '../MetricsOverview.js'

interface GitDiffMetricsSectionProps {
  gitDiff: SessionMetricsUI['gitDiff']
}

export function GitDiffMetricsSection({ gitDiff }: GitDiffMetricsSectionProps) {
  if (
    !gitDiff ||
    gitDiff.totalFiles === undefined ||
    gitDiff.totalFiles === null ||
    gitDiff.totalFiles === 0
  ) {
    return null
  }

  return (
    <MetricSection
      title="Code Changes"
      subtitle="Git diff analysis and navigation efficiency"
      icon={<ChartBarIcon />}
    >
      <div className="space-y-4">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            label="Files Changed"
            value={gitDiff.totalFiles}
            tooltip="Total number of files modified or added"
          />
          <MetricCard
            label="Lines Added"
            value={gitDiff.linesAdded || 0}
            tooltip="Total lines added across all files"
          />
          <MetricCard
            label="Lines Removed"
            value={gitDiff.linesRemoved || 0}
            tooltip="Total lines deleted across all files"
          />
          <MetricCard
            label="Net Change"
            value={gitDiff.netLines || 0}
            tooltip="Lines added minus lines removed (growth or reduction)"
          />
        </div>

        <div className="divider text-sm">Navigation Efficiency</div>

        {/* Efficiency Ratios */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            label="Lines Read / Changed"
            value={
              gitDiff.linesReadPerChanged
                ? Number.parseFloat(gitDiff.linesReadPerChanged)
                : undefined
            }
            suffix=":1"
            tooltip="Lines read per line changed - lower is better (efficient navigation)"
            metricId="lines-read-per-changed"
          />
          <MetricCard
            label="Reads / File"
            value={gitDiff.readsPerFile ? Number.parseFloat(gitDiff.readsPerFile) : undefined}
            tooltip="Read operations per file changed - lower is better"
            metricId="reads-per-file"
          />
          <MetricCard
            label="Lines/Min"
            value={gitDiff.linesPerMinute ? Number.parseFloat(gitDiff.linesPerMinute) : undefined}
            tooltip="Code velocity - lines changed per minute"
            metricId="lines-per-minute"
          />
          <MetricCard
            label="Lines/Tool"
            value={gitDiff.linesPerTool ? Number.parseFloat(gitDiff.linesPerTool) : undefined}
            tooltip="Lines changed per tool use - higher is better"
            metricId="lines-per-tool"
          />
        </div>
      </div>
    </MetricSection>
  )
}
