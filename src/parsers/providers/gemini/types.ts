/**
 * Gemini Code specific types
 */

import type { RawLogMessage } from '../../base/types.js'

/**
 * Gemini Code raw message format from JSONL logs
 */
export interface GeminiRawMessage extends RawLogMessage {
  uuid: string
  timestamp: string
  type: 'user' | 'gemini' | 'assistant' | 'tool_use' | 'tool_result'
  message: {
    role?: string
    content: unknown
  }
  sessionId: string
  gemini_model?: string
  gemini_thoughts?: unknown
  gemini_tokens?: unknown
  cwd?: string
}
