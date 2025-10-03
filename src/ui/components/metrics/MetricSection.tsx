/**
 * MetricSection - Collapsible section container for metrics
 */

import { useState } from 'react'

interface MetricSectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultExpanded?: boolean
  icon?: string
}

export function MetricSection({
  title,
  subtitle,
  children,
  defaultExpanded = true,
  icon
}: MetricSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="card bg-base-200 shadow-sm border border-base-300">
      <div
        className="card-body cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <span className="text-xl">{icon}</span>}
            <div>
              <h3 className="card-title text-lg">{title}</h3>
              {subtitle && (
                <p className="text-sm text-base-content/70 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <svg
              className={`w-5 h-5 transform transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {expanded && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
