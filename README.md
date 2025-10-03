# Session Processing Package

Shared session processing, metrics calculation, AI processing, and UI components for GuideAI. This package provides a unified way to process agent sessions, calculate metrics, and display session data across both the server and desktop applications.

## Features

- **Metric Processing**: Session parsing and metric calculation for various AI coding agents
- **AI Model Processing**: Summary generation and quality assessment with pluggable AI providers
- **UI Components**: Session viewer, timeline, and metrics display components
- **Provider Agnostic**: Supports Claude Code, OpenCode, Codex, and custom providers
- **Offline-First**: Works without database or network dependencies
- **Dual Build**: ESM and CommonJS support

## Installation

```bash
pnpm add @guideai/session-processing
```

## Usage

### Metric Processing

```typescript
import { ClaudeCodeProcessor, ProcessorRegistry } from '@guideai/session-processing/processors'

// Get processor from registry
const registry = new ProcessorRegistry()
const processor = registry.getProcessor('claude-code')

// Process session metrics
const context = {
  sessionId: 'session-123',
  provider: 'claude-code',
  userId: 'user-456'
}

const results = await processor.processMetrics(jsonlContent, context)
console.log('Metrics:', results)
```

### AI Model Processing

```typescript
import { ClaudeAdapter } from '@guideai/session-processing/ai-models'

// Initialize adapter with user-provided API key
const adapter = new ClaudeAdapter({
  apiKey: userApiKey,
  model: 'claude-3-5-sonnet-20241022'
})

// Generate session summary
const summary = await adapter.executeTask('session-summary', {
  sessionContent: jsonlContent,
  provider: 'claude-code'
})
```

### UI Components

```typescript
import { SessionViewer } from '@guideai/session-processing/ui'

function SessionDetailPage({ sessionId }) {
  const session = useSession(sessionId)
  const metrics = useSessionMetrics(sessionId)

  return (
    <SessionViewer
      session={session}
      metrics={metrics}
    />
  )
}
```

## Package Exports

- `@guideai/session-processing` - Main exports
- `@guideai/session-processing/processors` - Metric processors
- `@guideai/session-processing/ai-models` - AI model adapters
- `@guideai/session-processing/ui` - React components

## Architecture

### Processors
- **Base Classes**: MetricProcessor, ProviderProcessor
- **Claude Code**: Performance, Usage, Quality, Engagement, Error metrics
- **Extensible**: Easy to add new providers and metrics

### AI Models
- **Adapter Pattern**: Pluggable AI providers (Claude, Gemini)
- **Tasks**: Session Summary, Quality Assessment, Intent Extraction
- **User Keys**: Supports user-provided API keys (desktop) or environment keys (server)

### UI Components
- **SessionViewer**: Main session display component
- **SessionTimeline**: Message-by-message timeline view
- **ConversationView**: Conversational message display
- **MetricsOverview**: Session metrics visualization

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Development mode (watch)
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

## Dependencies

- `@guideai/types` - Shared type definitions
- `@anthropic-ai/sdk` - Claude API client
- `@google/generative-ai` - Gemini API client
- `react` - UI components (peer dependency)
- `tailwindcss` - Styling (optional peer dependency)
- `daisyui` - UI library (optional peer dependency)

## License

MIT
