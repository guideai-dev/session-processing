/**
 * VirtualizedMessageList - High-performance message list using react-virtuoso
 *
 * Only renders visible messages, dramatically improving performance for large sessions.
 * Supports both TimelineMessage and TimelineGroup items.
 *
 * react-virtuoso automatically handles dynamic heights without manual measurement.
 */

import { useRef } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'
import type { TimelineItem } from '../../utils/timelineTypes'
import { isTimelineGroup, isTimelineMessage } from '../../utils/timelineTypes'
import { TimelineGroup } from './TimelineGroup'
import { TimelineMessage } from './TimelineMessage'

interface VirtualizedMessageListProps {
  items: TimelineItem[]
  height?: number | string
  useWindowScroll?: boolean
  customScrollParent?: HTMLElement
  onItemsRendered?: (start: number, end: number) => void
  /** If true, items are assumed to be in reverse order (newest first) and new items prepend */
  reverseOrder?: boolean
}

/**
 * VirtualizedMessageList Component
 *
 * Renders a virtualized list of timeline messages/groups for optimal performance.
 * Only renders items that are currently visible in the viewport.
 *
 * Uses react-virtuoso which automatically handles dynamic heights.
 *
 * @param useWindowScroll - If true, uses the window/page scroll instead of internal scroll container
 * @param customScrollParent - Custom scroll container element (overrides useWindowScroll)
 * @param reverseOrder - If true, uses firstItemIndex to maintain scroll position when new items prepend
 */
export function VirtualizedMessageList({
  items,
  height = 'calc(100vh - 300px)',
  useWindowScroll = false,
  customScrollParent,
  onItemsRendered,
  reverseOrder = false,
}: VirtualizedMessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  // Show empty state
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-base-content/50">No messages to display</div>
      </div>
    )
  }

  // Determine if we're using custom scroll
  const useCustomScroll = customScrollParent !== undefined || useWindowScroll

  // When items are in reverse order (newest first), use firstItemIndex to maintain
  // scroll position when new items are prepended to the top of the list
  // We use a large base number (100000) and subtract the item count to create
  // a stable index that decreases as items are added
  const firstItemIndex = reverseOrder ? 100000 - items.length : 0

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={useCustomScroll ? { height: '100%' } : { height }}
      useWindowScroll={useWindowScroll}
      customScrollParent={customScrollParent}
      totalCount={items.length}
      firstItemIndex={firstItemIndex}
      itemContent={index => {
        // When using firstItemIndex, the index is offset
        // Convert back to array index
        const arrayIndex = index - firstItemIndex
        const item = items[arrayIndex]

        // If item doesn't exist, return empty div to avoid zero-sized element error
        if (!item) {
          return <div style={{ height: 1 }} />
        }

        // Wrap in div with padding-bottom for consistent spacing
        return (
          <div style={{ paddingBottom: '0.5rem' }}>
            {isTimelineMessage(item) ? (
              <TimelineMessage message={item} />
            ) : isTimelineGroup(item) ? (
              <TimelineGroup group={item} />
            ) : null}
          </div>
        )
      }}
      rangeChanged={range => {
        if (onItemsRendered && range) {
          // Convert virtuoso indices back to array indices
          const startArrayIndex = range.startIndex - firstItemIndex
          const endArrayIndex = range.endIndex - firstItemIndex
          onItemsRendered(startArrayIndex, endArrayIndex)
        }
      }}
    />
  )
}

/**
 * Hook to scroll to a specific message in the virtualized list
 */
export function useScrollToMessage(listRef: React.RefObject<VirtuosoHandle>) {
  return (
    index: number,
    options?: { align?: 'start' | 'center' | 'end'; behavior?: 'auto' | 'smooth' }
  ) => {
    if (listRef.current) {
      listRef.current.scrollToIndex({
        index,
        align: options?.align || 'start',
        behavior: options?.behavior || 'auto',
      })
    }
  }
}
