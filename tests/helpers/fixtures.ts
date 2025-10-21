/**
 * Test fixtures for session processing tests
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const VALID_JSONL_CONTENT = `{"type":"user","content":"Hello","timestamp":"2025-01-01T00:00:00Z"}
{"type":"assistant","content":"Hi there","timestamp":"2025-01-01T00:00:02Z"}
{"type":"user","content":"How are you?","timestamp":"2025-01-01T00:00:05Z"}`

export const INVALID_JSONL_CONTENT = `{"type":"user","content":"Hello"}
not valid json
{"type":"user","content":"test"}`

export const EMPTY_CONTENT = ''

export const WHITESPACE_CONTENT = '   \n  \n  '

/**
 * Load a sample session JSONL file
 */
export function loadSampleSession(provider: string, filename: string): string {
	const filepath = path.join(
		__dirname,
		'..',
		'processors',
		'providers',
		provider,
		'fixtures',
		filename
	)
	return fs.readFileSync(filepath, 'utf-8')
}

export const CLAUDE_CODE_SESSION_JSONL = `{"uuid":"msg_1","timestamp":"2025-01-15T10:00:05.000Z","type":"user","message":{"role":"user","content":"Create a new React component"},"sessionId":"session-123"}
{"uuid":"msg_2","timestamp":"2025-01-15T10:00:10.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll help you create a React component."},{"type":"tool_use","id":"toolu_123","name":"Write","input":{"file_path":"/src/Component.tsx","content":"export const Component = () => <div>Hello</div>"}}]},"sessionId":"session-123","parentUuid":"msg_1"}
{"uuid":"msg_3","timestamp":"2025-01-15T10:00:12.000Z","type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_123","content":"File written successfully"}]},"sessionId":"session-123","parentUuid":"msg_2"}`

export const GEMINI_SESSION_JSONL = `{"type":"session_start","timestamp":"2025-01-15T10:00:00.000Z","provider":"gemini","sessionId":"gemini-session-456"}
{"type":"user_message","text":"Write a Python function","timestamp":"2025-01-15T10:00:05.000Z"}
{"type":"model_response","text":"Here's a Python function...","timestamp":"2025-01-15T10:00:10.000Z"}
{"type":"session_end","timestamp":"2025-01-15T10:01:00.000Z"}`

export const SESSION_WITH_GIT_METADATA = {
	sessionId: 'test-session-git-123',
	provider: 'claude-code' as const,
	messages: [],
	startTime: new Date('2025-01-15T10:00:00.000Z'),
	endTime: new Date('2025-01-15T10:05:00.000Z'),
	duration: 300000,
	gitMetadata: {
		branch: 'feature/test',
		firstCommitHash: 'abc123',
		latestCommitHash: 'def456',
		diffStats: {
			filesChanged: 3,
			insertions: 150,
			deletions: 50,
		},
	},
}

export const SESSION_WITHOUT_GIT = {
	sessionId: 'test-session-no-git-456',
	provider: 'cursor' as const,
	messages: [],
	startTime: new Date('2025-01-15T10:00:00.000Z'),
	endTime: new Date('2025-01-15T10:05:00.000Z'),
	duration: 300000,
}

export const TEST_MESSAGES = [
	{
		id: 'msg_1',
		type: 'user' as const,
		content: 'Test user message',
		timestamp: new Date('2025-01-15T10:00:00.000Z'),
	},
	{
		id: 'msg_2',
		type: 'assistant' as const,
		content: 'Test assistant response',
		timestamp: new Date('2025-01-15T10:00:05.000Z'),
	},
	{
		id: 'msg_3',
		type: 'tool_result' as const,
		content: 'Tool execution result',
		timestamp: new Date('2025-01-15T10:00:10.000Z'),
	},
]
