/**
 * Timeline Types - Normalized message structure for provider-agnostic rendering
 *
 * This module defines the normalized message types used for rendering session timelines.
 * These types provide a consistent interface regardless of the underlying provider (Claude, OpenCode, Codex, etc.)
 */

import React from 'react'
import { BaseSessionMessage } from './sessionTypes.js'

/**
 * Content block types that can appear in a timeline message
 */
export type ContentBlockType = 'text' | 'code' | 'image' | 'json' | 'tool_use' | 'tool_result'

/**
 * Display type for timeline messages
 * - single: Standalone message
 * - group: Grouped messages (e.g., tool use + result)
 */
export type TimelineDisplayType = 'single' | 'group'

/**
 * Message role in the conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/**
 * A single content block within a timeline message
 */
export interface ContentBlock {
  type: ContentBlockType
  content: any
  metadata?: {
    language?: string // For code blocks
    format?: string // For images (png, jpg, etc.)
    collapsed?: boolean // For json/tool blocks
    toolName?: string // For tool blocks
    toolUseId?: string // For tool result blocks
    [key: string]: any // Additional provider-specific metadata
  }
}

/**
 * Display metadata for rendering hints
 */
export interface DisplayMetadata {
  icon: string // Short text icon (e.g., "USR", "AST", "TOOL")
  IconComponent?: React.ComponentType<{ className?: string }> // HeroIcon component
  iconColor?: string // Tailwind color class for icon (e.g., "text-info")
  title: string // Human-readable title
  borderColor: string // Tailwind color class (e.g., "border-l-info")
  badge?: {
    text: string
    color: string // Tailwind color class
  }
}

/**
 * Normalized timeline message for rendering
 */
export interface TimelineMessage {
  id: string
  timestamp: string
  displayType: TimelineDisplayType
  role: MessageRole
  displayMetadata: DisplayMetadata
  contentBlocks: ContentBlock[]
  originalMessage: BaseSessionMessage // Keep reference to original for debugging
}

/**
 * Grouped timeline messages (e.g., tool use + result displayed side-by-side)
 */
export interface TimelineGroup {
  id: string
  displayType: 'group'
  timestamp: string
  messages: [TimelineMessage, TimelineMessage] // Always exactly 2 messages in a group
  groupType: 'tool_pair' // Can be extended for other group types
}

/**
 * Union type for timeline items (can be single message or group)
 */
export type TimelineItem = TimelineMessage | TimelineGroup

/**
 * Result of message processing pipeline
 */
export interface ProcessedTimeline {
  items: TimelineItem[]
  metadata: {
    totalMessages: number
    groupedPairs: number
    provider: string
  }
}

/**
 * Type guards
 */
export function isTimelineGroup(item: TimelineItem): item is TimelineGroup {
  return item.displayType === 'group'
}

export function isTimelineMessage(item: TimelineItem): item is TimelineMessage {
  return item.displayType === 'single'
}

/**
 * Helper function to create display metadata with defaults
 */
export function createDisplayMetadata(
  partial: Partial<DisplayMetadata>,
): DisplayMetadata {
  return {
    icon: partial.icon || 'MSG',
    IconComponent: partial.IconComponent,
    iconColor: partial.iconColor,
    title: partial.title || 'Message',
    borderColor: partial.borderColor || 'border-l-neutral',
    badge: partial.badge,
  }
}

/**
 * Helper function to create a content block
 */
export function createContentBlock(
  type: ContentBlockType,
  content: any,
  metadata?: ContentBlock['metadata'],
): ContentBlock {
  return {
    type,
    content,
    metadata,
  }
}
