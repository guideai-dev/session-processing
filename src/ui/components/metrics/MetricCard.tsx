/**
 * MetricCard - Displays a single metric with formatting
 *
 * NOTE: This component imports formatDuration, formatPercentage, and getMetricColor
 * from useSessionMetrics hook. These should be extracted to utility functions.
 */

// TODO: Extract these utilities from the hooks file
function formatDuration(value: number): string {
  if (value < 1000) return `${value}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  if (value < 3600000) return `${(value / 60000).toFixed(1)}m`
  return `${(value / 3600000).toFixed(1)}h`
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

function getMetricColor(value: number, type: 'percentage' | 'time' | 'score'): string {
  if (type === 'percentage' || type === 'score') {
    if (value >= 80) return 'text-success'
    if (value >= 60) return 'text-warning'
    return 'text-error'
  }
  if (type === 'time') {
    if (value < 1000) return 'text-success'
    if (value < 5000) return 'text-warning'
    return 'text-error'
  }
  return 'text-base-content'
}

interface MetricCardProps {
  label: string
  value: any
  unit?: string
  suffix?: string
  type?: 'number' | 'percentage' | 'duration' | 'array' | 'object' | 'string'
  tooltip?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MetricCard({
  label,
  value,
  unit,
  suffix,
  type = 'number',
  tooltip,
  size = 'md',
}: MetricCardProps) {
  const formatValue = () => {
    if (value === null || value === undefined) return 'N/A'

    switch (type) {
      case 'duration':
        return formatDuration(value)
      case 'percentage':
        return formatPercentage(value)
      case 'array':
        if (Array.isArray(value)) {
          return value.length === 0 ? 'None' : value.join(', ')
        }
        return 'N/A'
      case 'object':
        if (typeof value === 'object' && value !== null) {
          return Object.keys(value).length === 0 ? 'None' : JSON.stringify(value, null, 1)
        }
        return 'N/A'
      case 'string':
        return value.toString()
      default:
        return typeof value === 'number' ? value.toLocaleString() : value.toString()
    }
  }

  const getValueColor = () => {
    if (type === 'percentage' && typeof value === 'number') {
      return getMetricColor(value, 'percentage')
    }
    if (type === 'duration' && typeof value === 'number') {
      return getMetricColor(value, 'time')
    }
    if (type === 'number' && typeof value === 'number' && value >= 0 && value <= 100) {
      return getMetricColor(value, 'score')
    }
    return 'text-base-content'
  }

  const cardSizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const textSizeClasses = {
    sm: { value: 'text-lg', label: 'text-xs' },
    md: { value: 'text-xl', label: 'text-sm' },
    lg: { value: 'text-2xl', label: 'text-base' },
  }

  return (
    <div
      className={`card bg-base-100 shadow-sm border border-base-200 ${cardSizeClasses[size]}`}
      title={tooltip}
    >
      <div className="space-y-1">
        <div className={`font-semibold ${getValueColor()} ${textSizeClasses[size].value}`}>
          {formatValue()}
          {(suffix || unit) && <span className="text-base-content/60 ml-1">{suffix || unit}</span>}
        </div>
        <div className={`text-base-content/70 font-medium ${textSizeClasses[size].label}`}>
          {label}
        </div>
      </div>
    </div>
  )
}
