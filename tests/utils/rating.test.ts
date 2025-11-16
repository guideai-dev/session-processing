import { describe, it, expect } from 'vitest'
import {
	calculateRating,
	getRatingDisplayInfo,
	ratingToNpsScore,
	type AssessmentResponse,
	type SessionRating,
} from '../../src/utils/rating.js'

describe('calculateRating', () => {
	describe('Thumbs Down (Detractors 0-6)', () => {
		it('should return thumbs_down for score of 0', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 0 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})

		it('should return thumbs_down for score of 3', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 3 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})

		it('should return thumbs_down for score of 6', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 6 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_down')
		})
	})

	describe('Meh (Passives 7-8)', () => {
		it('should return meh for score of 7', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 7 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('meh')
		})

		it('should return meh for score of 8', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 8 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('meh')
		})
	})

	describe('Thumbs Up (Promoters 9-10)', () => {
		it('should return thumbs_up for score of 9', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should return thumbs_up for score of 10', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 10 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})
	})

	describe('Invalid Scores', () => {
		it('should return null for score of 11', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 11 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for negative score', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: -1 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for very large score', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 100 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})
	})

	describe('Missing NPS Question', () => {
		it('should return null when nps_score question not found', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'other-question',
					answer: { type: 'likert', value: 9 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for empty responses array', () => {
			expect(calculateRating([])).toBeNull()
		})

		it('should find nps_score among multiple responses', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'task_helpfulness',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9 },
					timestamp: '2025-01-01T00:00:01Z',
				},
				{
					questionId: 'best_contribution',
					answer: { type: 'text', value: 'Great feedback!' },
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
					questionId: 'nps_score',
					answer: { type: 'text', value: 'very helpful' },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for choice answer', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'choice', value: 'option-a' },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null for skipped answer', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
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
					questionId: 'nps_score',
					answer: { type: 'likert', value: '9' as unknown as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null when value is undefined', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: undefined as unknown as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			expect(calculateRating(responses)).toBeNull()
		})

		it('should return null when value is null', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
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
					questionId: 'task_helpfulness',
					answer: { type: 'likert', value: 6 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9 },
					timestamp: '2025-01-01T00:00:01Z',
				},
				{
					questionId: 'cognitive_load',
					answer: { type: 'likert', value: 5 },
					timestamp: '2025-01-01T00:00:02Z',
				},
				{
					questionId: 'best_contribution',
					answer: { type: 'text', value: 'Great experience!' },
					timestamp: '2025-01-01T00:00:03Z',
				},
			]
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should ignore questions parameter (not used in current implementation)', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const questions = [] // Not used
			expect(calculateRating(responses, questions)).toBe('thumbs_up')
		})
	})

	describe('Edge Cases', () => {
		it('should handle decimal scores', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9.5 },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			// Decimal 9.5 is >= 9 and <= 10, so should be thumbs_up
			expect(calculateRating(responses)).toBe('thumbs_up')
		})

		it('should use first matching nps_score response if duplicates exist', () => {
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 3 },
					timestamp: '2025-01-01T00:00:00Z',
				},
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: 10 },
					timestamp: '2025-01-01T00:00:01Z',
				},
			]
			// Should use the first one found (score 3 = thumbs_down)
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
					questionId: 'nps_score',
					answer: { type: 'likert', value: 9 },
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
					questionId: 'nps_score',
					answer: { type: 'likert', value: 7 },
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
					questionId: 'nps_score',
					answer: { type: 'likert', value: 3 },
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

