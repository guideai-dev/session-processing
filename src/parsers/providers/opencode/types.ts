/**
 * OpenCode specific types
 */

import type { ContentBlock } from '@guideai-dev/types'
import type { RawLogMessage } from '../../base/types.js'

/**
 * OpenCode raw message format from JSONL logs
 */
export interface OpenCodeRawMessage extends RawLogMessage {
  timestamp: string
  sessionId: string
  type?: 'user' | 'assistant' | 'tool_use' | 'tool_result'
  message?: {
    role?: string
    content?: string | ContentBlock[]
  }
}
