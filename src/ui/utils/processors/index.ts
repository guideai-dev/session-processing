/**
 * Processors - Message processing layer for timeline rendering
 *
 * After canonical format migration, all providers use CanonicalMessageProcessor.
 * Provider-specific processors have been removed as they are no longer needed.
 */

export { BaseMessageProcessor } from './BaseMessageProcessor.js'
export { CanonicalMessageProcessor } from './CanonicalMessageProcessor.js'
export { GenericMessageProcessor } from './GenericMessageProcessor.js'
export { processorRegistry as messageProcessorRegistry } from './ProcessorRegistry.js'
