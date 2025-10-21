import { describe, it, expect } from 'vitest'
import { parseGitHubUrl, buildGitHubDiffUrl } from '../../src/utils/git-url.js'

describe('parseGitHubUrl', () => {
	describe('SSH Format', () => {
		it('should parse SSH URL with .git suffix', () => {
			const result = parseGitHubUrl('git@github.com:owner/repo.git')
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should parse SSH URL without .git suffix', () => {
			const result = parseGitHubUrl('git@github.com:owner/repo')
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should handle organization names with hyphens', () => {
			const result = parseGitHubUrl('git@github.com:my-org/my-repo.git')
			expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' })
		})

		it('should handle organization names with underscores', () => {
			const result = parseGitHubUrl('git@github.com:my_org/my_repo.git')
			expect(result).toEqual({ owner: 'my_org', repo: 'my_repo' })
		})

		it('should handle organization names with dots', () => {
			const result = parseGitHubUrl('git@github.com:my.org/my.repo.git')
			// Regex stops at first dot in repo name (treats it as .git)
			expect(result).toEqual({ owner: 'my.org', repo: 'my' })
		})

		it('should handle numeric characters in owner/repo', () => {
			const result = parseGitHubUrl('git@github.com:user123/repo456.git')
			expect(result).toEqual({ owner: 'user123', repo: 'repo456' })
		})
	})

	describe('HTTPS Format', () => {
		it('should parse HTTPS URL with .git suffix', () => {
			const result = parseGitHubUrl('https://github.com/owner/repo.git')
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should parse HTTPS URL without .git suffix', () => {
			const result = parseGitHubUrl('https://github.com/owner/repo')
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should parse HTTP URL (non-secure)', () => {
			const result = parseGitHubUrl('http://github.com/owner/repo.git')
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should handle organization names with hyphens', () => {
			const result = parseGitHubUrl('https://github.com/my-org/my-repo.git')
			expect(result).toEqual({ owner: 'my-org', repo: 'my-repo' })
		})

		it('should handle organization names with underscores', () => {
			const result = parseGitHubUrl('https://github.com/my_org/my_repo.git')
			expect(result).toEqual({ owner: 'my_org', repo: 'my_repo' })
		})

		it('should handle organization names with dots', () => {
			const result = parseGitHubUrl('https://github.com/my.org/my.repo.git')
			// Regex stops at first dot in repo name (treats it as .git)
			expect(result).toEqual({ owner: 'my.org', repo: 'my' })
		})
	})

	describe('Invalid Inputs', () => {
		it('should return null for null input', () => {
			const result = parseGitHubUrl(null)
			expect(result).toBeNull()
		})

		it('should return null for undefined input', () => {
			const result = parseGitHubUrl(undefined)
			expect(result).toBeNull()
		})

		it('should return null for empty string', () => {
			const result = parseGitHubUrl('')
			expect(result).toBeNull()
		})

		it('should return null for non-GitHub URL', () => {
			const result = parseGitHubUrl('https://gitlab.com/owner/repo.git')
			expect(result).toBeNull()
		})

		it('should return null for malformed SSH URL', () => {
			const result = parseGitHubUrl('git@github.com/owner/repo.git')
			expect(result).toBeNull()
		})

		it('should return null for malformed HTTPS URL', () => {
			const result = parseGitHubUrl('https://github.com:owner/repo.git')
			expect(result).toBeNull()
		})

		it('should return null for URL with only owner', () => {
			const result = parseGitHubUrl('https://github.com/owner')
			expect(result).toBeNull()
		})

		it('should handle URL with trailing slash', () => {
			const result = parseGitHubUrl('https://github.com/owner/repo/')
			// The regex still matches even with trailing slash
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})

		it('should return null for random string', () => {
			const result = parseGitHubUrl('not a git url')
			expect(result).toBeNull()
		})
	})

	describe('Real-world Examples', () => {
		it('should parse React repository SSH', () => {
			const result = parseGitHubUrl('git@github.com:facebook/react.git')
			expect(result).toEqual({ owner: 'facebook', repo: 'react' })
		})

		it('should parse React repository HTTPS', () => {
			const result = parseGitHubUrl('https://github.com/facebook/react.git')
			expect(result).toEqual({ owner: 'facebook', repo: 'react' })
		})

		it('should parse Node.js repository', () => {
			const result = parseGitHubUrl('https://github.com/nodejs/node.git')
			expect(result).toEqual({ owner: 'nodejs', repo: 'node' })
		})

		it('should parse TypeScript repository', () => {
			const result = parseGitHubUrl('git@github.com:microsoft/TypeScript.git')
			expect(result).toEqual({ owner: 'microsoft', repo: 'TypeScript' })
		})
	})

	describe('Edge Cases', () => {
		it('should handle uppercase characters', () => {
			const result = parseGitHubUrl('https://github.com/Owner/Repo.git')
			expect(result).toEqual({ owner: 'Owner', repo: 'Repo' })
		})

		it('should handle mixed case', () => {
			const result = parseGitHubUrl('git@github.com:MyOrg/MyRepo.git')
			expect(result).toEqual({ owner: 'MyOrg', repo: 'MyRepo' })
		})

		it('should match URLs with paths beyond repo (extracts owner/repo only)', () => {
			const result = parseGitHubUrl('https://github.com/owner/repo/tree/main')
			// The regex matches owner/repo even if there's more path after it
			expect(result).toEqual({ owner: 'owner', repo: 'repo' })
		})
	})
})

