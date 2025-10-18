/**
 * MetricSection - Section container for metrics
 */

interface MetricSectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  icon?: string
}

export function MetricSection({ title, subtitle, children, icon }: MetricSectionProps) {
  return (
    <div className="card bg-base-200 shadow-sm border border-base-300">
      <div className="card-body">
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <div>
            <h3 className="card-title text-lg">{title}</h3>
            {subtitle && <p className="text-sm text-base-content/70 mt-1">{subtitle}</p>}
          </div>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
