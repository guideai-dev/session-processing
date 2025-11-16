import { useState } from 'react'
import type { LikertScaleProps } from './types'

export function LikertScale({
  scale,
  value,
  onChange,
  labels,
  disabled = false,
  startValue = 1,
  reverseScored = false,
}: LikertScaleProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const numbers = Array.from({ length: scale }, (_, i) => i + startValue)

  // Determine label colors based on scoring direction
  // reverseScored = true means low scores are positive (e.g., "Never" checking = good)
  const leftLabelColor = reverseScored ? 'text-success' : 'text-error'
  const rightLabelColor = reverseScored ? 'text-error' : 'text-success'

  return (
    <div className="space-y-4">
      {/* Scale buttons with labels underneath */}
      <div className="space-y-3">
        <div className="flex justify-center gap-2">
          {numbers.map(num => {
            const isSelected = value === num
            const isHovered = hoverValue === num

            return (
              <button
                key={num}
                type="button"
                onClick={() => !disabled && onChange(num)}
                onMouseEnter={() => setHoverValue(num)}
                onMouseLeave={() => setHoverValue(null)}
                disabled={disabled}
                className={`
                  w-12 h-12 rounded-full font-semibold text-lg
                  transition-all duration-200 relative
                  ${
                    isSelected
                      ? 'bg-primary text-primary-content scale-110 shadow-lg'
                      : isHovered
                        ? 'bg-primary/20 scale-105'
                        : 'bg-base-200 hover:bg-base-300'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {num}
              </button>
            )
          })}
        </div>

        {/* Labels directly under first and last buttons */}
        {labels && (
          <div className="flex justify-between px-6">
            <span className={`text-sm font-bold ${leftLabelColor}`}>
              {labels[0]}
            </span>
            <span className={`text-sm font-bold ${rightLabelColor}`}>
              {labels[1]}
            </span>
          </div>
        )}
      </div>

      {/* Keyboard hint - only show for scales that support it (not NPS) */}
      {scale <= 7 && (
        <div className="text-center text-xs text-base-content/50">
          Press <kbd className="kbd kbd-xs">{startValue}</kbd> -{' '}
          <kbd className="kbd kbd-xs">{startValue + scale - 1}</kbd> to select
        </div>
      )}

      {/* Current selection display */}
      {value && (
        <div className="text-center text-sm text-primary font-medium">Selected: {value}</div>
      )}
    </div>
  )
}
