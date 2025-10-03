# API Hooks Conversion Guide

This document describes all the API hooks that were found in the copied components and how they were handled during the migration to the session-processing package.

## Summary

All components have been **converted from hook-based to props-based** to make them reusable across different environments (server, desktop app, CLI, etc.). The parent component is now responsible for data fetching and passing data down as props.

---

## Components and Their Original Dependencies

### 1. MetricCard.tsx

**Original Dependencies:**
- `formatDuration` from `useSessionMetrics` hook
- `formatPercentage` from `useSessionMetrics` hook
- `getMetricColor` from `useSessionMetrics` hook

**Solution:**
- ✅ **Inlined utilities** - These simple formatting functions were copied directly into the component
- No external dependencies required
- Component is now fully self-contained

**Usage:**
```typescript
import { MetricCard } from '@guideai/session-processing/ui/components'

<MetricCard
  label="Task Success Rate"
  value={85.5}
  type="percentage"
  tooltip="Percentage of operations that succeeded"
/>
```

---

### 2. AssessmentSection.tsx

**Original Dependencies:**
- `useSessionAssessment(sessionId)` - Fetches assessment data for a session
- `useAssessmentQuestions()` - Fetches question definitions

**Solution:**
- ✅ **Converted to props-based** - Component now accepts assessment data and questions as props
- Parent component handles data fetching

**Props Interface:**
```typescript
interface AssessmentSectionProps {
  sessionId: string
  assessment?: Assessment | null      // Previously from useSessionAssessment
  questions?: AssessmentQuestion[]    // Previously from useAssessmentQuestions
  isLoading?: boolean                 // Loading state from parent
}
```

**Usage Example:**
```typescript
import { AssessmentSection } from '@guideai/session-processing/ui/components'

// Parent component fetches data
const { assessment, isLoading } = useSessionAssessment(sessionId)
const { questions } = useAssessmentQuestions()

// Pass as props
<AssessmentSection
  sessionId={sessionId}
  assessment={assessment}
  questions={questions}
  isLoading={isLoading}
/>
```

---

### 3. MetricsOverview.tsx

**Original Dependencies:**
- `useSessionMetrics(sessionId)` - Fetches metrics data

**Solution:**
- ✅ **Converted to props-based** - Component accepts metrics data as props
- Parent component handles data fetching
- Added comprehensive prop interface for all possible data

**Props Interface:**
```typescript
interface MetricsOverviewProps {
  sessionId: string
  metrics?: SessionMetricsUI | null          // Previously from useSessionMetrics
  isLoading?: boolean                        // Loading state
  error?: Error | null                       // Error state
  onProcessSession?: () => void              // Action callbacks
  onCancelProcessing?: () => void
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null
  isProcessing?: boolean
  isCancelling?: boolean
  aiModelSummary?: string | null
  aiModelQualityScore?: number | null
  aiModelMetadata?: any | null
  // Assessment data (delegated to AssessmentSection)
  assessment?: any
  assessmentQuestions?: any[]
  assessmentLoading?: boolean
}
```

**Usage Example:**
```typescript
import { MetricsOverview } from '@guideai/session-processing/ui/components'

// Parent fetches data
const { data: metrics, isLoading, error } = useSessionMetrics(sessionId)
const { assessment } = useSessionAssessment(sessionId)
const { questions } = useAssessmentQuestions()

// Pass as props
<MetricsOverview
  sessionId={sessionId}
  metrics={metrics}
  isLoading={isLoading}
  error={error}
  assessment={assessment}
  assessmentQuestions={questions}
  onProcessSession={handleProcess}
  aiModelSummary={session.aiModelSummary}
  aiModelQualityScore={session.aiModelQualityScore}
/>
```

---

### 4. SessionCard.tsx

**Original Dependencies:**
- `useWebSocketStore` - For live session status
- `ProviderIcon` - Component for provider-specific icons
- `Link` (from react-router) - For navigation

**Solution:**
- ✅ **Converted to props-based with component injection**
- Parent provides `isActive` state (from WebSocket or other source)
- Parent provides `ProviderIcon` component
- Parent provides `LinkComponent` for navigation
- All event handlers passed as props

**Props Interface:**
```typescript
interface SessionCardProps {
  session: AgentSession                      // Session data
  isSelected?: boolean
  isActive?: boolean                         // Previously from useWebSocketStore
  onSelect?: (checked: boolean) => void
  onViewSession?: (sessionId: string) => void
  onProcessSession?: (sessionId: string) => void
  onAssessSession?: (sessionId: string) => void
  isProcessing?: boolean
  // Component injections
  ProviderIcon?: React.ComponentType<{ providerId: string; size: number }>
  LinkComponent?: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>
}
```

