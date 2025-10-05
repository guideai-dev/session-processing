import { useEffect, useRef } from 'react'
import type { QuestionCardProps } from './types'
import { LikertScale } from './LikertScale'
import { TextResponse } from './TextResponse'
import { ChoiceResponse } from './ChoiceResponse'

export function QuestionCard({ question, value, onChange, onNext, autoFocus }: QuestionCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [autoFocus])

  // Keyboard shortcuts
  useEffect(() => {
    if (!autoFocus) return // Only active when this question is focused

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text field
      if (e.target instanceof HTMLTextAreaElement) return

      const key = e.key.toLowerCase()

      // Number keys for Likert scales
      if (question.type === 'likert-5' || question.type === 'likert-7') {
        const maxScale = question.type === 'likert-5' ? 5 : 7
        const num = parseInt(key)

        if (!isNaN(num) && num >= 1 && num <= maxScale) {
          e.preventDefault()
          handleLikertChange(num)
        }
      }

      // Number keys or letter keys for multiple choice
      if (question.type === 'choice' && question.choices) {
        let choiceIndex = -1

        // Check for number keys (1-9)
        const num = parseInt(key)
        if (!isNaN(num) && num >= 1 && num <= question.choices.length) {
          choiceIndex = num - 1
        }
        // Check for letter keys (a-z)
        else if (key >= 'a' && key <= 'z') {
          const letterIndex = key.charCodeAt(0) - 'a'.charCodeAt(0)
          if (letterIndex < question.choices.length) {
            choiceIndex = letterIndex
          }
        }

        if (choiceIndex >= 0) {
          e.preventDefault()
          handleChoiceChange(question.choices[choiceIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [autoFocus, question, onNext])

  const handleLikertChange = (numValue: number) => {
    // Check if this is actually a change
    const isChanging = !value || value.type !== 'likert' || value.value !== numValue

    onChange({ type: 'likert', value: numValue })

    // Only auto-advance if we're actually changing the answer
    if (isChanging && onNext) {
      setTimeout(onNext, 300)
    }
  }

  const handleTextChange = (textValue: string) => {
    onChange({ type: 'text', value: textValue })
  }

  const handleChoiceChange = (choiceValue: string) => {
    // Check if this is actually a change
    const isChanging = !value || value.type !== 'choice' || value.value !== choiceValue

    onChange({ type: 'choice', value: choiceValue })

    // Only auto-advance if we're actually changing the answer
    if (isChanging && onNext) {
      setTimeout(onNext, 300)
    }
  }

  const handleSkip = () => {
    onChange({ type: 'skipped' })
    if (onNext) {
      onNext()
    }
  }

  const renderInput = () => {
    switch (question.type) {
      case 'likert-5':
        return (
          <LikertScale
            scale={5}
            value={value?.type === 'likert' ? value.value : undefined}
            onChange={handleLikertChange}
            labels={question.labels}
          />
        )
      case 'likert-7':
        return (
          <LikertScale
            scale={7}
            value={value?.type === 'likert' ? value.value : undefined}
            onChange={handleLikertChange}
            labels={question.labels}
          />
        )
      case 'text':
        return (
          <TextResponse
            value={value?.type === 'text' ? value.value : undefined}
            onChange={handleTextChange}
            placeholder={question.placeholder}
          />
        )
      case 'choice':
        return (
          <ChoiceResponse
            choices={question.choices || []}
            value={value?.type === 'choice' ? value.value : undefined}
            onChange={handleChoiceChange}
          />
        )
      default:
        return <div className="text-error">Unknown question type: {question.type}</div>
    }
  }

  const hasAnswer = value && value.type !== 'skipped'

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Question text */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-semibold">{question.text}</h3>
        {question.helpText && (
          <p className="text-sm text-base-content/60">{question.helpText}</p>
        )}
        {!question.required && (
          <p className="text-xs text-base-content/50">(Optional)</p>
        )}
      </div>

      {/* Input */}
      <div className="max-w-2xl mx-auto">
        {renderInput()}
      </div>

      {/* Skip button for optional questions */}
      {!question.required && !hasAnswer && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleSkip}
            className="btn btn-ghost btn-sm"
          >
            {question.skipLabel || 'Skip'}
          </button>
        </div>
      )}
    </div>
  )
}