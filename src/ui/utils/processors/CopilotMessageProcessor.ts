/**
 * GitHub Copilot Message Processor - Copilot-specific message processing
 *
 * Handles GitHub Copilot CLI message format and conventions.
 */

import type { BaseSessionMessage } from '../sessionTypes.js'
import { BaseMessageProcessor } from './BaseMessageProcessor.js'

export class CopilotMessageProcessor extends BaseMessageProcessor {
  name = 'github-copilot'

  /**
   * Copilot uses standard message types, so we can use the base implementation
   * but override if needed for Copilot-specific features
   */
  protected normalizeMessage(message: BaseSessionMessage) {
    return super.normalizeMessage(message)
  }

  /**
   * Override if needed for Copilot-specific display customization
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    return super.getDisplayMetadata(message)
  }
}
