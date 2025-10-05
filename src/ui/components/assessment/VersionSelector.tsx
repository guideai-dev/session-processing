import { useEffect, useState } from 'react'
import { ClockIcon, RocketLaunchIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import type { AssessmentVersion } from '@guideai-dev/types'

interface VersionOption {
  version: AssessmentVersion
  title: string
  subtitle: string
  icon: typeof ClockIcon
  estimatedTime: string
  questionCount: number
}

const versionOptions: VersionOption[] = [
  {
    version: 'short',
    title: 'Quick',
    subtitle: "Just the essentials",
    icon: RocketLaunchIcon,
    estimatedTime: '< 1m',
    questionCount: 8,
  },
  {
    version: 'medium',
    title: 'Balanced',
    subtitle: 'Key questions',
    icon: ClockIcon,
    estimatedTime: '1-2m',
    questionCount: 14,
  },
  {
    version: 'long',
    title: 'Deep Dive',
    subtitle: 'Full assessment',
    icon: ChartBarIcon,
    estimatedTime: '3-4m',
    questionCount: 21,
  },
]

interface VersionSelectorProps {
  onSelect: (version: AssessmentVersion) => void
}

export function VersionSelector({ onSelect }: VersionSelectorProps) {
  const [selected, setSelected] = useState<AssessmentVersion>('long')

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSelect(selected)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const currentIndex = versionOptions.findIndex(opt => opt.version === selected)
        if (currentIndex > 0) {
          setSelected(versionOptions[currentIndex - 1].version)
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIndex = versionOptions.findIndex(opt => opt.version === selected)
        if (currentIndex < versionOptions.length - 1) {
          setSelected(versionOptions[currentIndex + 1].version)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selected, onSelect])

  return (
    <div className="py-4">
      <div className="text-center mb-6">
        <h3 className="text-base md:text-lg font-semibold mb-1">Choose assessment length</h3>
        <p className="text-xs md:text-sm text-base-content/60">
          <span className="hidden md:inline">Use arrow keys to select, press Enter to continue</span>
          <span className="md:hidden">Tap to select an option</span>
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 max-w-2xl mx-auto">
        {versionOptions.map((option) => {
          const Icon = option.icon
          const isSelected = selected === option.version
          return (
            <button
              key={option.version}
              type="button"
              onClick={() => onSelect(option.version)}
              onMouseEnter={() => setSelected(option.version)}
              className={`
                flex-1 card cursor-pointer
                transition-all duration-200
                ${isSelected
                  ? 'bg-primary text-primary-content border-2 border-primary shadow-lg md:scale-105'
                  : 'bg-base-100 border border-base-300 hover:border-base-content/20'
                }
              `}
            >
              <div className="card-body p-4 md:p-5">
                <div className="flex md:flex-col items-center md:items-center gap-3 md:gap-0">
                  <Icon className="w-6 h-6 md:mx-auto md:mb-2 shrink-0" />
                  <div className="flex-1 md:flex-none text-left md:text-center">
                    <h4 className="font-bold text-sm md:text-base">{option.title}</h4>
                    <p className={`text-xs ${isSelected ? 'opacity-90' : 'text-base-content/60'}`}>
                      {option.subtitle}
                    </p>
                  </div>
                  <div className={`text-xs md:mt-2 md:pt-2 md:border-t md:w-full ${isSelected ? 'md:border-primary-content/20' : 'md:border-base-300'} shrink-0`}>
                    {option.estimatedTime} • {option.questionCount} questions
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="text-center mt-4 text-xs text-base-content/50 hidden md:block">
        Press <kbd className="kbd kbd-xs">Enter</kbd> to start
      </div>
    </div>
  )
}