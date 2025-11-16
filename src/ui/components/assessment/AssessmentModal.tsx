import type { AssessmentAnswer, AssessmentResponse, AssessmentVersion } from '@guideai-dev/types'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useState } from 'react'
import { ProgressBar } from './ProgressBar'
import { QuestionCard } from './QuestionCard'
import { VersionSelector } from './VersionSelector'
import type { AssessmentModalProps } from './types'

export function AssessmentModal({
  sessionId: _sessionId,
  isOpen,
  onClose,
  questions,
  initialResponses = {},
  onSubmit,
  onDraft,
}: AssessmentModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<AssessmentVersion | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, AssessmentAnswer>>(initialResponses)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)

  // Reset start time when modal opens
  useEffect(() => {
    if (isOpen && !startTime) {
      setStartTime(Date.now())
    }
  }, [isOpen, startTime])

  // Filter questions based on selected version
  const filteredQuestions = selectedVersion
    ? questions.filter(q => q.version.includes(selectedVersion))
    : questions

  const currentQuestion = filteredQuestions[currentIndex]
  const isLastQuestion = currentIndex === filteredQuestions.length - 1
  const canGoNext = responses[currentQuestion?.id] !== undefined

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!isOpen || !onDraft) return

    const interval = setInterval(() => {
      const responseArray = Object.entries(responses).map(([questionId, answer]) => ({
        questionId,
        answer,
        timestamp: new Date().toISOString(),
      }))

      if (responseArray.length > 0) {
        onDraft(responseArray).catch(console.error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen, responses, onDraft])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore arrow keys if user is typing in a text field
      if (
        e.target instanceof HTMLTextAreaElement &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        return
      }

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && canGoNext && !isLastQuestion) {
        handleNext()
      } else if (e.key === 'ArrowRight' && canGoNext && !isLastQuestion) {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault()
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, canGoNext, isLastQuestion, currentIndex, onClose])

  const handleAnswer = useCallback(
    (answer: AssessmentAnswer) => {
      setResponses(prev => ({
        ...prev,
        [currentQuestion.id]: answer,
      }))
    },
    [currentQuestion]
  )

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const responseArray: AssessmentResponse[] = Object.entries(responses).map(
        ([questionId, answer]) => ({
          questionId,
          answer,
          timestamp: new Date().toISOString(),
        })
      )

      // Calculate duration in seconds
      const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined

      await onSubmit(responseArray, durationSeconds)
      setShowCompletion(true)

      // Auto-close after showing completion
      setTimeout(() => {
        setShowCompletion(false)
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Failed to submit assessment:', error)
      alert('Failed to submit assessment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0)
      setShowCompletion(false)
      setSelectedVersion(null)
      setStartTime(null) // Reset start time for next use
    }
  }, [isOpen])

  const handleVersionSelect = (version: AssessmentVersion) => {
    setSelectedVersion(version)
  }

  if (!isOpen) return null

  // Completion screen
  if (showCompletion) {
    return (
      <div className="modal modal-open">
        <div className="modal-box max-w-md text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckIcon className="w-10 h-10 text-success" />
            </div>
            <h3 className="text-2xl font-bold">Thank You!</h3>
            <p className="text-base-content/70">Your feedback has been submitted successfully.</p>
          </div>
        </div>
        <div className="modal-backdrop bg-black/50 backdrop-blur-sm" />
      </div>
    )
  }

  // Version selection screen
  if (!selectedVersion) {
    return (
      <div className="modal modal-open">
        <div className="modal-box max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-bold">Session Assessment</h2>
            <button type="button" onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Version Selector */}
          <VersionSelector onSelect={handleVersionSelect} />
        </div>

        {/* Backdrop */}
        <div className="modal-backdrop bg-black/70 backdrop-blur-sm" onClick={onClose} />
      </div>
    )
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold">Session Assessment</h2>
          <button type="button" onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <ProgressBar
          current={currentIndex + 1}
          total={filteredQuestions.length}
          className="mb-6 md:mb-8"
        />

        {/* Question */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            value={responses[currentQuestion.id]}
            onChange={handleAnswer}
            onNext={!isLastQuestion ? handleNext : undefined}
            autoFocus
          />
        )}

        {/* Navigation */}
        <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center justify-between gap-3 mt-6 md:mt-8 pt-4 md:pt-6 border-t border-base-300">
          {/* Previous button - Left side on desktop, bottom on mobile */}
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="btn btn-ghost gap-2"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Previous
          </button>

          {/* Keyboard hints - Center on desktop, hidden on mobile */}
          <div className="hidden md:block text-center text-xs text-base-content/50 space-y-1">
            <div>
              <kbd className="kbd kbd-xs">←</kbd> Previous • <kbd className="kbd kbd-xs">→</kbd>{' '}
              Next
              {currentQuestion?.type !== 'text' && (
                <span>
                  {' '}
                  • <kbd className="kbd kbd-xs">Esc</kbd> to close
                </span>
              )}
            </div>
            {(currentQuestion?.type === 'likert-5' || currentQuestion?.type === 'likert-7') && (
              <div className="text-base-content/40">Use number keys to select • Auto-advances</div>
            )}
            {currentQuestion?.type === 'choice' && (
              <div className="text-base-content/40">Use number or letter keys • Auto-advances</div>
            )}
          </div>

          {/* Next/Submit button - Right side on desktop, top on mobile */}
          {isLastQuestion ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canGoNext || isSubmitting}
              className="btn btn-primary gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit
                  <CheckIcon className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="btn btn-primary gap-2"
            >
              Next
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div className="modal-backdrop bg-black/70 backdrop-blur-sm" onClick={onClose} />
    </div>
  )
}
