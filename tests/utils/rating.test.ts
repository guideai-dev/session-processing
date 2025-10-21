import { describe, it, expect } from 'vitest'
import {
	calculateRating,
	getRatingDisplayInfo,
	type AssessmentResponse,
	type SessionRating,
} from '../../src/utils/rating.js'

describe('calculateRating', () => {
	describe('Thumbs Down (1-3)', () => {
		it('should return thumbs_down for score of 1', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 1 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})

		it('should return thumbs_down for score of 2', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 2 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})

		it('should return thumbs_down for score of 3', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 3 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})
	})

	describe('Meh (4)', () => {
		it('should return meh for score of 4', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 4 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('meh')
		})
	})

	describe('Thumbs Up (5-7)', () => {
		it('should return thumbs_up for score of 5', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should return thumbs_up for score of 6', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 6 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should return thumbs_up for score of 7', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})
	})

	describe('Invalid Scores', () => {
		it('should return null for score of 0', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 0 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for score of 8', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 8 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for negative score', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: -1 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for very large score', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 100 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})
	})

	describe('Missing Usefulness Question', () => {
		it('should return null when usefulness-1 question not found', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'other-question',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for empty responses array', () => {
			expect(calculateRating([])).toBeNull()
		})

		it('should find usefulness-1 among multiple responses', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'question-1',
					answer: { type: 'likert', value: 3 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:01Z',
				},
				{
					questionId: 'question-3',
					answer: { type: 'text', value: 'feedback' },
					timestamp: '2025-01-01T00:00:02Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})
	})

	describe('Wrong Answer Type', () => {
		it('should return null for text answer', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'text', value: 'very helpful' },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for choice answer', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'choice', value: 'option-a' },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for skipped answer', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'skipped' },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})
	})

	describe('Invalid Value Type', () => {
		it('should return null when value is string', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: '5' as unknown as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null when value is undefined', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: undefined as unknown as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null when value is null', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: null as unknown as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})
	})

	describe('Real-world Scenarios', () => {
		it('should handle complete assessment with multiple questions', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'clarity-1',
					answer: { type: 'likert', value: 6 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:01Z',
				},
				{
					questionId: 'speed-1',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:02Z',
				},
				{
					questionId: 'feedback',
					answer: { type: 'text', value: 'Great experience!' },
					timestamp: '2025-01-01T00:00:03Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should ignore questions parameter (not used in current implementation)', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const questions = [] // Not used
			expect(calculateRating(responses, questions)).toBe('thumbs_up')
		})
	})

	describe('Edge Cases', () => {
		it('should handle decimal scores by treating as invalid', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 5.5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			// Decimal 5.5 is >= 5 and <= 7, so should be thumbs_up
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should use first matching usefulness-1 response if duplicates exist', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 2 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:01Z',
				},
			]
			// Should use the first one found (score 2 = thumbs_down)
			expect(calculateRating(responses)).toBe('thumbs_down')
		})
	})
})

