import type {
  AssessmentAnswer,
  AssessmentQuestionConfig,
  AssessmentResponse,
} from '@guideai-dev/types'

export interface AssessmentModalProps {
  sessionId: string
  isOpen: boolean
  onClose: () => void
  questions: AssessmentQuestionConfig[]
  initialResponses?: Record<string, AssessmentAnswer>
  onSubmit: (responses: AssessmentResponse[], durationSeconds?: number) => Promise<void>
  onDraft?: (responses: AssessmentResponse[]) => Promise<void>
}

export interface QuestionCardProps {
  question: AssessmentQuestionConfig
  value?: AssessmentAnswer
  onChange: (answer: AssessmentAnswer) => void
  onNext?: () => void
  autoFocus?: boolean
}

export interface LikertScaleProps {
  scale: 5 | 7
  value?: number
  onChange: (value: number) => void
  labels?: [string, string]
  disabled?: boolean
}

export interface TextResponseProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export interface ProgressBarProps {
  current: number
  total: number
  className?: string
}
