# @guideai-dev/session-processing

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
npm install @guideai-dev/session-processing
# or
pnpm add @guideai-dev/session-processing
# or
yarn add @guideai-dev/session-processing
```

## Usage

### Metric Processing

```typescript
import { ClaudeCodeProcessor, ProcessorRegistry } from '@guideai-dev/session-processing/processors'

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
import { ClaudeAdapter } from '@guideai-dev/session-processing/ai-models'

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
import { SessionViewer } from '@guideai-dev/session-processing/ui'

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

- `@guideai-dev/session-processing` - Main exports
- `@guideai-dev/session-processing/processors` - Metric processors
- `@guideai-dev/session-processing/ai-models` - AI model adapters
- `@guideai-dev/session-processing/ui` - React components

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

This package is part of the GuideAI monorepo and is automatically synced to this repository.

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

### Contributing

We welcome contributions! Please:

1. Fork this repository
2. Create a feature branch
3. Add features or fix bugs
4. Submit a pull request

**Note**: All pull requests are reviewed and manually backported to the private GuideAI monorepo.

## Dependencies

- `@guideai-dev/types` - Shared type definitions
- `@anthropic-ai/sdk` - Claude API client
- `@google/generative-ai` - Gemini API client
- `react` - UI components (peer dependency)
- `tailwindcss` - Styling (optional peer dependency)
- `daisyui` - UI library (optional peer dependency)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GuideAI Website](https://guideai.dev)
- [Documentation](https://docs.guideai.dev)
- [GitHub Organization](https://github.com/guideai-dev)
- [npm Package](https://github.com/guideai-dev/session-processing/pkgs/npm/session-processing)

## Related Packages

- [@guideai-dev/desktop](https://github.com/guideai-dev/desktop) - Desktop menubar application
- [@guideai-dev/types](https://github.com/guideai-dev/types) - Shared TypeScript types
- [@guideai-dev/cli](https://github.com/guideai-dev/cli) - Command-line interface
