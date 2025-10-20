/**
 * PhaseIcon - Maps phase types to HeroIcons and colors
 */

import {
  BoltIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  StopCircleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import type React from 'react'

export type SessionPhaseType =
  | 'initial_specification'
  | 'analysis_planning'
  | 'plan_modification'
  | 'plan_agreement'
  | 'execution'
  | 'interruption'
  | 'task_assignment'
  | 'completion'
  | 'correction'
  | 'final_completion'
  | 'other'

/**
 * Get the HeroIcon component for a phase type
 */
export function getPhaseIcon(phaseType: SessionPhaseType) {
  const iconMap: Record<SessionPhaseType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    initial_specification: DocumentTextIcon,
    analysis_planning: MagnifyingGlassIcon,
    plan_modification: PencilSquareIcon,
    plan_agreement: HandThumbUpIcon,
    execution: BoltIcon,
    interruption: StopCircleIcon,
    task_assignment: ClipboardDocumentListIcon,
    completion: CheckCircleIcon,
    correction: WrenchScrewdriverIcon,
    final_completion: SparklesIcon,
    other: QuestionMarkCircleIcon,
  }

  return iconMap[phaseType] || QuestionMarkCircleIcon
}

/**
 * Get the color class for a phase type
 */
export function getPhaseColor(phaseType: SessionPhaseType): string {
  const colorMap: Record<SessionPhaseType, string> = {
    initial_specification: 'text-info',
    analysis_planning: 'text-purple-500',
    plan_modification: 'text-blue-500',
    plan_agreement: 'text-success',
    execution: 'text-yellow-500',
    interruption: 'text-red-500',
    task_assignment: 'text-cyan-500',
    completion: 'text-green-500',
    correction: 'text-red-500',
    final_completion: 'text-green-600',
    other: 'text-base-content/50',
  }

  return colorMap[phaseType] || 'text-base-content/50'
}

/**
 * Get the border color class for a phase type
 */
export function getPhaseBorderColor(phaseType: SessionPhaseType): string {
  const borderColorMap: Record<SessionPhaseType, string> = {
    initial_specification: 'border-info',
    analysis_planning: 'border-purple-500',
    plan_modification: 'border-blue-500',
    plan_agreement: 'border-success',
    execution: 'border-yellow-500',
    interruption: 'border-red-500',
    task_assignment: 'border-cyan-500',
    completion: 'border-green-500',
    correction: 'border-red-500',
    final_completion: 'border-green-600',
    other: 'border-base-content/50',
  }

  return borderColorMap[phaseType] || 'border-base-content/50'
}

/**
 * Format phase type name for display
 */
export function formatPhaseType(phaseType: SessionPhaseType): string {
  return phaseType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
