/**
 * MessageList - Simple message list renderer with scroll anchoring
 *
 * Renders timeline messages/groups without virtualization.
 * With optimized markdown rendering (marked + smart truncation), this performs well
 * for most sessions without the complexity of virtualization.
 *
 * Implements scroll anchoring to prevent jarring jumps when new messages are added
 * dynamically (e.g., during live sessions).
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { TimelineItem } from '../../utils/timelineTypes'
import { isTimelineGroup, isTimelineMessage } from '../../utils/timelineTypes'
import { TimelineGroup } from './TimelineGroup'
import { TimelineMessage } from './TimelineMessage'

interface VirtualizedMessageListProps {
  items: TimelineItem[]
  /** Optional header content to display before all items */
  header?: React.ReactNode
  /** If true, items are in reverse order (newest first) and scroll anchoring applies */
  reverseOrder?: boolean
  // Legacy props - kept for backwards compatibility but not used
  estimateSize?: number
  overscan?: number
  useWindowScroll?: boolean
  customScrollParent?: HTMLElement
}

/**
 * Custom hook to manage scroll position when items are dynamically added
 *
 * @param items - Array of timeline items being rendered
 * @param reverseOrder - Whether items are in reverse order (newest first)
 */
function useScrollAnchoring(items: TimelineItem[], reverseOrder: boolean) {
  const previousItemsLength = useRef(items.length)
  const previousScrollHeight = useRef(0)

  useLayoutEffect(() => {
    // Find the <main> scroll container
    const scrollContainer = document.querySelector('main')
    if (!scrollContainer) return

    const itemsAdded = items.length - previousItemsLength.current

    // Only adjust if new items were added
    if (itemsAdded > 0) {
      // Get CURRENT scroll position (where user is NOW)
      const currentScrollTop = scrollContainer.scrollTop
      const currentClientHeight = scrollContainer.clientHeight

      // Get NEW scroll height (includes new items)
      const newScrollHeight = scrollContainer.scrollHeight

      // Get OLD scroll height (before new items were added)
      const oldScrollHeight = previousScrollHeight.current

      const heightAdded = newScrollHeight - oldScrollHeight

      if (reverseOrder) {
        // Newest first: Items added at top
        // Adjust scroll position by the height that was added (if not at very top)
        if (currentScrollTop > 10 && heightAdded > 0) {
          scrollContainer.scrollTop = currentScrollTop + heightAdded
        }
      } else {
        // Oldest first: Items added at bottom
        // Auto-scroll to bottom if user was at bottom
        const wasAtBottom = currentScrollTop + currentClientHeight >= oldScrollHeight - 50
        if (wasAtBottom) {
          scrollContainer.scrollTop = newScrollHeight - currentClientHeight
        }
      }
    }

    // Store current scroll height for next update
    previousScrollHeight.current = scrollContainer.scrollHeight
    previousItemsLength.current = items.length
  })
}

/**
 * VirtualizedMessageList Component (now just a simple list renderer)
 *
 * Renders a list of timeline messages/groups with scroll anchoring.
 * Virtualization has been removed as it added complexity without significant
 * performance benefits after markdown optimization.
 *
 * @param items - Timeline items to render
 * @param header - Optional header content to display before all items
 * @param reverseOrder - If true, applies scroll anchoring for "newest first" mode
 */
export function VirtualizedMessageList({
  items,
  header,
  reverseOrder = false,
}: VirtualizedMessageListProps) {
  // Apply scroll anchoring to prevent jumps when new messages arrive
  useScrollAnchoring(items, reverseOrder)

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
