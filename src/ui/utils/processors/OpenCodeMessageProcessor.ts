/**
 * OpenCode Message Processor - OpenCode-specific message processing
 *
 * OpenCode uses Claude-like message format (Anthropic Messages API style).
 * Most logic is handled by base processor; this adds OpenCode-specific branding.
 */

import type { BaseSessionMessage } from '../sessionTypes.js'
import { createDisplayMetadata } from '../timelineTypes.js'
import { BaseMessageProcessor } from './BaseMessageProcessor.js'

export class OpenCodeMessageProcessor extends BaseMessageProcessor {
  name = 'opencode'

  /**
   * Override display metadata to add OpenCode branding
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    // Use base implementation but could customize icons/colors for OpenCode brand
    const metadata = super.getDisplayMetadata(message)

    // Could add OpenCode-specific styling/badges here if needed
    // For now, just use the standard Claude-like rendering

    return metadata
  }
}
