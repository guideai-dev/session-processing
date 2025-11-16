/**
 * AssessmentSection - Displays session assessment results
 *
 * CONVERTED TO PROPS-BASED: This component now accepts assessment data and questions as props
 * instead of fetching them via hooks. The parent component should handle data fetching.
 */

import type { Assessment, AssessmentAnswer, AssessmentResponse } from '@guideai-dev/types'
import type { SessionRating } from '../../../utils/rating.js'
import { RatingBadge } from '../RatingBadge.js'
import { MetricSection } from './MetricSection.js'

// Type definitions for assessment data
interface AssessmentQuestion {
  id: string
  text: string
  category?: string
  importance?: 'high' | 'medium' | 'low'
}

// Add status field for backward compatibility with UI
type AssessmentWithStatus = Assessment & { status?: 'not_started' | 'rating_only' | 'in_progress' | 'completed' }

interface AssessmentSectionProps {
  sessionId: string
  assessment?: AssessmentWithStatus | null
  questions?: AssessmentQuestion[]
  isLoading?: boolean
  onRate?: (rating: SessionRating) => void
}

export function AssessmentSection({
  sessionId: _sessionId,
  assessment,
  questions = [],
  isLoading = false,
  onRate,
}: AssessmentSectionProps) {
  if (isLoading) {
    return (
      <MetricSection
        title="Session Assessment"
        subtitle="User feedback on AI session quality"
        icon="📝"
      >
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-md" />
        </div>
      </MetricSection>
    )
  }

  if (!assessment || assessment.status === 'not_started') {
    return (
      <MetricSection
        title="Session Assessment"
        subtitle="User feedback on AI session quality"
        icon="📝"
      >
        <div className="text-center py-8">
          <p className="text-base-content/60">No assessment completed for this session yet.</p>
        </div>
      </MetricSection>
    )
  }

  // Handle rating_only status (quick rating without full assessment)
  const isRatingOnly = assessment.status === 'rating_only'
  const hasResponses = assessment.responses && assessment.responses.length > 0

  // Create a map of question IDs to question configs
  const _questionMap = new Map(questions.map(q => [q.id, q]))

  // Create a map of response IDs to responses for quick lookup
  const responseMap = new Map((assessment.responses || []).map(r => [r.questionId, r]))

  // Sort responses in the same order as questions
  const orderedResponses = questions
    .map(question => {
      const response = responseMap.get(question.id)
      return response ? { question, response } : null
    })
    .filter(Boolean) as Array<{ question: AssessmentQuestion; response: AssessmentResponse }>

  const categoryLabels: Record<string, string> = {
    usefulness: '💡 Usefulness',
    trust: '🔒 Trust',
    cognitive: '🧠 Cognitive',
    learning: '📚 Learning',
    satisfaction: '😊 Satisfaction',
    comparison: '👥 Comparison',
    reflection: '💭 Reflection',
  }

  const formatAnswer = (answer: AssessmentAnswer, question: AssessmentQuestion) => {
    if (answer.type === 'skipped') {
      return <span className="text-base-content/40 italic">Skipped</span>
    }

    if (answer.type === 'likert') {
      // Determine scale based on question type
      let scaleSize = 7
      let startValue = 1

      if (question.id === 'nps_score') {
        // NPS is 0-10
        scaleSize = 11
        startValue = 0
      } else if (
        question.id === 'deployment_confidence' ||
        question.id === 'mental_alignment' ||
        question.id === 'pair_programming_comparison'
      ) {
        // These are likert-5
        scaleSize = 5
      }
      // Default is likert-7 (most questions)

      return (
        <div className="flex items-center gap-2">
          <div className="rating rating-sm">
            {Array.from({ length: scaleSize }, (_, i) => (
              <input
                key={`likert-${startValue + i}`}
                type="radio"
                className="mask mask-circle bg-primary"
                checked={answer.value === startValue + i}
                disabled
              />
            ))}
          </div>
          <span className="text-lg font-semibold text-primary">{answer.value}</span>
        </div>
      )
    }

    if (answer.type === 'choice') {
      return <div className="badge badge-primary badge-lg">{answer.value}</div>
    }

    if (answer.type === 'text') {
      return (
        <div className="card bg-base-200/50 p-3 mt-2">
          <p className="text-sm whitespace-pre-wrap">
            {answer.value || <span className="text-base-content/40 italic">No response</span>}
          </p>
        </div>
      )
    }

    return null
  }

  return (
    <MetricSection
      title="Session Assessment"
      subtitle={
        isRatingOnly
          ? 'Quick rating provided'
          : `User feedback completed ${new Date(assessment.completedAt || '').toLocaleDateString()}`
      }
      icon="📝"
    >
      <div className="space-y-6">
        {/* Quick Rating Only Message */}
        {isRatingOnly && !hasResponses && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body text-center py-8">
              <div className="mb-4">
                <RatingBadge
                  rating={(assessment.rating as SessionRating) || null}
                  onRate={onRate}
                  size="lg"
                />
              </div>
              <p className="text-base-content/70">
                This session was given a quick rating without completing the full assessment.
              </p>
              <p className="text-sm text-base-content/60 mt-2">
                Completed {new Date(assessment.completedAt || '').toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Questions in survey order */}
        {hasResponses && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <div className="space-y-4">
                {orderedResponses.map(({ question, response }, index) => (
                  <div key={response.questionId}>
                    <div className="flex items-start gap-4">
                      {/* Question number */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-base-200 flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm font-medium">{question.text}</p>
                          <div className="flex items-center gap-2">
                            {question.category && (
                              <div className="badge badge-sm badge-ghost">
                                {categoryLabels[question.category] || question.category}
                              </div>
                            )}
                            {question.importance && (
                              <div
                                className={`badge badge-sm ${
                                  question.importance === 'high'
                                    ? 'badge-error'
                                    : question.importance === 'medium'
                                      ? 'badge-warning'
                                      : 'badge-ghost'
                                }`}
                              >
                                {question.importance}
                              </div>
                            )}
                          </div>
                        </div>
                        {formatAnswer(response.answer, question)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats - only show if we have full assessment data */}
        {hasResponses && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat bg-base-200 rounded-lg p-4">
                  <div className="stat-title text-xs">Questions Answered</div>
                  <div className="stat-value text-2xl">
                    {assessment.responses.filter(r => r.answer.type !== 'skipped').length}
                  </div>
                  <div className="stat-desc text-xs">of {assessment.responses.length} total</div>
                </div>
                <div className="stat bg-base-200 rounded-lg p-4">
                  <div className="stat-title text-xs">Status</div>
                  <div className="stat-value text-2xl">
                    {assessment.status === 'completed' ? '✓' : '•••'}
                  </div>
                  <div className="stat-desc text-xs capitalize">{assessment.status}</div>
                </div>
                <div className="stat bg-base-200 rounded-lg p-4">
                  <div className="stat-title text-xs">Completed</div>
                  <div className="stat-value text-base">
                    {assessment.completedAt
                      ? new Date(assessment.completedAt).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div className="stat-desc text-xs">
                    {assessment.completedAt
                      ? new Date(assessment.completedAt).toLocaleTimeString()
                      : ''}
                  </div>
                </div>
                <div className="stat bg-base-200 rounded-lg p-4">
                  <div className="stat-title text-xs">Rating</div>
                  <div className="stat-value flex items-center justify-center py-2">
                    <RatingBadge
                      rating={(assessment.rating as SessionRating) || null}
                      onRate={onRate}
                      size="lg"
                    />
                  </div>
                  <div className="stat-desc text-xs text-center">
                    {assessment.rating ? 'Quick rating' : 'Click to rate'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MetricSection>
  )
}
