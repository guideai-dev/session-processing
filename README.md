# @guidemode/session-processing

> **The analytics engine that powers GuideMode.**

Parses AI coding sessions from any provider and generates actionable insights. One parser for all AI tools.

## Why This Matters

**Before:** Each AI tool had different formats → 5+ custom parsers → maintenance nightmare

**Now:** Unified canonical format → 1 parser → consistent analytics for all providers

## Installation

```bash
npm install @guidemode/session-processing
```

## Usage

### Parse Any Provider

```typescript
import { ParserRegistry } from '@guidemode/session-processing/parsers'

const registry = new ParserRegistry()
const parser = registry.getParser('claude-code') // or gemini, copilot, codex, opencode

const parsed = parser.parse(sessionContent)
// Works the same for all providers!
```

### Calculate Metrics

```typescript
import { CanonicalSessionProcessor } from '@guidemode/session-processing/processors'

const processor = new CanonicalSessionProcessor()
const metrics = await processor.processMetrics(sessionContent, context)

// Get: performance, usage, quality, engagement, error metrics
```

## Key Features

- ✅ **One Parser** - Handles all AI providers (Claude, Gemini, Copilot, Codex, OpenCode)
- ✅ **Canonical Format** - Universal message structure
- ✅ **Rich Metrics** - Performance, usage, quality, engagement, errors, context
- ✅ **Provider Metadata** - Preserves provider-specific features
- ✅ **UI Components** - React components for session display

## Supported Providers

All via the same unified parser:
- **Claude Code** - Anthropic
- **Gemini Code** - Google
- **GitHub Copilot** - GitHub
- **Codex** - AI assistant
- **OpenCode** - Open source

## For Developers

### Build from Source

```bash
git clone https://github.com/guidemode-dev/session-processing.git
cd session-processing
pnpm install
pnpm build
```

**See [CLAUDE.md](CLAUDE.md) for:**
- Parser architecture details
- How canonical format works
- Adding new providers
- Metrics processor documentation

### Tech Stack

- TypeScript with strict type safety
- Unified canonical parser
- 6 metric processors
- React UI components
- Dual build (ESM + CommonJS)

## What Gets Analyzed

- **Performance** - Response times, token usage
- **Usage** - Commands executed, files modified, tools used
- **Quality** - Success rates, error handling
- **Engagement** - User interactions, turn counts
- **Errors** - Error detection and categorization
- **Context** - Context window usage, file tracking

## Related Packages

- [@guidemode/desktop](https://github.com/guidemode-dev/desktop) - Converts provider formats to canonical
- [@guidemode/types](https://github.com/guidemode-dev/types) - Shared type definitions

## License

MIT License - see [LICENSE](LICENSE)

## Support

- 💬 [**Discussions**](https://github.com/orgs/guidemode-dev/discussions) - Ask questions, share ideas
- 🐛 [**Issues**](https://github.com/guidemode-dev/desktop/issues) - Report bugs, request features
- 📧 **Email**: support@guidemode.dev
