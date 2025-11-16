/**
 * Rating Utility - Calculate session rating from assessment responses
 */

export type SessionRating = 'thumbs_up' | 'meh' | 'thumbs_down'

export interface AssessmentAnswer {
  type: 'likert' | 'text' | 'choice' | 'skipped'
  value?: number | string
}

export interface AssessmentResponse {
  questionId: string
  answer: AssessmentAnswer
  timestamp: string
}

export interface AssessmentQuestionConfig {
  id: string
  text: string
  type: string
  category: string
  importance: string
  version: string[]
  required: boolean
  labels?: [string, string]
  choices?: string[]
  placeholder?: string
  helpText?: string
}

/**
 * Calculate session rating from assessment responses
 *
 * Logic: Uses the NPS question (nps_score)
 * - 0-6 = thumbs_down (Detractors)
 * - 7-8 = meh (Passives)
 * - 9-10 = thumbs_up (Promoters)
 *
 * @param responses - Array of assessment responses
 * @param questions - Array of question configurations (optional, for validation)
 * @returns Session rating or null if cannot be determined
 */
export function calculateRating(
  responses: AssessmentResponse[],
  _questions?: AssessmentQuestionConfig[]
): SessionRating | null {
  // Find the NPS question response (nps_score)
  const npsResponse = responses.find(r => r.questionId === 'nps_score')

  if (!npsResponse) {
    return null
  }

  const answer = npsResponse.answer

  // Only process likert-type answers
  if (answer.type !== 'likert' || typeof answer.value !== 'number') {
    return null
  }

  const score = answer.value

  // Map NPS score to rating
  if (score >= 0 && score <= 6) {
    return 'thumbs_down' // Detractors
  }
  if (score >= 7 && score <= 8) {
    return 'meh' // Passives
  }
  if (score >= 9 && score <= 10) {
    return 'thumbs_up' // Promoters
  }

  return null
}

/**
 * Convert rating to NPS score
 *
 * Reverse mapping of calculateRating()
 * - thumbs_down → 5 (Detractors: 0-6)
 * - meh → 7 (Passives: 7-8)
 * - thumbs_up → 9 (Promoters: 9-10)
 *
 * @param rating - Session rating
 * @returns NPS score (0-10) or null if no rating
 */
export function ratingToNpsScore(rating: SessionRating | null): number | null {
  switch (rating) {
    case 'thumbs_down':
      return 5 // Mid-point of detractors (0-6)
    case 'meh':
      return 7 // Lower end of passives (7-8)
    case 'thumbs_up':
      return 9 // Lower end of promoters (9-10)
    default:
      return null
  }
}

/**
 * Get rating display information
 */
export interface RatingDisplayInfo {
  label: string
  color: 'success' | 'warning' | 'error' | 'neutral'
  icon: 'thumb-up' | 'meh' | 'thumb-down' | 'neutral'
}

export function getRatingDisplayInfo(rating: SessionRating | null): RatingDisplayInfo {
  switch (rating) {
    case 'thumbs_up':
      return {
        label: 'Thumbs Up',
        color: 'success',
        icon: 'thumb-up',
      }
    case 'meh':
      return {
        label: 'Meh / So-So',
        color: 'warning',
        icon: 'meh',
      }
    case 'thumbs_down':
      return {
        label: 'Thumbs Down',
        color: 'error',
        icon: 'thumb-down',
      }
    default:
      return {
        label: 'Not Rated',
        color: 'neutral',
        icon: 'neutral',
      }
  }
}
