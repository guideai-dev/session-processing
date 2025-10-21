import { describe, it, expect, beforeAll } from 'vitest'
import { GitHubCopilotProcessor } from '../../../../src/processors/providers/github-copilot/index.js'
import { CopilotParser } from '../../../../src/parsers/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let SAMPLE_COPILOT_SESSION: string

beforeAll(() => {
  const fixturePath = join(__dirname, 'fixtures', 'sample-copilot-session.jsonl')
  SAMPLE_COPILOT_SESSION = readFileSync(fixturePath, 'utf-8')
})

describe('GitHubCopilotProcessor', () => {
  describe('canProcess', () => {
    it('should detect valid GitHub Copilot format', () => {
      const processor = new GitHubCopilotProcessor()
      expect(processor.canProcess(SAMPLE_COPILOT_SESSION)).toBe(true)
    })

    it('should reject invalid format', () => {
      const processor = new GitHubCopilotProcessor()
      expect(processor.canProcess('not json')).toBe(false)
      expect(processor.canProcess('')).toBe(false)
    })

    it('should reject Codex format', () => {
      const processor = new GitHubCopilotProcessor()
      const codexFormat = `{"timestamp":"2025-10-06T20:15:35.486Z","type":"session_meta","payload":{"id":"test"}}`
      expect(processor.canProcess(codexFormat)).toBe(false)
    })

    it('should accept Claude Code format that looks similar', () => {
      const processor = new GitHubCopilotProcessor()
      const claudeFormat = `{"uuid":"123","timestamp":"2025-10-06T20:15:35.486Z","type":"user","message":{"role":"user","content":"test"}}`
      expect(processor.canProcess(claudeFormat)).toBe(true)
    })
  })

  describe('parseSession', () => {
    it('should parse valid GitHub Copilot session', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)

      expect(session.sessionId).toMatch(/^copilot-\d+$/)
      expect(session.provider).toBe('github-copilot')
      expect(session.messages.length).toBeGreaterThan(0)
    })

    it('should extract session metadata', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)

      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.duration).toBeGreaterThan(0)
    })

    it('should parse user and copilot messages', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)

      const userMessages = session.messages.filter(m => m.type === 'user_input')
      const copilotMessages = session.messages.filter(m => m.type === 'assistant_response')

      expect(userMessages.length).toBeGreaterThan(0)
      expect(copilotMessages.length).toBeGreaterThan(0)
    })

    it('should parse tool uses', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)
      const parser = new CopilotParser()

      const toolUses = parser.extractToolUses(session)
      expect(toolUses.length).toBeGreaterThan(0)
      expect(toolUses[0]).toHaveProperty('name')
      expect(toolUses[0]).toHaveProperty('id')
    })

    it('should parse tool results', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)
      const parser = new CopilotParser()

      const toolResults = parser.extractToolResults(session)
      expect(toolResults.length).toBeGreaterThan(0)
    })

    it('should match tool uses with tool results', () => {
      const processor = new GitHubCopilotProcessor()
      const session = processor.parseSession(SAMPLE_COPILOT_SESSION)
      const parser = new CopilotParser()

      const toolUses = parser.extractToolUses(session)
      const toolResults = parser.extractToolResults(session)

      // Should have matching counts (2 tool_call_requested + 2 tool_call_completed in fixture)
      expect(toolUses.length).toBe(2)
      expect(toolResults.length).toBe(2)

      // Each tool result should reference a tool use
      for (const result of toolResults) {
        const matchingUse = toolUses.find(use => use.id === result.tool_use_id)
        expect(matchingUse).toBeDefined()
      }
    })
  })

  describe('getMetricProcessors', () => {
    it('should return all 5 metric processors', () => {
      const processor = new GitHubCopilotProcessor()
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
      const processor = new GitHubCopilotProcessor()
      const results = await processor.processMetrics(SAMPLE_COPILOT_SESSION, {
        sessionId: 'copilot-test-123',
        provider: 'github-copilot',
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
      const processor = new GitHubCopilotProcessor()
      const results = await processor.processMetrics(SAMPLE_COPILOT_SESSION, {
        sessionId: 'copilot-test-123',
        provider: 'github-copilot',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const perfMetrics = results.find(r => r.metricType === 'performance')
      expect(perfMetrics).toBeDefined()
      expect(perfMetrics?.metrics).toHaveProperty('response_latency_ms')
      expect(perfMetrics?.metrics).toHaveProperty('task_completion_time_ms')
    })

    it('should calculate engagement metrics', async () => {
      const processor = new GitHubCopilotProcessor()
      const results = await processor.processMetrics(SAMPLE_COPILOT_SESSION, {
        sessionId: 'copilot-test-123',
        provider: 'github-copilot',
        tenantId: 'test-tenant',
        userId: 'test-user'
      })

      const engagementMetrics = results.find(r => r.metricType === 'engagement')
      expect(engagementMetrics).toBeDefined()
      expect(engagementMetrics?.metrics).toHaveProperty('interruption_rate')
      expect(engagementMetrics?.metrics).toHaveProperty('session_length_minutes')
    })

    it('should calculate quality metrics', async () => {
      const processor = new GitHubCopilotProcessor()
      const results = await processor.processMetrics(SAMPLE_COPILOT_SESSION, {
        sessionId: 'copilot-test-123',
        provider: 'github-copilot',
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
      const processor = new GitHubCopilotProcessor()
      const results = await processor.processMetrics(SAMPLE_COPILOT_SESSION, {
        sessionId: 'copilot-test-123',
        provider: 'github-copilot',
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
      const processor = new GitHubCopilotProcessor()
      const info = processor.getProcessorInfo()

      expect(info.providerName).toBe('github-copilot')
      expect(info.description).toBeTruthy()
      expect(info.metricProcessors.length).toBe(5)
      expect(info.version).toBe('1.0.0')
    })
  })
})
