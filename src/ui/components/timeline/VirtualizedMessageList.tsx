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
 */
export function VirtualizedMessageList({
  items,
  height = 'calc(100vh - 300px)',
  useWindowScroll = false,
  customScrollParent,
  onItemsRendered,
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

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={useCustomScroll ? {} : { height }}
      useWindowScroll={useWindowScroll}
      customScrollParent={customScrollParent}
      totalCount={items.length}
      itemContent={index => {
        const item = items[index]
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
          onItemsRendered(range.startIndex, range.endIndex)
        }
      }}
    />
  )
}

/**
 * Hook to scroll to a specific message in the virtualized list
 */
export function useScrollToMessage(listRef: React.RefObject<VirtuosoHandle>) {
  return (index: number, options?: { align?: 'start' | 'center' | 'end'; behavior?: 'auto' | 'smooth' }) => {
    if (listRef.current) {
      listRef.current.scrollToIndex({
        index,
        align: options?.align || 'start',
        behavior: options?.behavior || 'auto',
      })
    }
  }
}
