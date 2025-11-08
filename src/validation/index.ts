/**
 * Validation Module
 *
 * Provides validation utilities for canonical JSONL format.
 */

export {
  validateJSONL,
  generateValidationReport,
  type JSONLValidationOptions,
  type JSONLValidationResult,
} from './validator.js'

// Re-export validation functions and types from @guideai-dev/types
// Note: We don't re-export CanonicalMessage or ContentBlock to avoid conflicts with parsers
export {
  validateCanonicalMessage,
  validateSession,
  validateToolChain,
  validateTimestampOrdering,
  validateUUIDUniqueness,
  CanonicalMessageSchema,
  type ValidationIssue,
  type ValidationResult,
  type SessionValidationResult,
  type ValidationSeverity,
} from '@guideai-dev/types'
