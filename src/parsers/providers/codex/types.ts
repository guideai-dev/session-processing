/**
 * Codex specific types
 */

import type { RawLogMessage } from '../../base/types.js'

/**
 * Codex raw message format from JSONL logs
 */
export interface CodexRawMessage extends RawLogMessage {
  id?: string
  timestamp: string
  type?: string
  messageID?: unknown
  sessionID?: unknown
  payload?: {
    type?: string
    [key: string]: unknown
  }
}