describe('ratingToNpsScore', () => {
	describe('Thumbs Down → NPS 5', () => {
		it('should convert thumbs_down to NPS score 5', () => {
			const score = ratingToNpsScore('thumbs_down')
			expect(score).toBe(5)
		})

		it('should be in detractor range (0-6)', () => {
			const score = ratingToNpsScore('thumbs_down')
			expect(score).toBeGreaterThanOrEqual(0)
			expect(score).toBeLessThanOrEqual(6)
		})
	})

	describe('Meh → NPS 7', () => {
		it('should convert meh to NPS score 7', () => {
			const score = ratingToNpsScore('meh')
			expect(score).toBe(7)
		})

		it('should be in passive range (7-8)', () => {
			const score = ratingToNpsScore('meh')
			expect(score).toBeGreaterThanOrEqual(7)
			expect(score).toBeLessThanOrEqual(8)
		})
	})

	describe('Thumbs Up → NPS 9', () => {
		it('should convert thumbs_up to NPS score 9', () => {
			const score = ratingToNpsScore('thumbs_up')
			expect(score).toBe(9)
		})

		it('should be in promoter range (9-10)', () => {
			const score = ratingToNpsScore('thumbs_up')
			expect(score).toBeGreaterThanOrEqual(9)
			expect(score).toBeLessThanOrEqual(10)
		})
	})

	describe('Null Rating', () => {
		it('should return null for null rating', () => {
			const score = ratingToNpsScore(null)
			expect(score).toBeNull()
		})
	})

	describe('Bidirectional Mapping Consistency', () => {
		it('thumbs_down → 5 → thumbs_down should be consistent', () => {
			// Start with thumbs_down
			const npsScore = ratingToNpsScore('thumbs_down')
			expect(npsScore).toBe(5)

			// Convert back to rating
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: npsScore as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			expect(rating).toBe('thumbs_down')
		})

		it('meh → 7 → meh should be consistent', () => {
			// Start with meh
			const npsScore = ratingToNpsScore('meh')
			expect(npsScore).toBe(7)

			// Convert back to rating
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: npsScore as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			expect(rating).toBe('meh')
		})

		it('thumbs_up → 9 → thumbs_up should be consistent', () => {
			// Start with thumbs_up
			const npsScore = ratingToNpsScore('thumbs_up')
			expect(npsScore).toBe(9)

			// Convert back to rating
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: npsScore as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const rating = calculateRating(responses)
			expect(rating).toBe('thumbs_up')
		})

		it('null → null should be consistent', () => {
			// Start with null
			const npsScore = ratingToNpsScore(null)
			expect(npsScore).toBeNull()
		})
	})

	describe('Integration with Quick Rating Flow', () => {
		it('should support quick rating use case', () => {
			// User gives thumbs up
			const rating: SessionRating = 'thumbs_up'

			// Convert to NPS for database storage
			const npsScore = ratingToNpsScore(rating)
			expect(npsScore).toBe(9)

			// Later, calculate rating from stored NPS
			const responses: AssessmentResponse[] = [
				{
					questionId: 'nps_score',
					answer: { type: 'likert', value: npsScore as number },
					timestamp: '2025-01-01T00:00:00Z',
				},
			]
			const calculatedRating = calculateRating(responses)
			expect(calculatedRating).toBe('thumbs_up')
		})

		it('should handle all rating types in quick rating flow', () => {
			const ratings: SessionRating[] = ['thumbs_down', 'meh', 'thumbs_up']

			for (const rating of ratings) {
				// Convert to NPS
				const npsScore = ratingToNpsScore(rating)
				expect(npsScore).not.toBeNull()

				// Convert back
				const responses: AssessmentResponse[] = [
					{
						questionId: 'nps_score',
						answer: { type: 'likert', value: npsScore as number },
						timestamp: '2025-01-01T00:00:00Z',
					},
				]
				const calculatedRating = calculateRating(responses)
				expect(calculatedRating).toBe(rating)
			}
		})
	})

	describe('Type Safety', () => {
		it('should accept all SessionRating types', () => {
			const ratings: (SessionRating | null)[] = ['thumbs_up', 'meh', 'thumbs_down', null]

			for (const rating of ratings) {
				const score = ratingToNpsScore(rating)
				expect(score === null || typeof score === 'number').toBe(true)
			}
		})

		it('should return number or null only', () => {
			const thumbsUpScore = ratingToNpsScore('thumbs_up')
			const mehScore = ratingToNpsScore('meh')
			const thumbsDownScore = ratingToNpsScore('thumbs_down')
			const nullScore = ratingToNpsScore(null)

			expect(typeof thumbsUpScore).toBe('number')
			expect(typeof mehScore).toBe('number')
			expect(typeof thumbsDownScore).toBe('number')
			expect(nullScore).toBeNull()
		})
	})
})
