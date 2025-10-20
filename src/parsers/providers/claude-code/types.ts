/**
 * Claude Code specific types
 */

import type { ContentBlock } from '@guideai-dev/types'
import type { RawLogMessage } from '../../base/types.js'

/**
 * Claude Code raw message format from JSONL logs
 */
export interface ClaudeRawMessage extends RawLogMessage {
  uuid: string
  timestamp: string
  type: 'user' | 'assistant' | 'summary'
  message: {
    role: string
    content: string | ContentBlock[]
  }
  content?: string | ContentBlock[]
  parentUuid?: string
  isMeta?: boolean
  sessionId: string
  userType?: string
  requestId?: string
  subtype?: string
  level?: string
}
