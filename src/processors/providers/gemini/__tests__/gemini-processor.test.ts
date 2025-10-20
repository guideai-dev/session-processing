import { describe, test, expect } from 'vitest'
import { GeminiProcessor, GeminiHelpers } from '../index.js'
import { GeminiParser } from '../../../../parsers/index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('GeminiProcessor', () => {
  const processor = new GeminiProcessor()

  describe('canProcess', () => {
    test('should accept valid Gemini session JSONL', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      expect(processor.canProcess(content)).toBe(true)
    })

    test('should reject single-line JSON', () => {
      const json = JSON.stringify({
        sessionId: '123',
        messages: [{ id: '1', type: 'user', content: 'test' }]
      })
      expect(processor.canProcess(json)).toBe(false)
    })

    test('should reject JSONL without Gemini-specific fields', () => {
      const jsonl = '{"uuid":"123","type":"user","sessionId":"abc"}\n{"uuid":"456","type":"assistant","sessionId":"abc"}'
      expect(processor.canProcess(jsonl)).toBe(false)
    })

    test('should accept JSONL with type gemini', () => {
      const jsonl = '{"uuid":"123","type":"user","sessionId":"abc"}\n{"uuid":"456","type":"gemini","sessionId":"abc","gemini_thoughts":[]}'
      expect(processor.canProcess(jsonl)).toBe(true)
    })

    test('should accept JSONL with gemini_thoughts field', () => {
      const jsonl = '{"uuid":"123","type":"user","sessionId":"abc"}\n{"uuid":"456","type":"assistant","sessionId":"abc","gemini_thoughts":[{"subject":"test","description":"test","timestamp":"2025-01-01T00:00:00Z"}]}'
      expect(processor.canProcess(jsonl)).toBe(true)
    })

    test('should accept JSONL with gemini_tokens field', () => {
      const jsonl = '{"uuid":"123","type":"user","sessionId":"abc"}\n{"uuid":"456","type":"assistant","sessionId":"abc","gemini_tokens":{"input":100,"output":50,"cached":20,"thoughts":10,"tool":0,"total":160}}'
      expect(processor.canProcess(jsonl)).toBe(true)
    })
  })

  describe('parseSession', () => {
    test('should parse valid Gemini session', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = processor.parseSession(content)

      expect(session.sessionId).toBeDefined()
      expect(session.provider).toBe('gemini-code')
      expect(session.messages.length).toBeGreaterThan(0)
      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.duration).toBeGreaterThan(0)
    })

    test('should convert gemini type to assistant type', () => {
      const jsonl = [
        '{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","sessionId":"123","message":{"role":"user","content":"test"}}',
        '{"uuid":"2","timestamp":"2025-01-01T00:01:00Z","type":"gemini","sessionId":"123","message":{"role":"assistant","content":"response"},"gemini_thoughts":[]}'
      ].join('\n')

      const session = processor.parseSession(jsonl)
      const geminiMessage = session.messages.find(m => m.id === '2')
      expect(geminiMessage?.type).toBe('assistant_response')
    })

    test('should throw on empty content', () => {
      expect(() => processor.parseSession('')).toThrow('Content is empty')
    })

    test('should throw on invalid JSONL', () => {
      expect(() => processor.parseSession('not json')).toThrow('Invalid JSON on line 1')
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
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)

      expect(session.sessionId).toBe('9073b8a3-2b90-405b-b032-3719e076bf67')
      expect(session.provider).toBe('gemini-code')
    })

    test('should extract thoughts from messages', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const thoughts = GeminiHelpers.extractThoughts(session)

      expect(thoughts.length).toBeGreaterThan(0)
      expect(thoughts[0]).toHaveProperty('subject')
      expect(thoughts[0]).toHaveProperty('description')
      expect(thoughts[0]).toHaveProperty('timestamp')
    })

    test('should calculate total tokens', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const tokens = GeminiHelpers.calculateTotalTokens(session)

      expect(tokens.totalInput).toBeGreaterThan(0)
      expect(tokens.totalOutput).toBeGreaterThan(0)
      expect(tokens.totalCached).toBeGreaterThanOrEqual(0)
      expect(tokens.totalThoughts).toBeGreaterThanOrEqual(0)
      expect(tokens.total).toBeGreaterThan(0)
      expect(tokens.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(tokens.cacheHitRate).toBeLessThanOrEqual(1)
      expect(tokens.thinkingOverhead).toBeGreaterThanOrEqual(0)
    })

    test('should calculate response times', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const responseTimes = GeminiHelpers.calculateResponseTimes(session)

      expect(responseTimes.length).toBeGreaterThan(0)
      responseTimes.forEach(rt => {
        expect(rt.userMessage.type).toBe('user_input')
        expect(rt.assistantMessage.type).toBe('assistant_response')
        expect(rt.responseTime).toBeGreaterThan(0)
      })
    })

    test('should analyze thinking patterns', () => {
      const samplePath = path.join(__dirname, 'fixtures', 'sample-gemini-session.jsonl')
      const content = fs.readFileSync(samplePath, 'utf-8')

      const session = parser.parseSession(content)
      const analysis = GeminiHelpers.analyzeThinking(session)

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
      const jsonl = [
        '{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","sessionId":"123","message":{"role":"user","content":"test"}}',
        '{"uuid":"2","timestamp":"2025-01-01T00:00:00Z","type":"gemini","sessionId":"123","message":{"role":"assistant","content":"response"},"gemini_tokens":{"input":80,"output":50,"cached":20,"thoughts":10,"tool":0,"total":140}}'
      ].join('\n')

      const session = parser.parseSession(jsonl)
      const tokens = GeminiHelpers.calculateTotalTokens(session)

      // cache hit rate = cached / (input + cached) = 20 / (80 + 20) = 0.2
      expect(tokens.cacheHitRate).toBeCloseTo(0.2, 2)
    })

    test('should calculate thinking overhead correctly', () => {
      const jsonl = [
        '{"uuid":"1","timestamp":"2025-01-01T00:00:00Z","type":"user","sessionId":"123","message":{"role":"user","content":"test"}}',
        '{"uuid":"2","timestamp":"2025-01-01T00:00:00Z","type":"gemini","sessionId":"123","message":{"role":"assistant","content":"response"},"gemini_tokens":{"input":100,"output":50,"cached":20,"thoughts":10,"tool":0,"total":160}}'
      ].join('\n')

      const session = parser.parseSession(jsonl)
      const tokens = GeminiHelpers.calculateTotalTokens(session)

      // thinking overhead = thoughts / output = 10 / 50 = 0.2
      expect(tokens.thinkingOverhead).toBeCloseTo(0.2, 2)
    })
  })
})
