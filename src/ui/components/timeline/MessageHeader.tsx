/**
 * MessageHeader - Reusable header component for timeline messages
 */

import type { DisplayMetadata } from '../../utils/timelineTypes.js'

interface MessageHeaderProps {
  displayMetadata: DisplayMetadata
  onIconClick?: (event: React.MouseEvent) => void
}

export function MessageHeader({ displayMetadata, onIconClick }: MessageHeaderProps) {
  const { icon, IconComponent, iconColor, title, badge } = displayMetadata

  const iconElement = IconComponent ? (
    <IconComponent className={`w-5 h-5 ${iconColor || 'text-primary'}`} />
  ) : (
    <span className="text-xs px-1 py-0.5 bg-primary/20 rounded text-primary font-bold">
      {icon}
    </span>
  )

  return (
    <div className="flex items-center gap-2 mb-2">
      {onIconClick ? (
        <button
          type="button"
          onClick={onIconClick}
          className="hover:opacity-70 transition-opacity cursor-pointer p-0 border-0 bg-transparent"
          title="Shift+Click to view raw JSONL"
        >
          {iconElement}
        </button>
      ) : (
        iconElement
      )}
      <span className="font-medium text-sm text-base-content">{title}</span>
      {badge && <span className={`badge badge-xs ${badge.color}`}>{badge.text}</span>}
    </div>
  )
}
