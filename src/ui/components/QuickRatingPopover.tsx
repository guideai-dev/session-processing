/**
 * QuickRatingPopover - Small popover for quick session rating
 *
 * Displays three rating options that appear above the trigger element:
 * - Thumbs Up
 * - Meh / So-So
 * - Thumbs Down
 */

import { useEffect, useRef } from 'react'
import { HandThumbUpIcon, HandThumbDownIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import type { SessionRating } from '../../utils/rating.js'

export interface QuickRatingPopoverProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (rating: SessionRating) => void
  anchorRef?: React.RefObject<HTMLElement>
}

export function QuickRatingPopover({
  isOpen,
  onClose,
  onSelect,
  anchorRef,
}: QuickRatingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    // Add listener after a small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelect = (rating: SessionRating) => {
    onSelect(rating)
    onClose()
  }

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
      onClick={e => e.stopPropagation()}
    >
      {/* Popover content */}
      <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg p-1.5">
        <div className="flex gap-1">
          {/* Thumbs Down */}
          <button
            type="button"
            onClick={() => handleSelect('thumbs_down')}
            className="btn btn-xs btn-square hover:btn-error"
            title="Thumbs Down"
          >
            <HandThumbDownIcon className="w-4 h-4" />
          </button>

          {/* Meh / So-So */}
          <button
            type="button"
            onClick={() => handleSelect('meh')}
            className="btn btn-xs btn-square hover:btn-warning"
            title="Meh / So-So"
          >
            <MinusCircleIcon className="w-4 h-4" />
          </button>

          {/* Thumbs Up */}
          <button
            type="button"
            onClick={() => handleSelect('thumbs_up')}
            className="btn btn-xs btn-square hover:btn-success"
            title="Thumbs Up"
          >
            <HandThumbUpIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Arrow pointing down - centered */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-px">
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-base-300" />
      </div>
    </div>
  )
}
