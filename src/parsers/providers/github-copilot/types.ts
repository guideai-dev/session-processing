/**
 * GitHub Copilot specific types
 */

import type { RawLogMessage } from '../../base/types.js'

/**
 * GitHub Copilot raw message format from JSONL logs
 */
export interface CopilotRawMessage extends RawLogMessage {
  id?: string
  timestamp: string
  type: 'user' | 'copilot' | 'info' | 'tool_call_requested' | 'tool_call_completed'
  text?: string
  callId?: string
  name?: string
  arguments?: Record<string, unknown>
  result?: unknown | { log?: string; type?: string }
  toolTitle?: string
  intentionSummary?: string
}
