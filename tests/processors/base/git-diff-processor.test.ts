import { describe, it, expect } from 'vitest'
import { GitDiffMetricProcessor } from '../../../src/processors/base/git-diff-processor.js'
import type { ParsedSession } from '../../../src/processors/base/types.js'
import type { GitDiff } from '@guideai-dev/types'

describe('GitDiffMetricProcessor', () => {
	const processor = new GitDiffMetricProcessor()

	const createSession = (gitDiff?: GitDiff, existingMetrics?: Record<string, unknown>): ParsedSession => ({
		sessionId: 'test-session',
		provider: 'claude-code',
		messages: [],
		startTime: new Date('2025-01-15T10:00:00.000Z'),
		endTime: new Date('2025-01-15T10:05:00.000Z'),
		duration: 300000, // 5 minutes
		metadata: gitDiff ? { gitDiff } : undefined,
	})

	describe('basic diff metrics', () => {
		it('should calculate diff statistics correctly', async () => {
			const gitDiff: GitDiff = {
				files: [
					{
						path: 'src/file1.ts',
						stats: { additions: 50, deletions: 10 },
						hunks: [],
					},
					{
						path: 'src/file2.ts',
						stats: { additions: 30, deletions: 20 },
						hunks: [],
					},
				],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(2)
			expect(metrics.git_lines_added).toBe(80)
			expect(metrics.git_lines_removed).toBe(30)
			expect(metrics.git_lines_modified).toBe(110)
			expect(metrics.git_net_lines_changed).toBe(50)
		})

		it('should track file changes with zero lines', async () => {
			const gitDiff: GitDiff = {
				files: [
					{
						path: 'src/empty.ts',
						stats: { additions: 0, deletions: 0 },
						hunks: [],
					},
				],
				isUnstaged: true,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(1)
			expect(metrics.git_lines_added).toBe(0)
			expect(metrics.git_lines_removed).toBe(0)
			expect(metrics.git_lines_modified).toBe(0)
			expect(metrics.metadata?.calculation_type).toBe('unstaged')
		})
	})

	describe('missing git metadata', () => {
		it('should handle missing git metadata gracefully', async () => {
			const session = createSession()
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(0)
			expect(metrics.git_lines_added).toBe(0)
			expect(metrics.git_lines_removed).toBe(0)
			expect(metrics.git_lines_modified).toBe(0)
			expect(metrics.git_net_lines_changed).toBe(0)
			expect(metrics.metadata?.calculation_type).toBe('unstaged')
			expect(metrics.metadata?.improvement_tips).toEqual([])
		})

		it('should handle empty files array', async () => {
			const gitDiff: GitDiff = {
				files: [],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(0)
			expect(metrics.git_lines_modified).toBe(0)
		})
	})

	describe('invalid git diff format', () => {
		it('should handle files without stats', async () => {
			const gitDiff: GitDiff = {
				files: [
					{
						path: 'src/file.ts',
						// @ts-expect-error Testing invalid format
						stats: undefined,
						hunks: [],
					},
				],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(1)
			expect(metrics.git_lines_added).toBe(0)
			expect(metrics.git_lines_removed).toBe(0)
		})
	})

	describe('multiple commits', () => {
		it('should aggregate statistics across multiple files', async () => {
			const gitDiff: GitDiff = {
				files: [
					{ path: 'src/a.ts', stats: { additions: 10, deletions: 5 }, hunks: [] },
					{ path: 'src/b.ts', stats: { additions: 20, deletions: 15 }, hunks: [] },
					{ path: 'src/c.ts', stats: { additions: 30, deletions: 25 }, hunks: [] },
				],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_total_files_changed).toBe(3)
			expect(metrics.git_lines_added).toBe(60)
			expect(metrics.git_lines_removed).toBe(45)
			expect(metrics.git_lines_modified).toBe(105)
		})
	})

	describe('efficiency ratios with existing metrics', () => {
		it('should calculate lines read per changed ratio', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 50, deletions: 50 }, hunks: [] }],
				isUnstaged: false,
			}

			const existingMetrics = {
				usage: {
					metadata: {
						total_lines_read: 500,
						read_operations: 10,
					},
				},
			}

			const session = createSession(gitDiff, existingMetrics)
			const metrics = await processor.processWithExistingMetrics(session, existingMetrics)

			// 500 lines read / 100 lines modified = 5.0
			expect(metrics.git_lines_read_per_line_changed).toBe(5.0)
			expect(metrics.total_lines_read).toBe(500)
		})

		it('should calculate reads per file ratio', async () => {
			const gitDiff: GitDiff = {
				files: [
					{ path: 'src/a.ts', stats: { additions: 10, deletions: 0 }, hunks: [] },
					{ path: 'src/b.ts', stats: { additions: 20, deletions: 0 }, hunks: [] },
				],
				isUnstaged: false,
			}

			const existingMetrics = {
				usage: {
					metadata: {
						total_lines_read: 100,
						read_operations: 6,
					},
				},
			}

			const session = createSession(gitDiff, existingMetrics)
			const metrics = await processor.processWithExistingMetrics(session, existingMetrics)

			// 6 reads / 2 files = 3.0
			expect(metrics.git_reads_per_file_changed).toBe(3.0)
		})

		it('should calculate lines per minute', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 100, deletions: 50 }, hunks: [] }],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			// 150 lines modified / 5 minutes = 30.0 lines per minute
			expect(metrics.git_lines_changed_per_minute).toBe(30.0)
		})

		it('should handle zero duration', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 100, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:00:00.000Z'),
				duration: 0,
				metadata: { gitDiff },
			}

			const metrics = await processor.process(session)

			expect(metrics.git_lines_changed_per_minute).toBe(0)
		})
	})

	describe('tool efficiency metrics', () => {
		it('should calculate lines per tool use', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 100, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant',
						content: 'test',
						timestamp: new Date(),
						metadata: { hasToolUses: true, toolCount: 2 },
					},
					{
						id: 'msg2',
						type: 'assistant',
						content: 'test',
						timestamp: new Date(),
						metadata: { hasToolUses: true, toolCount: 3 },
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:05:00.000Z'),
				duration: 300000,
				metadata: { gitDiff },
			}

			const metrics = await processor.process(session)

			// 100 lines / 5 total tool uses = 20.0
			expect(metrics.git_lines_changed_per_tool_use).toBe(20.0)
		})

		it('should handle zero tool uses', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 100, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.git_lines_changed_per_tool_use).toBe(0)
		})
	})

	describe('improvement tips', () => {
		it('should suggest improvement for high read-to-change ratio', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 10, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const existingMetrics = {
				usage: {
					metadata: {
						total_lines_read: 200, // 200 / 10 = 20.0 ratio
						read_operations: 5,
					},
				},
			}

			const session = createSession(gitDiff, existingMetrics)
			const metrics = await processor.processWithExistingMetrics(session, existingMetrics)

			expect(metrics.metadata?.improvement_tips).toContain(
				'High read-to-change ratio - AI read lots of code for few changes. Be more specific about file locations.'
			)
		})

		it('should praise excellent navigation efficiency', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 50, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const existingMetrics = {
				usage: {
					metadata: {
						total_lines_read: 100, // 100 / 50 = 2.0 ratio
						read_operations: 2,
					},
				},
			}

			const session = createSession(gitDiff, existingMetrics)
			const metrics = await processor.processWithExistingMetrics(session, existingMetrics)

			expect(metrics.metadata?.improvement_tips).toContain(
				'Excellent navigation efficiency! AI found and modified code quickly.'
			)
		})

		it('should suggest improvement for multiple reads per file', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 10, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const existingMetrics = {
				usage: {
					metadata: {
						total_lines_read: 100,
						read_operations: 5, // 5 reads / 1 file = 5.0 (> 3)
					},
				},
			}

			const session = createSession(gitDiff, existingMetrics)
			const metrics = await processor.processWithExistingMetrics(session, existingMetrics)

			expect(metrics.metadata?.improvement_tips).toContain(
				'Multiple reads per file - AI struggled to find right code. Include function/class names.'
			)
		})

		it('should suggest consolidating for low lines per tool', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 5, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant',
						content: 'test',
						timestamp: new Date(),
						metadata: { hasToolUses: true, toolCount: 10 }, // 5 lines / 10 tools = 0.5
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:05:00.000Z'),
				duration: 300000,
				metadata: { gitDiff },
			}

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).toContain(
				'Low lines per tool - many tools for small changes. Consider consolidating requests.'
			)
		})

		it('should praise great tool efficiency', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 100, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [
					{
						id: 'msg1',
						type: 'assistant',
						content: 'test',
						timestamp: new Date(),
						metadata: { hasToolUses: true, toolCount: 10 }, // 100 lines / 10 tools = 10.0
					},
				],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:05:00.000Z'),
				duration: 300000,
				metadata: { gitDiff },
			}

			const metrics = await processor.process(session)

			expect(metrics.metadata?.improvement_tips).toContain(
				'Great tool efficiency - significant changes with minimal tool use.'
			)
		})
	})

	describe('metadata fields', () => {
		it('should include commit hashes in metadata', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 10, deletions: 0 }, hunks: [] }],
				isUnstaged: false,
			}

			const session: ParsedSession = {
				sessionId: 'test',
				provider: 'claude-code',
				messages: [],
				startTime: new Date('2025-01-15T10:00:00.000Z'),
				endTime: new Date('2025-01-15T10:05:00.000Z'),
				duration: 300000,
				metadata: {
					gitDiff,
					firstCommitHash: 'abc123',
					latestCommitHash: 'def456',
				},
			}

			const metrics = await processor.process(session)

			expect(metrics.metadata?.first_commit).toBe('abc123')
			expect(metrics.metadata?.latest_commit).toBe('def456')
			expect(metrics.metadata?.calculation_type).toBe('committed')
		})

		it('should mark unstaged changes correctly', async () => {
			const gitDiff: GitDiff = {
				files: [{ path: 'src/file.ts', stats: { additions: 10, deletions: 0 }, hunks: [] }],
				isUnstaged: true,
			}

			const session = createSession(gitDiff)
			const metrics = await processor.process(session)

			expect(metrics.metadata?.calculation_type).toBe('unstaged')
		})
	})
})
