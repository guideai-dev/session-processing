/**
 * Unified Parser System
 *
 * Single parsing layer for all AI provider session logs.
 * Replaces duplicate parsing logic from UI and backend.
 */

// Base classes and types
export { BaseParser } from './base/BaseParser.js'
export type {
  ContentPart,
  MessageContent,
  ParsedMessage,
  ParsedSession,
  PartsContent,
  RawLogMessage,
  SessionParser,
  UnifiedMessageType,
} from './base/types.js'

// Provider-specific parsers
export { ClaudeCodeParser } from './providers/claude-code/index.js'
export { GeminiParser } from './providers/gemini/index.js'
export { CopilotParser } from './providers/github-copilot/index.js'
export { CodexParser } from './providers/codex/index.js'
export { OpenCodeParser } from './providers/opencode/index.js'

// Provider types
export type { ClaudeRawMessage } from './providers/claude-code/types.js'
export type { GeminiRawMessage } from './providers/gemini/types.js'
export type { CopilotRawMessage } from './providers/github-copilot/types.js'
export type { CodexRawMessage } from './providers/codex/types.js'
export type { OpenCodeRawMessage } from './providers/opencode/types.js'

// Registry
export { ParserRegistry, parserRegistry } from './registry.js'
