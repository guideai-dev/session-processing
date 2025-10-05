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
 * Logic: Uses the "How helpful was the AI" question (usefulness-1)
 * - 1-3 = thumbs_down
 * - 4 = meh
 * - 5-7 = thumbs_up
 *
 * @param responses - Array of assessment responses
 * @param questions - Array of question configurations (optional, for validation)
 * @returns Session rating or null if cannot be determined
 */
export function calculateRating(
  responses: AssessmentResponse[],
  questions?: AssessmentQuestionConfig[]
): SessionRating | null {
  // Find the helpfulness question response (usefulness-1)
  const helpfulnessResponse = responses.find(r => r.questionId === 'usefulness-1')

  if (!helpfulnessResponse) {
    return null
  }

  const answer = helpfulnessResponse.answer

  // Only process likert-type answers
  if (answer.type !== 'likert' || typeof answer.value !== 'number') {
    return null
  }

  const score = answer.value

  // Map score to rating
  if (score >= 1 && score <= 3) {
    return 'thumbs_down'
  } else if (score === 4) {
    return 'meh'
  } else if (score >= 5 && score <= 7) {
    return 'thumbs_up'
  }

  return null
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
