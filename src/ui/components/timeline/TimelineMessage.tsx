/**
 * TimelineMessage - Generic message container for timeline rendering
 *
 * This replaces the old MessageCard component with a provider-agnostic design.
 */

import type { TimelineMessage as TimelineMessageType } from '../../utils/timelineTypes.js'
import { useState } from 'react'
import { ContentRenderer } from './ContentRenderer.js'
import { DebugModal } from './DebugModal.js'
import { MessageHeader } from './MessageHeader.js'

interface TimelineMessageProps {
  message: TimelineMessageType
}

export function TimelineMessage({ message }: TimelineMessageProps) {
  const { displayMetadata, contentBlocks, id, originalMessage, displayType } = message
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false)

  const handleIconClick = (event: React.MouseEvent) => {
    // Only open debug modal if shift key is pressed
    if (event.shiftKey) {
      event.preventDefault()
      setIsDebugModalOpen(true)
    }
  }

  return (
    <>
      <div
        data-message-id={id}
        className={`bg-base-100 border-l-4 ${displayMetadata.borderColor} rounded-r font-mono text-sm shadow-md`}
      >
        <div className="p-3">
          <MessageHeader displayMetadata={displayMetadata} onIconClick={handleIconClick} />
          <ContentRenderer blocks={contentBlocks} />
        </div>
      </div>

      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        message={originalMessage}
        messageDisplayType={displayType}
      />
    </>
  )
}
