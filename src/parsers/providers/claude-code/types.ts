/**
 * Claude Code specific types
 */

import type { ContentBlock } from '@guideai-dev/types'
import type { RawLogMessage } from '../../base/types.js'

/**
 * Token usage data from Claude API responses
 */
export interface ClaudeTokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens?: number
    ephemeral_1h_input_tokens?: number
  }
}

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
    usage?: ClaudeTokenUsage
  }
  content?: string | ContentBlock[]
  parentUuid?: string
  isMeta?: boolean
  isSidechain?: boolean
  sessionId: string
  userType?: string
  requestId?: string
  subtype?: string
  level?: string
}
