/**
 * Gemini Message Processor - Processor for Gemini Code messages
 *
 * Handles Gemini-specific message processing including thoughts and token metadata.
 * Uses base processor logic with enhanced support for Gemini's inline tool call format.
 */

import { BaseMessageProcessor } from './BaseMessageProcessor.js'
import { BaseSessionMessage } from '../sessionTypes.js'
import { createDisplayMetadata, ContentBlock, createContentBlock } from '../timelineTypes.js'
import { CpuChipIcon } from '@heroicons/react/24/outline'

export class GeminiMessageProcessor extends BaseMessageProcessor {
  name = 'gemini-code'

  /**
   * Override to add Gemini-specific display metadata (thoughts, tokens)
   */
  protected getDisplayMetadata(message: BaseSessionMessage) {
    const baseMetadata = super.getDisplayMetadata(message)

    // Add Gemini-specific enhancements for assistant messages
    if (message.type === 'assistant_response' && message.metadata?.thoughts) {
      const thoughtCount = Array.isArray(message.metadata.thoughts)
        ? message.metadata.thoughts.length
        : 0

      return {
        ...baseMetadata,
        title: 'Gemini',
        IconComponent: CpuChipIcon,
        badge:
          thoughtCount > 0
            ? {
                text: `${thoughtCount} thought${thoughtCount === 1 ? '' : 's'}`,
                color: 'badge-primary',
              }
            : undefined,
      }
    }

    // For tool results, show tool name if available
    if (message.type === 'tool_result' && message.metadata?.toolName) {
      return {
        ...baseMetadata,
        title: `${message.metadata.toolName} result`,
      }
    }

    return baseMetadata
  }

  /**
   * Override to add thoughts as expandable content blocks for assistant messages
   */
  protected getConversationBlocks(message: BaseSessionMessage): ContentBlock[] {
    const blocks: ContentBlock[] = []

    // For assistant messages with thoughts, add thinking block first
    if (message.type === 'assistant_response' && message.metadata?.thoughts) {
      const thoughts = message.metadata.thoughts
      if (Array.isArray(thoughts) && thoughts.length > 0) {
        // Create thinking content block with all thoughts
        blocks.push(
          createContentBlock('thinking', thoughts, {
            collapsed: true,
            thoughtCount: thoughts.length,
          })
        )
      }
    }

    // Add regular conversation content (text, images, etc.)
    const conversationBlocks = super.getConversationBlocks(message)
    blocks.push(...conversationBlocks)

    return blocks
  }

  /**
   * Override to handle Gemini's inline tool result format
   */
  protected getToolResultBlocks(message: BaseSessionMessage): ContentBlock[] {
    const content = message.content?.content || message.content
    const toolName = message.metadata?.toolName

    // If we have structured sections (from inline parsing), create blocks for each
    if (message.metadata?.resultSections && Array.isArray(message.metadata.resultSections)) {
      const sections = message.metadata.resultSections

      if (sections.length > 0) {
        // Create a block showing the file paths and content
        const blocks: ContentBlock[] = []

        // Add a summary block
        blocks.push(
          createContentBlock('text', `Tool: ${toolName || 'unknown'} - ${sections.length} file(s)`)
        )

        // Add each file section
        for (const section of sections) {
          blocks.push(
            createContentBlock('code', section.content, {
              language: this.inferLanguageFromPath(section.path),
              collapsed: true,
            })
          )
        }

        return blocks
      }
    }

    // Fallback to base implementation
    return super.getToolResultBlocks(message)
  }

  /**
   * Override to extract tool use ID from Gemini's message format
   * Gemini tool_use messages have the ID directly as the message.id
   */
  protected extractToolUseId(message: BaseSessionMessage): string | null {
    // For Gemini, the tool_use message ID IS the tool use ID
    if (message.type === 'tool_use') {
      return message.id
    }

    // Also check metadata for toolName (legacy support)
    if (message.metadata?.toolName) {
      return message.id
    }

    return super.extractToolUseId(message)
  }

  /**
   * Override to extract tool result ID from Gemini's message format
   * Gemini tool_result messages have linkedTo field pointing to the tool_use
   */
  protected extractToolResultId(message: BaseSessionMessage): string | null {
    // Gemini stores the tool use ID in linkedTo field
    if (message.linkedTo) {
      return message.linkedTo
    }

    // Also check metadata
    if (message.metadata?.linkedTo) {
      return message.metadata.linkedTo
    }

    return super.extractToolResultId(message)
  }

  /**
   * Helper: Infer language from file path
   */
  private inferLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      sql: 'sql',
      css: 'css',
      scss: 'scss',
      html: 'html',
    }

    return languageMap[ext || ''] || 'text'
  }
}
