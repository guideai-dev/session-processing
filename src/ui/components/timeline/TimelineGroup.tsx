/**
 * TimelineGroup - Renders grouped messages (e.g., tool use + result side-by-side)
 */

import { TimelineGroup as TimelineGroupType } from '../../utils/timelineTypes.js'
import { TimelineMessage } from './TimelineMessage.js'

interface TimelineGroupProps {
  group: TimelineGroupType
}

export function TimelineGroup({ group }: TimelineGroupProps) {
  const [leftMessage, rightMessage] = group.messages

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
      <div>
        <TimelineMessage message={leftMessage} />
      </div>
      <div>
        <TimelineMessage message={rightMessage} />
      </div>
    </div>
  )
}
