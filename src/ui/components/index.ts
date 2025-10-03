/**
 * UI Components - Session Processing Components
 *
 * This package provides UI components for displaying and interacting with AI session data.
 * Components are designed to be framework-agnostic and accept data via props.
 */

// Timeline Components - For rendering session messages and content
export {
  TimelineMessage,
  TimelineGroup,
  MessageHeader,
  ContentRenderer,
  TextBlock,
  CodeBlock,
  ImageBlock,
  JsonBlock,
  ToolBlock,
  ToolResultBlock,
} from './timeline/index.js'

// Metrics Components - For displaying session analytics
export { MetricCard } from './metrics/MetricCard.js'
export { MetricSection } from './metrics/MetricSection.js'
export { AssessmentSection } from './metrics/AssessmentSection.js'
export { MetricsOverview, type SessionMetricsUI } from './metrics/MetricsOverview.js'

// Utility Components - Filters and UI elements
export { default as DateFilter } from './DateFilter.js'
export type { DateFilterOption, DateRange, DateFilterValue } from './DateFilter.js'

// Session Components - For displaying session cards
export { default as SessionCard } from './SessionCard.js'

/**
 * Note about SessionList:
 *
 * The SessionList component was not included because it has heavy dependencies on:
 * - Server-specific API hooks (useAgentSessions, useAuth, etc.)
 * - WebSocket stores for real-time updates
 * - React Router for URL-based state management
 * - Complex server-specific UI components
 *
 * Instead, use the SessionCard component and build your own list component
 * that integrates with your data fetching and state management solution.
 *
 * See SESSION_LIST_NOTE.md for more details.
 */
