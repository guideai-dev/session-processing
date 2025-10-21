/**
 * Mock implementations for testing
 */

import { vi } from 'vitest'
import type { BaseModelTask, LLMResponse } from '../../src/ai-models/base/model-task.js'
import type { BaseProviderProcessor } from '../../src/processors/base/provider-processor.js'
import type { ProcessorContext, MetricResult } from '../../src/processors/base/types.js'

export class MockProviderProcessor implements Partial<BaseProviderProcessor> {
	canProcess = vi.fn().mockReturnValue(true)
	parseSession = vi.fn()
	processMetrics = vi.fn().mockResolvedValue([])
}

export class MockModelTask implements Partial<BaseModelTask<any, any>> {
	execute = vi.fn()
	validate = vi.fn()
	transform = vi.fn()
}

export function createMockLLMResponse(data: any): LLMResponse {
	return {
		content: JSON.stringify(data),
		model: 'mock-model',
		usage: {
			inputTokens: 100,
			outputTokens: 50,
		},
	}
}

export function createMockProcessorContext(
	overrides?: Partial<ProcessorContext>
): ProcessorContext {
	return {
		sessionId: 'test-session-123',
		provider: 'claude-code',
		tenantId: 'test-tenant',
		userId: 'test-user',
		...overrides,
	}
}

export function createMockMetricResult(overrides?: Partial<MetricResult>): MetricResult {
	return {
		metricType: 'performance',
		metrics: {
			completion_time_ms: 1000,
			token_count: 500,
		},
		metadata: {},
		...overrides,
	}
}

export const mockAnthropicClient = {
	messages: {
		create: vi.fn().mockResolvedValue({
			content: [
				{
					type: 'text',
					text: '{"result": "mock response"}',
				},
			],
			model: 'claude-3-5-sonnet-20241022',
			usage: {
				input_tokens: 100,
				output_tokens: 50,
			},
		}),
	},
}

export const mockGeminiClient = {
	generateContent: vi.fn().mockResolvedValue({
		response: {
			text: () => '{"result": "mock response"}',
			usageMetadata: {
				promptTokenCount: 100,
				candidatesTokenCount: 50,
			},
		},
	}),
}
