import type { ParsedSession } from '../../../processors/base/types.js'

export const MOCK_SESSION: ParsedSession = {
	sessionId: 'test-session-123',
	provider: 'claude-code',
	startTime: new Date('2025-01-01T00:00:00Z'),
	endTime: new Date('2025-01-01T00:10:00Z'),
	duration: 600000,
	messages: [
		{
			id: 'msg-1',
			type: 'user',
			content: 'Can you help me create a user authentication system?',
			timestamp: new Date('2025-01-01T00:00:00Z'),
		},
		{
			id: 'msg-2',
			type: 'assistant',
			content: {
				type: 'structured',
				text: "I'll help you create a user authentication system. Let me start by creating the necessary files.",
				toolUses: [
					{
						type: 'tool_use',
						id: 'tool-1',
						name: 'write',
						input: { filePath: '/auth/user.ts', content: 'export class User {}' },
					},
				],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: "I'll help you create a user authentication system. Let me start by creating the necessary files.",
					},
					{
						type: 'tool_use',
						id: 'tool-1',
						name: 'write',
						input: { filePath: '/auth/user.ts', content: 'export class User {}' },
					},
				],
			},
			timestamp: new Date('2025-01-01T00:00:05Z'),
		},
		{
			id: 'msg-3',
			type: 'user',
			content: 'Great! Can you add password hashing?',
			timestamp: new Date('2025-01-01T00:02:00Z'),
		},
		{
			id: 'msg-4',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'I will add password hashing functionality.',
				toolUses: [
					{
						type: 'tool_use',
						id: 'tool-2',
						name: 'edit',
						input: { filePath: '/auth/user.ts', content: 'Updated with bcrypt' },
					},
				],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'I will add password hashing functionality.',
					},
					{
						type: 'tool_use',
						id: 'tool-2',
						name: 'edit',
						input: { filePath: '/auth/user.ts', content: 'Updated with bcrypt' },
					},
				],
			},
			timestamp: new Date('2025-01-01T00:02:10Z'),
		},
		{
			id: 'msg-5',
			type: 'user',
			content: 'Perfect, thanks!',
			timestamp: new Date('2025-01-01T00:10:00Z'),
		},
	],
}

export const MOCK_SESSION_WITH_PHASES: ParsedSession = {
	sessionId: 'test-session-456',
	provider: 'claude-code',
	startTime: new Date('2025-01-01T00:00:00Z'),
	endTime: new Date('2025-01-01T00:30:00Z'),
	duration: 1800000,
	messages: [
		{
			id: 'msg-1',
			type: 'user',
			content: 'I need to build a REST API for managing blog posts',
			timestamp: new Date('2025-01-01T00:00:00Z'),
		},
		{
			id: 'msg-2',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'Let me analyze the requirements and create a plan.',
				toolUses: [],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'Let me analyze the requirements and create a plan.',
					},
				],
			},
			timestamp: new Date('2025-01-01T00:01:00Z'),
		},
		{
			id: 'msg-3',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'Here is my proposed approach: 1. Create models 2. Add routes 3. Add validation',
				toolUses: [],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'Here is my proposed approach: 1. Create models 2. Add routes 3. Add validation',
					},
				],
			},
			timestamp: new Date('2025-01-01T00:02:00Z'),
		},
		{
			id: 'msg-4',
			type: 'user',
			content: 'Sounds good, please proceed',
			timestamp: new Date('2025-01-01T00:03:00Z'),
		},
		{
			id: 'msg-5',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'Creating the blog post model.',
				toolUses: [
					{
						type: 'tool_use',
						id: 'tool-1',
						name: 'write',
						input: { filePath: '/models/post.ts', content: 'export class Post {}' },
					},
				],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'Creating the blog post model.',
					},
					{
						type: 'tool_use',
						id: 'tool-1',
						name: 'write',
						input: { filePath: '/models/post.ts', content: 'export class Post {}' },
					},
				],
			},
			timestamp: new Date('2025-01-01T00:05:00Z'),
		},
		{
			id: 'msg-6',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'Adding API routes.',
				toolUses: [
					{
						type: 'tool_use',
						id: 'tool-2',
						name: 'write',
						input: { filePath: '/routes/posts.ts', content: 'export const router = {}' },
					},
				],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'Adding API routes.',
					},
					{
						type: 'tool_use',
						id: 'tool-2',
						name: 'write',
						input: { filePath: '/routes/posts.ts', content: 'export const router = {}' },
					},
				],
			},
			timestamp: new Date('2025-01-01T00:10:00Z'),
		},
		{
			id: 'msg-7',
			type: 'user',
			content: 'The tests are failing, can you fix them?',
			timestamp: new Date('2025-01-01T00:20:00Z'),
		},
		{
			id: 'msg-8',
			type: 'assistant',
			content: {
				type: 'structured',
				text: 'I will fix the failing tests.',
				toolUses: [
					{
						type: 'tool_use',
						id: 'tool-3',
						name: 'edit',
						input: { filePath: '/tests/posts.test.ts', content: 'Fixed tests' },
					},
				],
				toolResults: [],
				structured: [
					{
						type: 'text',
						text: 'I will fix the failing tests.',
					},
					{
						type: 'tool_use',
						id: 'tool-3',
						name: 'edit',
						input: { filePath: '/tests/posts.test.ts', content: 'Fixed tests' },
					},
				],
			},
			timestamp: new Date('2025-01-01T00:25:00Z'),
		},
		{
			id: 'msg-9',
			type: 'user',
			content: 'Perfect! All tests passing now.',
			timestamp: new Date('2025-01-01T00:30:00Z'),
		},
	],
}

export const EMPTY_SESSION: ParsedSession = {
	sessionId: 'empty-session',
	provider: 'claude-code',
	startTime: new Date('2025-01-01T00:00:00Z'),
	endTime: new Date('2025-01-01T00:00:01Z'),
	duration: 1000,
	messages: [],
}

export const MOCK_USER = {
	id: 'user-123',
	username: 'testuser',
	email: 'test@example.com',
}

export const MOCK_CONTEXT = {
	sessionId: 'test-session-123',
	tenantId: 'test-tenant',
	userId: 'user-123',
	provider: 'claude-code',
	session: MOCK_SESSION,
	user: MOCK_USER,
}

export const MOCK_PHASE_CONTEXT = {
	sessionId: 'test-session-456',
	tenantId: 'test-tenant',
	userId: 'user-123',
	provider: 'claude-code',
	session: MOCK_SESSION_WITH_PHASES,
	user: MOCK_USER,
}
