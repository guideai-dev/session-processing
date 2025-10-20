import { describe, it, expect, beforeAll } from 'vitest'
import { ClaudeCodeProcessor } from '../index.js'
import { ClaudeCodeParser } from '../../../../parsers/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let SAMPLE_CLAUDE_SESSION: string

beforeAll(() => {
  const fixturePath = join(__dirname, 'fixtures', 'sample-claude-session.jsonl')
  SAMPLE_CLAUDE_SESSION = readFileSync(fixturePath, 'utf-8')
})

describe('ClaudeCodeProcessor', () => {
  describe('canProcess', () => {
    it('should detect valid Claude Code format', () => {
      const processor = new ClaudeCodeProcessor()
      expect(processor.canProcess(SAMPLE_CLAUDE_SESSION)).toBe(true)
    })

    it('should reject invalid format', () => {
      const processor = new ClaudeCodeProcessor()
      expect(processor.canProcess('not json')).toBe(false)
      expect(processor.canProcess('')).toBe(false)
    })

    it('should reject Codex format', () => {
      const processor = new ClaudeCodeProcessor()
      const codexFormat = `{"timestamp":"2025-10-06T20:15:35.486Z","type":"session_meta","payload":{"id":"test"}}`
      expect(processor.canProcess(codexFormat)).toBe(false)
    })

    it('should reject GitHub Copilot format', () => {
      const processor = new ClaudeCodeProcessor()
      const copilotFormat = `{"timestamp":"2025-10-06T20:15:35.486Z","type":"user","text":"test message"}`
      expect(processor.canProcess(copilotFormat)).toBe(false)
    })
  })

  describe('parseSession', () => {
    it('should parse valid Claude Code session', () => {
      const processor = new ClaudeCodeProcessor()
      const session = processor.parseSession(SAMPLE_CLAUDE_SESSION)

      expect(session.sessionId).toBe('claude-test-session-123')
      expect(session.provider).toBe('claude-code')
      expect(session.messages.length).toBeGreaterThan(0)
    })

    it('should extract session metadata', () => {
      const processor = new ClaudeCodeProcessor()
      const session = processor.parseSession(SAMPLE_CLAUDE_SESSION)

      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.duration).toBeGreaterThan(0)
    })

    it('should parse user and assistant messages', () => {
      const processor = new ClaudeCodeProcessor()
      const session = processor.parseSession(SAMPLE_CLAUDE_SESSION)

      const userMessages = session.messages.filter(m => m.type === 'user_input')
      const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')

      expect(userMessages.length).toBeGreaterThan(0)
      expect(assistantMessages.length).toBeGreaterThan(0)
    })

    it('should parse tool uses', () => {
      const processor = new ClaudeCodeProcessor()
      const session = processor.parseSession(SAMPLE_CLAUDE_SESSION)
      const parser = new ClaudeCodeParser()

      const toolUses = parser.extractToolUses(session)
      expect(toolUses.length).toBeGreaterThan(0)
      expect(toolUses[0]).toHaveProperty('name')
      expect(toolUses[0]).toHaveProperty('id')
    })

    it('should parse tool results', () => {
      const processor = new ClaudeCodeProcessor()
      const session = processor.parseSession(SAMPLE_CLAUDE_SESSION)
      const parser = new ClaudeCodeParser()

      const toolResults = parser.extractToolResults(session)
      expect(toolResults.length).toBeGreaterThan(0)
    })
  })

  describe('getMetricProcessors', () => {
    it('should return all 5 metric processors', () => {
      const processor = new ClaudeCodeProcessor()
      const metricProcessors = processor.getMetricProcessors()

      expect(metricProcessors.length).toBe(5)

      const metricTypes = metricProcessors.map(p => p.metricType)
      expect(metricTypes).toContain('performance')
      expect(metricTypes).toContain('engagement')
      expect(metricTypes).toContain('quality')
      expect(metricTypes).toContain('usage')
      expect(metricTypes).toContain('error')
    })
  })

  describe('processMetrics', () => {
    it('should process all metrics successfully', async () => {
      const processor = new ClaudeCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_CLAUDE_SESSION, {
        sessionId: 'claude-test-session-123',
        provider: 'claude-code',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      expect(results.length).toBeGreaterThan(0)

      const metricTypes = results.map(r => r.metricType)
      expect(metricTypes).toContain('performance')
      expect(metricTypes).toContain('engagement')
      expect(metricTypes).toContain('quality')
      expect(metricTypes).toContain('usage')
    })

    it('should calculate performance metrics', async () => {
      const processor = new ClaudeCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_CLAUDE_SESSION, {
        sessionId: 'claude-test-session-123',
        provider: 'claude-code',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const perfMetrics = results.find(r => r.metricType === 'performance')
      expect(perfMetrics).toBeDefined()
      expect(perfMetrics?.metrics).toHaveProperty('response_latency_ms')
      expect(perfMetrics?.metrics).toHaveProperty('task_completion_time_ms')
    })

    it('should calculate engagement metrics', async () => {
      const processor = new ClaudeCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_CLAUDE_SESSION, {
        sessionId: 'claude-test-session-123',
        provider: 'claude-code',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const engagementMetrics = results.find(r => r.metricType === 'engagement')
      expect(engagementMetrics).toBeDefined()
      expect(engagementMetrics?.metrics).toHaveProperty('interruption_rate')
      expect(engagementMetrics?.metrics).toHaveProperty('session_length_minutes')
    })

    it('should calculate quality metrics', async () => {
      const processor = new ClaudeCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_CLAUDE_SESSION, {
        sessionId: 'claude-test-session-123',
        provider: 'claude-code',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const qualityMetrics = results.find(r => r.metricType === 'quality')
      expect(qualityMetrics).toBeDefined()
      expect(qualityMetrics?.metrics).toHaveProperty('task_success_rate')
      expect(qualityMetrics?.metrics).toHaveProperty('iteration_count')
      expect(qualityMetrics?.metrics).toHaveProperty('process_quality_score')
    })

    it('should calculate usage metrics', async () => {
      const processor = new ClaudeCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_CLAUDE_SESSION, {
        sessionId: 'claude-test-session-123',
        provider: 'claude-code',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const usageMetrics = results.find(r => r.metricType === 'usage')
      expect(usageMetrics).toBeDefined()
      expect(usageMetrics?.metrics).toHaveProperty('read_write_ratio')
      expect(usageMetrics?.metrics).toHaveProperty('input_clarity_score')
    })
  })

  describe('getProcessorInfo', () => {
    it('should return processor information', () => {
      const processor = new ClaudeCodeProcessor()
      const info = processor.getProcessorInfo()

      expect(info.providerName).toBe('claude-code')
      expect(info.description).toBeTruthy()
      expect(info.metricProcessors.length).toBe(5)
      expect(info.version).toBe('1.0.0')
    })
  })
})
