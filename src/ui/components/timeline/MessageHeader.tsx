/**
 * MessageHeader - Reusable header component for timeline messages
 */

import type { DisplayMetadata } from '../../utils/timelineTypes.js'

interface MessageHeaderProps {
  displayMetadata: DisplayMetadata
}

export function MessageHeader({ displayMetadata }: MessageHeaderProps) {
  const { icon, IconComponent, iconColor, title, badge } = displayMetadata

  return (
    <div className="flex items-center gap-2 mb-2">
      {IconComponent ? (
        <IconComponent className={`w-5 h-5 ${iconColor || 'text-primary'}`} />
      ) : (
        <span className="text-xs px-1 py-0.5 bg-primary/20 rounded text-primary font-bold">
          {icon}
        </span>
      )}
      <span className="font-medium text-sm text-base-content">{title}</span>
      {badge && <span className={`badge badge-xs ${badge.color}`}>{badge.text}</span>}
    </div>
  )
}
