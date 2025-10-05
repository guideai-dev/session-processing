/**
 * RatingBadge - Display and interact with session ratings
 *
 * Shows current rating with appropriate icon and color.
 * When onRate is provided, becomes interactive and shows QuickRatingPopover on click.
 */

import { useState, useRef } from 'react'
import { HandThumbUpIcon, HandThumbDownIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { QuickRatingPopover } from './QuickRatingPopover.js'
import type { SessionRating } from '../../utils/rating.js'
import { getRatingDisplayInfo } from '../../utils/rating.js'

export interface RatingBadgeProps {
  rating: SessionRating | null
  onRate?: (rating: SessionRating) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  compact?: boolean  // Icon-only mode, no badge background
  className?: string
}

export function RatingBadge({
  rating,
  onRate,
  disabled = false,
  size = 'md',
  compact = false,
  className = ''
}: RatingBadgeProps) {
  const [showPopover, setShowPopover] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)

  const isInteractive = !!onRate && !disabled
  const displayInfo = getRatingDisplayInfo(rating)

  // Icon size based on size prop
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  // Get icon component
  const getIcon = () => {
    switch (displayInfo.icon) {
      case 'thumb-up':
        return <HandThumbUpIcon className={iconSize} strokeWidth={2} />
      case 'thumb-down':
        return <HandThumbDownIcon className={iconSize} strokeWidth={2} />
      case 'meh':
        return <MinusCircleIcon className={iconSize} strokeWidth={2} />
      default:
        // Default neutral state - greyed out thumb
        return <HandThumbUpIcon className={`${iconSize} opacity-40`} strokeWidth={2} />
    }
  }

  // Get icon color classes
  const getIconColorClasses = () => {
    if (!rating) {
      return 'text-base-content/30'
    }

    switch (displayInfo.color) {
      case 'success':
        return 'text-success'
      case 'warning':
        return 'text-warning'
      case 'error':
        return 'text-error'
      default:
        return 'text-base-content/40'
    }
  }

  // Get badge color classes (for non-compact mode)
  const getBadgeColorClasses = () => {
    if (!rating) {
      return 'badge-ghost text-base-content/40'
    }

    switch (displayInfo.color) {
      case 'success':
        return 'badge-success'
      case 'warning':
        return 'badge-warning'
      case 'error':
        return 'badge-error'
      default:
        return 'badge-neutral'
    }
  }

  // Get background color for compact mode
  const getCompactBgColor = () => {
    if (!rating) {
      return 'bg-base-200'
    }

    switch (displayInfo.color) {
      case 'success':
        return 'bg-success/20'
      case 'warning':
        return 'bg-warning/20'
      case 'error':
        return 'bg-error/20'
      default:
        return 'bg-base-200'
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isInteractive) {
      setShowPopover(!showPopover)
    }
  }

  const handleSelect = (newRating: SessionRating) => {
    if (onRate) {
      onRate(newRating)
    }
  }

  // Compact mode - icon in rounded rectangle
  if (compact) {
    const compactClasses = `
      flex items-center justify-center
      w-7 h-7 md:w-6 md:h-6
      rounded-md
      ${getCompactBgColor()}
      ${getIconColorClasses()}
      ${isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      transition-all
      ${className}
    `.trim()

    return (
      <div className="relative inline-block" ref={badgeRef}>
        <div
          className={compactClasses}
          onClick={handleClick}
          title={isInteractive ? 'Click to rate' : displayInfo.label}
        >
          {getIcon()}
        </div>

        {isInteractive && (
          <QuickRatingPopover
            isOpen={showPopover}
            onClose={() => setShowPopover(false)}
            onSelect={handleSelect}
            anchorRef={badgeRef}
          />
        )}
      </div>
    )
  }

  // Full badge mode
  const badgeClasses = `
    badge gap-1
    ${size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : ''}
    ${getBadgeColorClasses()}
    ${isInteractive ? 'cursor-pointer hover:opacity-80' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `.trim()

  return (
    <div className="relative inline-block" ref={badgeRef}>
      <div
        className={badgeClasses}
        onClick={handleClick}
        title={isInteractive ? 'Click to rate' : displayInfo.label}
      >
        {getIcon()}
        {size !== 'sm' && <span>{rating ? displayInfo.label : 'Rate'}</span>}
      </div>

      {isInteractive && (
        <QuickRatingPopover
          isOpen={showPopover}
          onClose={() => setShowPopover(false)}
          onSelect={handleSelect}
          anchorRef={badgeRef}
        />
      )}
    </div>
  )
}