**Usage Example:**
```typescript
import SessionCard from '@guideai/session-processing/ui/components/SessionCard'
import ProviderIcon from './ProviderIcon'

// Parent manages WebSocket state
const isActive = useWebSocketStore(state => state.isSessionActive(session.sessionId))

<SessionCard
  session={session}
  isActive={isActive}
  onViewSession={handleView}
  onProcessSession={handleProcess}
  ProviderIcon={ProviderIcon}
/>
```

---

### 5. SessionList.tsx - NOT COPIED

**Original Dependencies (too many to convert):**
- `useAgentSessions(filters)` - Complex session fetching with filtering
- `useSessionProviders()` - Provider list
- `useDeleteSessions()` - Delete mutation
- `useProcessSession()` - Process mutation
- `useProcessBatch()` - Batch process mutation
- `useAssessmentQuestions()` - Assessment questions
- `useAssessmentActions()` - Assessment mutations
- `useAuth()` - Authentication context
- `useUserHasUploaded()` - User status
- `useWebSocketStore()` - WebSocket state
- `useSearchParams()` - URL state management
- `AssessmentModal` - Server-specific component
- `FilterDrawer` - Server-specific component
- `ProviderIcon` - Server-specific component

**Solution:**
- ❌ **Not copied** - Too tightly coupled to server infrastructure
- Component is application-specific, not a reusable library component
- See `SESSION_LIST_NOTE.md` for guidance on creating your own

**Alternative:**
Build your own list component using the provided `SessionCard`:
```typescript
function MySessionList({ sessions, onViewSession }) {
  return (
    <div className="space-y-2">
      {sessions.map(session => (
        <SessionCard
          key={session.id}
          session={session}
          onViewSession={onViewSession}
        />
      ))}
    </div>
  )
}
```

---

## Timeline Components

**All timeline components are dependency-free:**
- ✅ CodeBlock.tsx - No dependencies
- ✅ ImageBlock.tsx - No dependencies
- ✅ JsonBlock.tsx - Only React useState
- ✅ TextBlock.tsx - No dependencies
- ✅ ToolBlock.tsx - Only React useState
- ✅ ToolResultBlock.tsx - Only React useState
- ✅ ContentRenderer.tsx - Only internal imports
- ✅ MessageHeader.tsx - Only internal imports
- ✅ TimelineGroup.tsx - Only internal imports
- ✅ TimelineMessage.tsx - Only internal imports

These components work entirely with data passed via props and have no external dependencies.

---

## Utility Components

### DateFilter.tsx
- ✅ **No dependencies** - Pure UI component
- Manages its own state
- Reports changes via `onChange` callback

---

## Migration Checklist for Each Environment

When using these components in your application:

### For Server (Hono + React)
- [x] Already has hooks - can use directly
- [x] Pass data from TanStack Query hooks to component props
- [x] Wire up event handlers to mutations

### For Desktop App (Tauri)
- [ ] Create data fetching layer (API calls or local DB)
- [ ] Pass data to components as props
- [ ] Implement event handlers for user actions
- [ ] Provide `ProviderIcon` component
- [ ] Handle navigation in your router

### For CLI/Standalone
- [ ] Fetch data from API or local source
- [ ] Render components with fetched data
- [ ] Implement simplified event handlers
- [ ] May need to adapt some UI patterns for CLI

---

## Type Definitions Required

Components expect these types from `@guideai/types`:
- `AssessmentAnswer` - Used in AssessmentSection
- Session types are defined inline in SessionCard

Make sure your environment provides compatible type definitions.

---

## Summary of Changes

| Component | Original | Converted | Status |
|-----------|----------|-----------|--------|
| CodeBlock | No deps | No deps | ✅ Ready |
| ImageBlock | No deps | No deps | ✅ Ready |
| JsonBlock | No deps | No deps | ✅ Ready |
| TextBlock | No deps | No deps | ✅ Ready |
| ToolBlock | No deps | No deps | ✅ Ready |
| ToolResultBlock | No deps | No deps | ✅ Ready |
| ContentRenderer | Internal only | Internal only | ✅ Ready |
| MessageHeader | Internal only | Internal only | ✅ Ready |
| TimelineGroup | Internal only | Internal only | ✅ Ready |
| TimelineMessage | Internal only | Internal only | ✅ Ready |
| MetricCard | useSessionMetrics utils | Inlined utils | ✅ Ready |
| MetricSection | No deps | No deps | ✅ Ready |
| AssessmentSection | 2 hooks | Props-based | ✅ Ready |
| MetricsOverview | 1 hook | Props-based | ✅ Ready |
| DateFilter | No deps | No deps | ✅ Ready |
| SessionCard | 3 deps | Props + injection | ✅ Ready |
| SessionList | 11+ deps | Not copied | ❌ Build your own |

---

## Next Steps

1. **Test components** in the session-processing package
2. **Update imports** in server to use new package
3. **Adapt desktop app** to use new components
4. **Document usage patterns** for each environment
5. **Create example implementations** for common use cases
