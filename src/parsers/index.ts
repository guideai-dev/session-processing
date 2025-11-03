/**
 * Unified Parser System - Phase 2 Complete
 *
 * Single canonical parser for all AI provider session logs.
 * All providers now output canonical JSONL format, eliminating
 * the need for provider-specific parsers.
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

// Canonical parser (handles all providers)
export { CanonicalParser } from './canonical/index.js'
export type {
  CanonicalContentBlock,
  CanonicalMessage,
  CanonicalMessageType,
  ContentValue,
  TokenUsage,
} from './canonical/index.js'

// Registry
export { ParserRegistry, parserRegistry } from './registry.js'
