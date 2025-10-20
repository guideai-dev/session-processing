import { describe, it, expect, beforeAll } from 'vitest'
import { OpenCodeProcessor } from '../index.js'
import { OpenCodeParser } from '../../../../parsers/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let SAMPLE_OPENCODE_SESSION: string

beforeAll(() => {
  const fixturePath = join(__dirname, 'fixtures', 'sample-opencode-session.jsonl')
  SAMPLE_OPENCODE_SESSION = readFileSync(fixturePath, 'utf-8')
})

describe('OpenCodeProcessor', () => {
  describe('canProcess', () => {
    it('should detect valid OpenCode format', () => {
      const processor = new OpenCodeProcessor()
      expect(processor.canProcess(SAMPLE_OPENCODE_SESSION)).toBe(true)
    })

    it('should reject invalid format', () => {
      const processor = new OpenCodeProcessor()
      expect(processor.canProcess('not json')).toBe(false)
      expect(processor.canProcess('')).toBe(false)
    })

    it('should reject Claude Code format', () => {
      const processor = new OpenCodeProcessor()
      const claudeFormat = `{"uuid":"123","timestamp":"2025-10-06T20:15:35.486Z","type":"user","message":{"role":"user","content":"test"}}`
      expect(processor.canProcess(claudeFormat)).toBe(false)
    })

    it('should reject GitHub Copilot format', () => {
      const processor = new OpenCodeProcessor()
      const copilotFormat = `{"timestamp":"2025-10-06T20:15:35.486Z","type":"user","text":"test message"}`
      expect(processor.canProcess(copilotFormat)).toBe(false)
    })
  })

  describe('parseSession', () => {
    it('should parse valid OpenCode session', () => {
      const processor = new OpenCodeProcessor()
      const session = processor.parseSession(SAMPLE_OPENCODE_SESSION)

      expect(session.sessionId).toBe('ses_6433a3b58ffe3hCF9glBj1wufi')
      expect(session.provider).toBe('opencode')
      expect(session.messages.length).toBeGreaterThan(0)
    })

    it('should extract session metadata', () => {
      const processor = new OpenCodeProcessor()
      const session = processor.parseSession(SAMPLE_OPENCODE_SESSION)

      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.duration).toBeGreaterThan(0)
    })

    it('should parse user and assistant messages', () => {
      const processor = new OpenCodeProcessor()
      const session = processor.parseSession(SAMPLE_OPENCODE_SESSION)

      const userMessages = session.messages.filter(m => m.type === 'user_input')
      const assistantMessages = session.messages.filter(m => m.type === 'assistant_response')

      expect(userMessages.length).toBeGreaterThan(0)
      expect(assistantMessages.length).toBeGreaterThan(0)
    })

    it('should parse tool uses', () => {
      const processor = new OpenCodeProcessor()
      const session = processor.parseSession(SAMPLE_OPENCODE_SESSION)
      const parser = new OpenCodeParser()

      const toolUses = parser.extractToolUses(session)
      expect(toolUses.length).toBeGreaterThan(0)
      expect(toolUses[0]).toHaveProperty('name')
      expect(toolUses[0]).toHaveProperty('id')
    })

    it('should parse tool results', () => {
      const processor = new OpenCodeProcessor()
      const session = processor.parseSession(SAMPLE_OPENCODE_SESSION)
      const parser = new OpenCodeParser()

      const toolResults = parser.extractToolResults(session)
      expect(toolResults.length).toBeGreaterThan(0)
    })
  })

  describe('getMetricProcessors', () => {
    it('should return all 5 metric processors', () => {
      const processor = new OpenCodeProcessor()
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
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      expect(results.length).toBeGreaterThan(0)

      // Check that each metric type is present
      const metricTypes = results.map(r => r.metricType)
      expect(metricTypes).toContain('performance')
      expect(metricTypes).toContain('engagement')
      expect(metricTypes).toContain('quality')
      expect(metricTypes).toContain('usage')
    })

    it('should calculate performance metrics with real values', async () => {
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const perfMetrics = results.find(r => r.metricType === 'performance')
      expect(perfMetrics).toBeDefined()
      expect(perfMetrics?.metrics).toHaveProperty('response_latency_ms')
      expect(perfMetrics?.metrics).toHaveProperty('task_completion_time_ms')

      // Verify we have real values, not just 0
      expect(perfMetrics?.metrics.task_completion_time_ms).toBeGreaterThan(0)
    })

    it('should calculate engagement metrics with real values', async () => {
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const engagementMetrics = results.find(r => r.metricType === 'engagement')
      expect(engagementMetrics).toBeDefined()
      expect(engagementMetrics?.metrics).toHaveProperty('interruption_rate')
      expect(engagementMetrics?.metrics).toHaveProperty('session_length_minutes')

      // Verify session length is calculated
      expect(engagementMetrics?.metrics.session_length_minutes).toBeGreaterThanOrEqual(0)
    })

    it('should calculate quality metrics with real values', async () => {
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const qualityMetrics = results.find(r => r.metricType === 'quality')
      expect(qualityMetrics).toBeDefined()
      expect(qualityMetrics?.metrics).toHaveProperty('task_success_rate')
      expect(qualityMetrics?.metrics).toHaveProperty('iteration_count')
      expect(qualityMetrics?.metrics).toHaveProperty('process_quality_score')

      // Verify we have real values - should be 100% since all tool results succeeded
      expect(qualityMetrics?.metrics.task_success_rate).toBe(100)
      expect(qualityMetrics?.metrics.iteration_count).toBeGreaterThanOrEqual(0)
      expect(qualityMetrics?.metrics.process_quality_score).toBeGreaterThanOrEqual(0)

    })

    it('should calculate usage metrics with real values', async () => {
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const usageMetrics = results.find(r => r.metricType === 'usage')
      expect(usageMetrics).toBeDefined()
      expect(usageMetrics?.metrics).toHaveProperty('read_write_ratio')
      expect(usageMetrics?.metrics).toHaveProperty('input_clarity_score')

      // Verify we have real values
      expect(usageMetrics?.metrics.read_write_ratio).toBeGreaterThanOrEqual(0)
      expect(usageMetrics?.metrics.input_clarity_score).toBeGreaterThanOrEqual(0)
      expect(usageMetrics?.metrics.input_clarity_score).toBeLessThanOrEqual(100)
    })

    it('should calculate error metrics', async () => {
      const processor = new OpenCodeProcessor()
      const results = await processor.processMetrics(SAMPLE_OPENCODE_SESSION, {
        sessionId: 'ses_6433a3b58ffe3hCF9glBj1wufi',
        provider: 'opencode',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const errorMetrics = results.find(r => r.metricType === 'error')
      expect(errorMetrics).toBeDefined()
      expect(errorMetrics?.metrics).toHaveProperty('error_count')
      expect(errorMetrics?.metrics).toHaveProperty('error_types')
      expect(errorMetrics?.metrics).toHaveProperty('recovery_attempts')
      expect(errorMetrics?.metrics).toHaveProperty('fatal_errors')

      // Verify we have valid values
      expect(errorMetrics?.metrics.error_count).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(errorMetrics?.metrics.error_types)).toBe(true)

    })
  })

  describe('getProcessorInfo', () => {
    it('should return processor information', () => {
      const processor = new OpenCodeProcessor()
      const info = processor.getProcessorInfo()

      expect(info.providerName).toBe('opencode')
      expect(info.description).toBeTruthy()
      expect(info.metricProcessors.length).toBe(5)
    })
  })
})
