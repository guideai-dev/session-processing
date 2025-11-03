/**
 * CanonicalParser Tests
 *
 * Tests for the unified canonical parser that handles all providers
 */

import { describe, expect, it } from 'vitest'
import { CanonicalParser } from '../../../src/parsers/canonical/parser.js'

describe('CanonicalParser', () => {
  const parser = new CanonicalParser()

  describe('canParse', () => {
    it('should detect canonical format with user message', () => {
      const canonicalJsonl = `{"uuid":"123","sessionId":"session-1","type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2025-10-01T00:00:00Z","provider":"claude-code"}`

      expect(parser.canParse(canonicalJsonl)).toBe(true)
    })

    it('should detect canonical format with assistant message', () => {
      const canonicalJsonl = `{"uuid":"456","sessionId":"session-1","type":"assistant","message":{"role":"assistant","content":"Hi there"},"timestamp":"2025-10-01T00:00:01Z","provider":"gemini-code"}`

      expect(parser.canParse(canonicalJsonl)).toBe(true)
    })

    it('should detect canonical format with meta message', () => {
      const canonicalJsonl = `{"uuid":"789","sessionId":"session-1","type":"meta","message":{"role":"system","content":"Session started"},"timestamp":"2025-10-01T00:00:00Z","provider":"codex"}`

      expect(parser.canParse(canonicalJsonl)).toBe(true)
    })

    it('should reject non-canonical format', () => {
      const nonCanonical = `{"id":"123","content":"Hello"}`

      expect(parser.canParse(nonCanonical)).toBe(false)
    })

    it('should reject empty content', () => {
      expect(parser.canParse('')).toBe(false)
    })

    it('should reject invalid JSON', () => {
      expect(parser.canParse('not json')).toBe(false)
    })
  })

  describe('parseMessage', () => {
    it('should parse text message', () => {
      const rawMessage = {
        uuid: 'msg-1',
        timestamp: '2025-10-01T00:00:00Z',
        type: 'user',
        sessionId: 'session-1',
        provider: 'claude-code',
        cwd: '/test',
        gitBranch: 'main',
        message: {
          role: 'user',
          content: 'Hello, world!',
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        type: 'user',
        content: 'Hello, world!',
        metadata: {
          role: 'user',
          sessionId: 'session-1',
          provider: 'claude-code',
          cwd: '/test',
          gitBranch: 'main',
        },
      })
    })

    it('should parse assistant message with model and usage', () => {
      const rawMessage = {
        uuid: 'msg-2',
        timestamp: '2025-10-01T00:00:01Z',
        type: 'assistant',
        sessionId: 'session-1',
        provider: 'gemini-code',
        message: {
          role: 'assistant',
          content: 'Hello!',
          model: 'claude-sonnet-4.5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'msg-2',
        type: 'assistant',
        content: 'Hello!',
        metadata: {
          model: 'claude-sonnet-4.5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        },
      })
    })

    it('should parse structured message with text and tool blocks', () => {
      const rawMessage = {
        uuid: 'msg-3',
        timestamp: '2025-10-01T00:00:02Z',
        type: 'assistant',
        sessionId: 'session-1',
        provider: 'claude-code',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me help with that.' },
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/test.ts' } },
          ],
        },
      }

      const result = parser.parseMessage(rawMessage)

      // Should split into 2 messages: assistant text + tool_use
      expect(result).toHaveLength(2)

      // First message: assistant with text
      expect(result[0].type).toBe('assistant')
      expect(result[0].id).toBe('msg-3')
      expect(result[0].content).toBe('Let me help with that.')

      // Second message: tool_use
      expect(result[1].type).toBe('tool_use')
      expect(result[1].id).toBe('msg-3-tool-tool-1')
      expect(result[1].content).toMatchObject({
        type: 'structured',
        toolUses: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { file_path: '/test.ts' },
          },
        ],
      })
      expect(result[1].parentId).toBe('msg-3')
    })

    it('should parse message with tool_result block', () => {
      const rawMessage = {
        uuid: 'msg-4',
        timestamp: '2025-10-01T00:00:03Z',
        type: 'user',
        sessionId: 'session-1',
        provider: 'claude-code',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'File content here',
              is_error: false,
            },
          ],
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result).toHaveLength(1)
      // Should have type 'tool_result', not 'user'
      expect(result[0].type).toBe('tool_result')
      expect(result[0].id).toBe('msg-4-result-tool-1')
      expect(result[0].linkedTo).toBe('tool-1')
      expect(result[0].content).toMatchObject({
        type: 'structured',
        toolResults: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'File content here',
            is_error: false,
          },
        ],
      })
    })

    it('should preserve provider metadata', () => {
      const rawMessage = {
        uuid: 'msg-5',
        timestamp: '2025-10-01T00:00:04Z',
        type: 'assistant',
        sessionId: 'session-1',
        provider: 'gemini-code',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        providerMetadata: {
          gemini_type: 'gemini',
          has_thoughts: true,
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result[0].metadata.providerMetadata).toEqual({
        gemini_type: 'gemini',
        has_thoughts: true,
      })
    })

    it('should handle parent UUID', () => {
      const rawMessage = {
        uuid: 'msg-6',
        timestamp: '2025-10-01T00:00:05Z',
        type: 'user',
        sessionId: 'session-1',
        provider: 'claude-code',
        parentUuid: 'msg-5',
        message: {
          role: 'user',
          content: 'Follow-up',
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result[0].parentId).toBe('msg-5')
    })

    it('should return empty array for invalid message', () => {
      const invalidMessage = {
        notACanonicalMessage: true,
      }

      const result = parser.parseMessage(invalidMessage)

      expect(result).toEqual([])
    })

    it('should return empty array for message with invalid timestamp', () => {
      const rawMessage = {
        uuid: 'msg-7',
        timestamp: 'invalid-timestamp',
        type: 'user',
        sessionId: 'session-1',
        provider: 'claude-code',
        message: {
          role: 'user',
          content: 'Test',
        },
      }

      const result = parser.parseMessage(rawMessage)

      expect(result).toEqual([])
    })
  })

  describe('parseSession', () => {
    it('should parse complete canonical session', () => {
      const jsonl = [
        '{"uuid":"msg-1","timestamp":"2025-10-01T00:00:00Z","type":"user","sessionId":"session-1","provider":"claude-code","message":{"role":"user","content":"Hello"}}',
        '{"uuid":"msg-2","timestamp":"2025-10-01T00:00:01Z","type":"assistant","sessionId":"session-1","provider":"claude-code","message":{"role":"assistant","content":"Hi","model":"claude-sonnet-4.5","usage":{"input_tokens":10,"output_tokens":5}}}',
        '{"uuid":"msg-3","timestamp":"2025-10-01T00:00:02Z","type":"user","sessionId":"session-1","provider":"claude-code","message":{"role":"user","content":"Thanks"}}',
      ].join('\n')

      const session = parser.parseSession(jsonl)

      expect(session.sessionId).toBe('session-1')
      expect(session.provider).toBe('canonical')
      expect(session.messages).toHaveLength(3)
      expect(session.messages[0].type).toBe('user')
      expect(session.messages[1].type).toBe('assistant')
      expect(session.messages[2].type).toBe('user')
    })

    it('should calculate session duration', () => {
      const jsonl = [
        '{"uuid":"msg-1","timestamp":"2025-10-01T00:00:00Z","type":"user","sessionId":"session-1","provider":"claude-code","message":{"role":"user","content":"Start"}}',
        '{"uuid":"msg-2","timestamp":"2025-10-01T00:05:00Z","type":"assistant","sessionId":"session-1","provider":"claude-code","message":{"role":"assistant","content":"End"}}',
      ].join('\n')

      const session = parser.parseSession(jsonl)

      expect(session.duration).toBe(5 * 60 * 1000) // 5 minutes in ms
    })

    it('should count messages and lines', () => {
      const jsonl = [
        '{"uuid":"msg-1","timestamp":"2025-10-01T00:00:00Z","type":"user","sessionId":"session-1","provider":"claude-code","message":{"role":"user","content":"One"}}',
        '{"uuid":"msg-2","timestamp":"2025-10-01T00:00:01Z","type":"assistant","sessionId":"session-1","provider":"claude-code","message":{"role":"assistant","content":"Two"}}',
      ].join('\n')

      const session = parser.parseSession(jsonl)

      expect(session.metadata.messageCount).toBe(2)
      expect(session.metadata.lineCount).toBe(2)
    })
  })

  describe('extractSessionId', () => {
    it('should extract sessionId from canonical message', () => {
      const rawMessage = {
        sessionId: 'test-session-id',
        uuid: 'msg-1',
        timestamp: '2025-10-01T00:00:00Z',
        type: 'user',
        provider: 'claude-code',
        message: { role: 'user', content: 'Test' },
      }

      const result = (parser as any).extractSessionId(rawMessage)

      expect(result).toBe('test-session-id')
    })
  })
})
