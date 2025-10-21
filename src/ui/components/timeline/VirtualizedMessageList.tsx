/**
 * MessageList - Simple message list renderer
 *
 * Renders timeline messages/groups without virtualization.
 * With optimized markdown rendering (marked + smart truncation), this performs well
 * for most sessions without the complexity of virtualization.
 */

import type { TimelineItem } from '../../utils/timelineTypes'
import { isTimelineGroup, isTimelineMessage } from '../../utils/timelineTypes'
import { TimelineGroup } from './TimelineGroup'
import { TimelineMessage } from './TimelineMessage'

interface VirtualizedMessageListProps {
  items: TimelineItem[]
  /** Optional header content to display before all items */
  header?: React.ReactNode
  // Legacy props - kept for backwards compatibility but not used
  reverseOrder?: boolean
  estimateSize?: number
  overscan?: number
  useWindowScroll?: boolean
  customScrollParent?: HTMLElement
}

/**
 * VirtualizedMessageList Component (now just a simple list renderer)
 *
 * Renders a list of timeline messages/groups.
 * Virtualization has been removed as it added complexity without significant
 * performance benefits after markdown optimization.
 *
 * @param items - Timeline items to render
 * @param header - Optional header content to display before all items
 */
export function VirtualizedMessageList({
  items,
  header,
}: VirtualizedMessageListProps) {
  // Show empty state (with header if provided)
  if (items.length === 0) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-base-content/50">No messages to display</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      {header && <div>{header}</div>}

      {/* Messages */}
      <div className="space-y-2">
        {items.map((item, index) => {
          if (isTimelineMessage(item)) {
            return <TimelineMessage key={`message-${index}`} message={item} />
          }
          if (isTimelineGroup(item)) {
            return <TimelineGroup key={`group-${index}`} group={item} />
          }
          return null
        })}
      </div>
    </div>
  )
}