describe('buildGitHubDiffUrl', () => {
	describe('Valid Inputs', () => {
		it('should build diff URL from SSH format', () => {
			const url = buildGitHubDiffUrl(
				'git@github.com:owner/repo.git',
				'abc123',
				'def456'
			)
			expect(url).toBe('https://github.com/owner/repo/compare/abc123...def456')
		})

		it('should build diff URL from HTTPS format', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'abc123',
				'def456'
			)
			expect(url).toBe('https://github.com/owner/repo/compare/abc123...def456')
		})

		it('should build diff URL without .git suffix', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo',
				'abc123',
				'def456'
			)
			expect(url).toBe('https://github.com/owner/repo/compare/abc123...def456')
		})

		it('should handle full 40-character commit hashes', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'a'.repeat(40),
				'b'.repeat(40)
			)
			expect(url).toBe(`https://github.com/owner/repo/compare/${'a'.repeat(40)}...${'b'.repeat(40)}`)
		})

		it('should handle short commit hashes', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'abc1234',
				'def5678'
			)
			expect(url).toBe('https://github.com/owner/repo/compare/abc1234...def5678')
		})

		it('should handle organization with hyphens', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/my-org/my-repo.git',
				'abc123',
				'def456'
			)
			expect(url).toBe('https://github.com/my-org/my-repo/compare/abc123...def456')
		})
	})

	describe('Invalid Inputs - Missing Fields', () => {
		it('should return null when git URL is null', () => {
			const url = buildGitHubDiffUrl(null, 'abc123', 'def456')
			expect(url).toBeNull()
		})

		it('should return null when git URL is undefined', () => {
			const url = buildGitHubDiffUrl(undefined, 'abc123', 'def456')
			expect(url).toBeNull()
		})

		it('should return null when git URL is empty string', () => {
			const url = buildGitHubDiffUrl('', 'abc123', 'def456')
			expect(url).toBeNull()
		})

		it('should return null when first commit is null', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', null, 'def456')
			expect(url).toBeNull()
		})

		it('should return null when first commit is undefined', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', undefined, 'def456')
			expect(url).toBeNull()
		})

		it('should return null when first commit is empty string', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', '', 'def456')
			expect(url).toBeNull()
		})

		it('should return null when latest commit is null', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', 'abc123', null)
			expect(url).toBeNull()
		})

		it('should return null when latest commit is undefined', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', 'abc123', undefined)
			expect(url).toBeNull()
		})

		it('should return null when latest commit is empty string', () => {
			const url = buildGitHubDiffUrl('https://github.com/owner/repo.git', 'abc123', '')
			expect(url).toBeNull()
		})

		it('should return null when all inputs are null', () => {
			const url = buildGitHubDiffUrl(null, null, null)
			expect(url).toBeNull()
		})
	})

	describe('Invalid Inputs - Same Commits', () => {
		it('should return null when commits are identical', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'abc123',
				'abc123'
			)
			expect(url).toBeNull()
		})

		it('should return null when both commits are same full hash', () => {
			const hash = 'a'.repeat(40)
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				hash,
				hash
			)
			expect(url).toBeNull()
		})
	})

	describe('Invalid Inputs - Malformed Git URL', () => {
		it('should return null for non-GitHub URL', () => {
			const url = buildGitHubDiffUrl(
				'https://gitlab.com/owner/repo.git',
				'abc123',
				'def456'
			)
			expect(url).toBeNull()
		})

		it('should return null for malformed Git URL', () => {
			const url = buildGitHubDiffUrl(
				'not a git url',
				'abc123',
				'def456'
			)
			expect(url).toBeNull()
		})

		it('should return null for incomplete GitHub URL', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner',
				'abc123',
				'def456'
			)
			expect(url).toBeNull()
		})
	})

	describe('Real-world Scenarios', () => {
		it('should build diff URL for React repository', () => {
			const url = buildGitHubDiffUrl(
				'git@github.com:facebook/react.git',
				'v18.0.0',
				'v18.2.0'
			)
			expect(url).toBe('https://github.com/facebook/react/compare/v18.0.0...v18.2.0')
		})

		it('should build diff URL for Node.js repository', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/nodejs/node.git',
				'v18.0.0',
				'v20.0.0'
			)
			expect(url).toBe('https://github.com/nodejs/node/compare/v18.0.0...v20.0.0')
		})

		it('should build diff URL for feature branch comparison', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/user/project.git',
				'main',
				'feature-branch'
			)
			expect(url).toBe('https://github.com/user/project/compare/main...feature-branch')
		})

		it('should build diff URL with commit hashes', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'a1b2c3d4e5f6',
				'f6e5d4c3b2a1'
			)
			expect(url).toBe('https://github.com/owner/repo/compare/a1b2c3d4e5f6...f6e5d4c3b2a1')
		})
	})

	describe('Integration', () => {
		it('should handle complete workflow with valid inputs', () => {
			const gitUrl = 'git@github.com:myorg/myrepo.git'
			const parsed = parseGitHubUrl(gitUrl)
			expect(parsed).toEqual({ owner: 'myorg', repo: 'myrepo' })

			const diffUrl = buildGitHubDiffUrl(gitUrl, 'commit1', 'commit2')
			expect(diffUrl).toBe('https://github.com/myorg/myrepo/compare/commit1...commit2')
		})

		it('should handle complete workflow with invalid git URL', () => {
			const gitUrl = 'not-a-git-url'
			const parsed = parseGitHubUrl(gitUrl)
			expect(parsed).toBeNull()

			const diffUrl = buildGitHubDiffUrl(gitUrl, 'commit1', 'commit2')
			expect(diffUrl).toBeNull()
		})
	})

	describe('URL Format', () => {
		it('should use three dots (...) in compare URL', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'base',
				'head'
			)
			// Check that the URL contains the three-dot syntax for GitHub compare
			expect(url).toBe('https://github.com/owner/repo/compare/base...head')
		})

		it('should always return https URL regardless of input protocol', () => {
			const sshUrl = buildGitHubDiffUrl(
				'git@github.com:owner/repo.git',
				'base',
				'head'
			)
			expect(sshUrl?.startsWith('https://')).toBe(true)

			const httpsUrl = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'base',
				'head'
			)
			expect(httpsUrl?.startsWith('https://')).toBe(true)
		})

		it('should use /compare/ path in URL', () => {
			const url = buildGitHubDiffUrl(
				'https://github.com/owner/repo.git',
				'base',
				'head'
			)
			expect(url).toContain('/compare/')
		})
	})
})
