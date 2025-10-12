import { describe, test, expect } from 'vitest'
import { GeminiProcessor, GeminiParser } from '../index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('GeminiProcessor', () => {
  const processor = new GeminiProcessor()

  describe('canProcess', () => {
    test('should accept valid Gemini session JSON', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      expect(processor.canProcess(content)).toBe(true)
    })

    test('should reject JSONL format', () => {
      const jsonl = '{"uuid":"123","type":"user"}\n{"uuid":"456","type":"assistant"}'
      expect(processor.canProcess(jsonl)).toBe(false)
    })

    test('should reject JSON without Gemini-specific fields', () => {
      const json = JSON.stringify({
        sessionId: '123',
        messages: [{ id: '1', type: 'user', content: 'test' }]
      })
      expect(processor.canProcess(json)).toBe(false)
    })

    test('should accept JSON with projectHash and thoughts', () => {
      const json = JSON.stringify({
        sessionId: '123',
        projectHash: 'abc123',
        messages: [{
          id: '1',
          type: 'gemini',
          content: 'test',
          thoughts: [{ subject: 'test', description: 'test', timestamp: '2025-01-01T00:00:00Z' }]
        }]
      })
      expect(processor.canProcess(json)).toBe(true)
    })

    test('should accept JSON with projectHash and cached tokens', () => {
      const json = JSON.stringify({
        sessionId: '123',
        projectHash: 'abc123',
        messages: [{
          id: '1',
          type: 'gemini',
          content: 'test',
          tokens: { input: 100, output: 50, cached: 20, thoughts: 10, tool: 0, total: 160 }
        }]
      })
      expect(processor.canProcess(json)).toBe(true)
    })
  })

  describe('parseSession', () => {
    test('should parse valid Gemini session', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = processor.parseSession(content)

      expect(session.sessionId).toBeDefined()
      expect(session.provider).toBe('gemini-code')
      expect(session.messages.length).toBeGreaterThan(0)
      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.duration).toBeGreaterThan(0)
      expect(session.metadata.projectHash).toBeDefined()
    })

    test('should convert gemini type to assistant type', () => {
      const json = JSON.stringify({
        sessionId: '123',
        projectHash: 'abc',
        startTime: '2025-01-01T00:00:00Z',
        lastUpdated: '2025-01-01T00:01:00Z',
        messages: [{
          id: '1',
          timestamp: '2025-01-01T00:00:00Z',
          type: 'gemini',
          content: 'test'
        }]
      })

      const session = processor.parseSession(json)
      expect(session.messages[0].type).toBe('assistant')
    })

    test('should throw on empty content', () => {
      expect(() => processor.parseSession('')).toThrow('Content is empty')
    })

    test('should throw on invalid JSON', () => {
      expect(() => processor.parseSession('not json')).toThrow('not valid JSON')
    })
  })

  describe('getProcessorInfo', () => {
    test('should return processor metadata', () => {
      const info = processor.getProcessorInfo()

      expect(info.providerName).toBe('gemini-code')
      expect(info.description).toContain('thinking')
      expect(info.metricProcessors).toHaveLength(5)
      expect(info.version).toBe('1.0.0')
      expect(info.features).toContain('Thinking analysis')
      expect(info.features).toContain('Cache efficiency metrics')
    })
  })
})

describe('GeminiParser', () => {
  const parser = new GeminiParser()

  describe('parseSession', () => {
    test('should parse sample session correctly', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)

      expect(session.sessionId).toBe('ae9730b6-1ac3-40e3-804a-69afa2d85b81')
      expect(session.provider).toBe('gemini-code')
      expect(session.metadata.projectHash).toBe('7e95bdea1c91b994ca74439a92c90b82767abc9c0b8566e20ab60b2a797fc332')
    })

    test('should extract thoughts from messages', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const thoughts = parser.extractThoughts(session)

      expect(thoughts.length).toBeGreaterThan(0)
      expect(thoughts[0]).toHaveProperty('subject')
      expect(thoughts[0]).toHaveProperty('description')
      expect(thoughts[0]).toHaveProperty('timestamp')
    })

    test('should calculate total tokens', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const tokens = parser.calculateTotalTokens(session)

      expect(tokens.totalInput).toBeGreaterThan(0)
      expect(tokens.totalOutput).toBeGreaterThan(0)
      expect(tokens.totalCached).toBeGreaterThan(0)
      expect(tokens.totalThoughts).toBeGreaterThan(0)
      expect(tokens.total).toBeGreaterThan(0)
      expect(tokens.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(tokens.cacheHitRate).toBeLessThanOrEqual(1)
      expect(tokens.thinkingOverhead).toBeGreaterThanOrEqual(0)
    })

    test('should calculate response times', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const responseTimes = parser.calculateResponseTimes(session)

      expect(responseTimes.length).toBeGreaterThan(0)
      responseTimes.forEach(rt => {
        expect(rt.userMessage.type).toBe('user')
        expect(rt.assistantMessage.type).toBe('assistant')
        expect(rt.responseTime).toBeGreaterThan(0)
      })
    })

    test('should analyze thinking patterns', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.json')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const analysis = parser.analyzeThinking(session)

      expect(analysis.totalThoughts).toBeGreaterThan(0)
      expect(analysis.avgThoughtsPerMessage).toBeGreaterThan(0)
      expect(analysis.maxThinkingDepth).toBeGreaterThan(0)
      expect(analysis.thinkingMessages).toBeGreaterThan(0)
      expect(analysis.thinkingMessagePercentage).toBeGreaterThan(0)
      expect(analysis.thinkingMessagePercentage).toBeLessThanOrEqual(100)
    })
  })

  describe('token metrics', () => {
    test('should calculate cache hit rate correctly', () => {
      const json = JSON.stringify({
        sessionId: '123',
        projectHash: 'abc',
        startTime: '2025-01-01T00:00:00Z',
        lastUpdated: '2025-01-01T00:01:00Z',
        messages: [{
          id: '1',
          timestamp: '2025-01-01T00:00:00Z',
          type: 'gemini',
          content: 'test',
          tokens: { input: 80, output: 50, cached: 20, thoughts: 10, tool: 0, total: 140 }
        }]
      })

      const session = parser.parseSession(json)
      const tokens = parser.calculateTotalTokens(session)

      // cache hit rate = cached / (input + cached) = 20 / (80 + 20) = 0.2
      expect(tokens.cacheHitRate).toBeCloseTo(0.2, 2)
    })

    test('should calculate thinking overhead correctly', () => {
      const json = JSON.stringify({
        sessionId: '123',
        projectHash: 'abc',
        startTime: '2025-01-01T00:00:00Z',
        lastUpdated: '2025-01-01T00:01:00Z',
        messages: [{
          id: '1',
          timestamp: '2025-01-01T00:00:00Z',
          type: 'gemini',
          content: 'test',
          tokens: { input: 100, output: 50, cached: 20, thoughts: 10, tool: 0, total: 160 }
        }]
      })

      const session = parser.parseSession(json)
      const tokens = parser.calculateTotalTokens(session)

      // thinking overhead = thoughts / output = 10 / 50 = 0.2
      expect(tokens.thinkingOverhead).toBeCloseTo(0.2, 2)
    })
  })
})
