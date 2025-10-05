import { useState } from 'react'
import type { LikertScaleProps } from './types'

export function LikertScale({ scale, value, onChange, labels, disabled = false }: LikertScaleProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const numbers = Array.from({ length: scale }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {/* Scale buttons */}
      <div className="flex justify-center gap-2">
        {numbers.map((num) => {
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
                ${isSelected
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

      {/* Keyboard hint */}
      <div className="text-center text-xs text-base-content/50">
        Press <kbd className="kbd kbd-xs">1</kbd> - <kbd className="kbd kbd-xs">{scale}</kbd> to select
      </div>

      {/* Labels */}
      {labels && (
        <div className="flex justify-between text-sm text-base-content/60 px-2">
          <span className="text-left max-w-[45%]">{labels[0]}</span>
          <span className="text-right max-w-[45%]">{labels[1]}</span>
        </div>
      )}

      {/* Current selection display */}
      {value && (
        <div className="text-center text-sm text-primary font-medium">
          Selected: {value}
        </div>
      )}
    </div>
  )
}