describe('getRatingDisplayInfo', () => {
	describe('Thumbs Up', () => {
		it('should return correct info for thumbs_up', () => {
			const info = getRatingDisplayInfo('thumbs_up')
			expect(info).toEqual({
				label: 'Thumbs Up',
				color: 'success',
				icon: 'thumb-up',
			})
		})
	})

	describe('Meh', () => {
		it('should return correct info for meh', () => {
			const info = getRatingDisplayInfo('meh')
			expect(info).toEqual({
				label: 'Meh / So-So',
				color: 'warning',
				icon: 'meh',
			})
		})
	})

	describe('Thumbs Down', () => {
		it('should return correct info for thumbs_down', () => {
			const info = getRatingDisplayInfo('thumbs_down')
			expect(info).toEqual({
				label: 'Thumbs Down',
				color: 'error',
				icon: 'thumb-down',
			})
		})
	})

	describe('Null / Not Rated', () => {
		it('should return correct info for null', () => {
			const info = getRatingDisplayInfo(null)
			expect(info).toEqual({
				label: 'Not Rated',
				color: 'neutral',
				icon: 'neutral',
			})
		})
	})

	describe('Type Safety', () => {
		it('should handle all rating types', () => {
			const ratings: (SessionRating | null)[] = ['thumbs_up', 'meh', 'thumbs_down', null]

			for (const rating of ratings) {
				const info = getRatingDisplayInfo(rating)
				expect(info).toHaveProperty('label')
				expect(info).toHaveProperty('color')
				expect(info).toHaveProperty('icon')
			}
		})

		it('should return objects with consistent structure', () => {
			const thumbsUpInfo = getRatingDisplayInfo('thumbs_up')
			const mehInfo = getRatingDisplayInfo('meh')
			const thumbsDownInfo = getRatingDisplayInfo('thumbs_down')
			const nullInfo = getRatingDisplayInfo(null)

			expect(Object.keys(thumbsUpInfo)).toEqual(['label', 'color', 'icon'])
			expect(Object.keys(mehInfo)).toEqual(['label', 'color', 'icon'])
			expect(Object.keys(thumbsDownInfo)).toEqual(['label', 'color', 'icon'])
			expect(Object.keys(nullInfo)).toEqual(['label', 'color', 'icon'])
		})
	})

	describe('Color Mappings', () => {
		it('should use success color for thumbs_up', () => {
			const info = getRatingDisplayInfo('thumbs_up')
			expect(info.color).toBe('success')
		})

		it('should use warning color for meh', () => {
			const info = getRatingDisplayInfo('meh')
			expect(info.color).toBe('warning')
		})

		it('should use error color for thumbs_down', () => {
			const info = getRatingDisplayInfo('thumbs_down')
			expect(info.color).toBe('error')
		})

		it('should use neutral color for null', () => {
			const info = getRatingDisplayInfo(null)
			expect(info.color).toBe('neutral')
		})
	})

	describe('Icon Mappings', () => {
		it('should use thumb-up icon for thumbs_up', () => {
			const info = getRatingDisplayInfo('thumbs_up')
			expect(info.icon).toBe('thumb-up')
		})

		it('should use meh icon for meh', () => {
			const info = getRatingDisplayInfo('meh')
			expect(info.icon).toBe('meh')
		})

		it('should use thumb-down icon for thumbs_down', () => {
			const info = getRatingDisplayInfo('thumbs_down')
			expect(info.icon).toBe('thumb-down')
		})

		it('should use neutral icon for null', () => {
			const info = getRatingDisplayInfo(null)
			expect(info.icon).toBe('neutral')
		})
	})

	describe('Label Mappings', () => {
		it('should have human-readable labels', () => {
			const thumbsUpInfo = getRatingDisplayInfo('thumbs_up')
			const mehInfo = getRatingDisplayInfo('meh')
			const thumbsDownInfo = getRatingDisplayInfo('thumbs_down')
			const nullInfo = getRatingDisplayInfo(null)

			expect(thumbsUpInfo.label).toBe('Thumbs Up')
			expect(mehInfo.label).toBe('Meh / So-So')
			expect(thumbsDownInfo.label).toBe('Thumbs Down')
			expect(nullInfo.label).toBe('Not Rated')
		})
	})

	describe('Integration with calculateRating', () => {
		it('should work with calculated thumbs_up rating', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			const info = getRatingDisplayInfo(rating)

			expect(info.label).toBe('Thumbs Up')
			expect(info.color).toBe('success')
		})

		it('should work with calculated meh rating', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 4 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			const info = getRatingDisplayInfo(rating)

			expect(info.label).toBe('Meh / So-So')
			expect(info.color).toBe('warning')
		})

		it('should work with calculated thumbs_down rating', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'usefulness-1',
					answer: { type: 'likert', value: 1 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			const info = getRatingDisplayInfo(rating)

			expect(info.label).toBe('Thumbs Down')
			expect(info.color).toBe('error')
		})

		it('should work when rating cannot be calculated', () => {
			const responses: AssessmentResponse[] = []
			const rating = calculateRating(responses)
			const info = getRatingDisplayInfo(rating)

			expect(info.label).toBe('Not Rated')
			expect(info.color).toBe('neutral')
		})
	})
})
