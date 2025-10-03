# SessionList Component - Not Copied

The `SessionList.tsx` component from the server was **not copied** to this package because it has extremely heavy dependencies on server-specific API hooks and infrastructure:

## Dependencies that make it unsuitable for this package:

1. **API Hooks** (all from server):
   - `useAgentSessions` - fetches session data with complex filtering
   - `useSessionProviders` - fetches available providers
   - `useDeleteSessions` - mutation for deleting sessions
   - `useProcessSession` - mutation for processing individual sessions
   - `useProcessBatch` - mutation for batch processing
   - `useAssessmentQuestions` - fetches assessment questions
   - `useAssessmentActions` - assessment mutations (start, complete)
   - `useAuth` - authentication context
   - `useUserHasUploaded` - user status check

2. **WebSocket Integration**:
   - `useWebSocketStore` - Zustand store for real-time session updates
   - Live session tracking and cleanup

3. **Routing**:
   - Uses `react-router-dom` for URL-based state management
   - `useSearchParams` and `setSearchParams` for filter/sort state

4. **Complex UI Components**:
   - `AssessmentModal` - assessment UI (server-specific)
   - `FilterDrawer` - mobile filter drawer (server-specific)
   - `ProviderIcon` - provider-specific icons

## What this package provides instead:

- **SessionCard** - Individual session card component (props-based)
- **DateFilter** - Date filtering UI component
- **Timeline components** - For rendering session content
- **Metrics components** - For displaying session metrics

## To use sessions in a different context:

You should create your own `SessionList` component that:

1. Uses your own data fetching mechanism (props, context, or hooks)
2. Passes data to the `SessionCard` component
3. Implements your own filtering/sorting logic
4. Handles navigation in your routing system
5. Integrates with your authentication system

## Example usage pattern:

```typescript
import SessionCard from '@guideai/session-processing/ui/components/SessionCard'

function MySessionList({ sessions, onViewSession, ProviderIcon }) {
  return (
    <div className="space-y-2">
      {sessions.map(session => (
        <SessionCard
          key={session.id}
          session={session}
          onViewSession={onViewSession}
          ProviderIcon={ProviderIcon}
        />
      ))}
    </div>
  )
}
```

The session-processing package is meant to be a **UI component library** with minimal dependencies, not a full-featured application with API integration.
