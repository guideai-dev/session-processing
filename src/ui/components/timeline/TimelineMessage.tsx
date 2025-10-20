/**
 * TimelineMessage - Generic message container for timeline rendering
 *
 * This replaces the old MessageCard component with a provider-agnostic design.
 */

import type { TimelineMessage as TimelineMessageType } from '../../utils/timelineTypes.js'
import { ContentRenderer } from './ContentRenderer.js'
import { MessageHeader } from './MessageHeader.js'

interface TimelineMessageProps {
  message: TimelineMessageType
}

export function TimelineMessage({ message }: TimelineMessageProps) {
  const { displayMetadata, contentBlocks } = message

  return (
    <div
      className={`bg-base-100 border-l-4 ${displayMetadata.borderColor} rounded-r font-mono text-sm shadow-md`}
    >
      <div className="p-3">
        <MessageHeader displayMetadata={displayMetadata} />
        <ContentRenderer blocks={contentBlocks} />
      </div>
    </div>
  )
}
