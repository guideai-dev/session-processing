import { describe, it, expect } from 'vitest'
import { getUserDisplayName, type UserInfo } from '../../src/utils/user.js'

describe('getUserDisplayName', () => {
	describe('Name Extraction', () => {
		it('should extract first name from full name', () => {
			const user: UserInfo = { name: 'John Doe', username: 'johndoe' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should handle single name', () => {
			const user: UserInfo = { name: 'Madonna' }
			expect(getUserDisplayName(user)).toBe('Madonna')
		})

		it('should extract first name from multiple names', () => {
			const user: UserInfo = { name: 'John Paul Smith' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should trim whitespace from name', () => {
			const user: UserInfo = { name: '  John  Doe  ' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should handle multiple spaces between names', () => {
			const user: UserInfo = { name: 'John    Doe' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should handle tabs and newlines in name', () => {
			const user: UserInfo = { name: 'John\t\nDoe' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should prefer name over username', () => {
			const user: UserInfo = { name: 'John Doe', username: 'jdoe' }
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should prefer name over email', () => {
			const user: UserInfo = { name: 'John Doe', email: 'john@example.com' }
			expect(getUserDisplayName(user)).toBe('John')
		})
	})

	describe('Username Fallback', () => {
		it('should use @username when no name', () => {
			const user: UserInfo = { username: 'johndoe' }
			expect(getUserDisplayName(user)).toBe('@johndoe')
		})

		it('should use @username when name is null', () => {
			const user: UserInfo = { name: null, username: 'johndoe' }
			expect(getUserDisplayName(user)).toBe('@johndoe')
		})

		it('should use @username when name is empty string', () => {
			const user: UserInfo = { name: '', username: 'johndoe' }
			expect(getUserDisplayName(user)).toBe('@johndoe')
		})

		it('should use @username when name is whitespace only', () => {
			const user: UserInfo = { name: '   ', username: 'johndoe' }
			expect(getUserDisplayName(user)).toBe('@johndoe')
		})

		it('should prefer username over email', () => {
			const user: UserInfo = { username: 'johndoe', email: 'john@example.com' }
			expect(getUserDisplayName(user)).toBe('@johndoe')
		})

		it('should handle username with special characters', () => {
			const user: UserInfo = { username: 'john_doe-123' }
			expect(getUserDisplayName(user)).toBe('@john_doe-123')
		})
	})

	describe('Email Fallback', () => {
		it('should extract username from email when no name or username', () => {
			const user: UserInfo = { email: 'john@example.com' }
			expect(getUserDisplayName(user)).toBe('@john')
		})

		it('should use email when name is null and username is null', () => {
			const user: UserInfo = { name: null, username: null, email: 'jane@example.com' }
			expect(getUserDisplayName(user)).toBe('@jane')
		})

		it('should handle complex email addresses', () => {
			const user: UserInfo = { email: 'john.doe+tag@example.com' }
			expect(getUserDisplayName(user)).toBe('@john.doe+tag')
		})

		it('should handle email with dots', () => {
			const user: UserInfo = { email: 'first.last@example.com' }
			expect(getUserDisplayName(user)).toBe('@first.last')
		})

		it('should handle email with numbers', () => {
			const user: UserInfo = { email: 'user123@example.com' }
			expect(getUserDisplayName(user)).toBe('@user123')
		})

		it('should add @ prefix to email username', () => {
			const user: UserInfo = { email: 'test@domain.com' }
			const result = getUserDisplayName(user)
			expect(result.startsWith('@')).toBe(true)
		})
	})

	describe('Ultimate Fallback', () => {
		it('should return "the user" when all fields are missing', () => {
			const user: UserInfo = {}
			expect(getUserDisplayName(user)).toBe('the user')
		})

		it('should return "the user" when all fields are null', () => {
			const user: UserInfo = { name: null, username: null, email: null }
			expect(getUserDisplayName(user)).toBe('the user')
		})

		it('should return "the user" when all fields are empty strings', () => {
			const user: UserInfo = { name: '', username: '', email: '' }
			expect(getUserDisplayName(user)).toBe('the user')
		})

		it('should return "the user" when all fields are whitespace', () => {
			const user: UserInfo = { name: '   ', username: '', email: '' }
			expect(getUserDisplayName(user)).toBe('the user')
		})
	})

	describe('Edge Cases', () => {
		it('should handle undefined values', () => {
			const user: UserInfo = { name: undefined, username: undefined, email: undefined }
			expect(getUserDisplayName(user)).toBe('the user')
		})

		it('should handle very long names', () => {
			const user: UserInfo = { name: 'A'.repeat(100) + ' Doe' }
			expect(getUserDisplayName(user)).toBe('A'.repeat(100))
		})

		it('should handle names with special characters', () => {
			const user: UserInfo = { name: "O'Brien Smith" }
			expect(getUserDisplayName(user)).toBe("O'Brien")
		})

		it('should handle non-ASCII characters in names', () => {
			const user: UserInfo = { name: 'José García' }
			expect(getUserDisplayName(user)).toBe('José')
		})

		it('should handle emoji in names', () => {
			const user: UserInfo = { name: '🎉 Party User' }
			expect(getUserDisplayName(user)).toBe('🎉')
		})

		it('should handle hyphenated first names', () => {
			const user: UserInfo = { name: 'Jean-Paul Sartre' }
			expect(getUserDisplayName(user)).toBe('Jean-Paul')
		})

		it('should handle email without @ symbol (invalid but defensive)', () => {
			const user: UserInfo = { email: 'notemail' }
			expect(getUserDisplayName(user)).toBe('@notemail')
		})
	})

	describe('Priority Order', () => {
		it('should use name when all fields present', () => {
			const user: UserInfo = {
				name: 'John Doe',
				username: 'jdoe',
				email: 'john@example.com',
			}
			expect(getUserDisplayName(user)).toBe('John')
		})

		it('should use username when name empty but username present', () => {
			const user: UserInfo = {
				name: '',
				username: 'jdoe',
				email: 'john@example.com',
			}
			expect(getUserDisplayName(user)).toBe('@jdoe')
		})

		it('should use email when name and username empty', () => {
			const user: UserInfo = {
				name: '',
				username: '',
				email: 'john@example.com',
			}
			expect(getUserDisplayName(user)).toBe('@john')
		})
	})

	describe('Real-world Scenarios', () => {
		it('should handle GitHub user profile', () => {
			const user: UserInfo = {
				name: 'Linus Torvalds',
				username: 'torvalds',
				email: 'torvalds@linux-foundation.org',
			}
			expect(getUserDisplayName(user)).toBe('Linus')
		})

		it('should handle user with only username', () => {
			const user: UserInfo = {
				username: 'developer123',
			}
			expect(getUserDisplayName(user)).toBe('@developer123')
		})

		it('should handle user with only email', () => {
			const user: UserInfo = {
				email: 'contractor@company.com',
			}
			expect(getUserDisplayName(user)).toBe('@contractor')
		})

		it('should handle mononym (single name)', () => {
			const user: UserInfo = {
				name: 'Cher',
				email: 'cher@example.com',
			}
			expect(getUserDisplayName(user)).toBe('Cher')
		})
	})
})
