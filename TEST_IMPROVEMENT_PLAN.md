# Test Coverage Improvement Plan for Session Processing

## Current State Summary

**Test Status:** 11 failed, 224 passed (235 total)

**Failing Tests:**
- All 11 failures are in Gemini processor tests
- Issue: Fixture file format mismatch - tests expect JSON format but processor now requires JSONL format with `gemini_raw` fields

**Current Fixture Coverage:**

| Provider | Fixture Size | Lines | Coverage Quality |
|----------|-------------|-------|------------------|
| **Claude Code** | 4.0K | 10 | ⚠️ VERY SMALL - need large real sessions |
| **Gemini** | 8.0K | 75 | ⚠️ Wrong format + too small |
| **Codex** | 1.2M | 1,177 | ✅ Good - real session data |
| **GitHub Copilot** | 4.0K | 10 | ⚠️ VERY SMALL - need larger fixtures |
| **OpenCode** | 576K | 365 | ✅ Good - real session data |

**Available Real Session Files:**
- Claude Code: Multiple 39K-1.4MB sessions in `~/.claude/projects/-Users-cliftonc-work-guideai/`
- Codex: 17K session in `~/.codex/sessions/2025/10/15/`
- OpenCode: Real session in `~/.guideai/cache/opencode/ses_61926545affevSphPVJ0eOQtQI.jsonl`
- GitHub Copilot: 16K snapshot in `~/.guideai/providers/copilot/snapshots/a0e80246-0b17-4753-b2af-597c8cdf73e0.jsonl`
- Gemini: Need JSONL format fixtures with `gemini_raw` fields

## Improvement Plan

### Phase 1: Fix Failing Tests (Priority: HIGH)

**Goal:** Get all tests passing

1. **Fix Gemini fixture format**
   - Convert existing JSON fixture to JSONL with `gemini_raw` fields OR
   - Create new JSONL fixture from real Gemini session
   - File: `src/processors/providers/gemini/__tests__/fixtures/sample-gemini-session.json`

2. **Update Gemini tests**
   - Adjust test expectations to match new JSONL parser
   - File: `src/processors/providers/gemini/__tests__/gemini-processor.test.ts`

3. **Verify all tests pass**
   - Run `pnpm test` and confirm 0 failures

### Phase 2: Add Large Real Session Fixtures (Priority: HIGH)

**Goal:** Test with realistic, large session data

#### Claude Code Fixtures
Add 2-3 large fixtures (100K-500K range) covering:
- **Plan mode usage** - Session with ExitPlanMode calls
- **Todo tracking** - Session with TodoWrite operations
- **Complex multi-file edits** - Session editing 5+ files
- **Error handling and recovery** - Session with tool failures

**Source:** `~/.claude/projects/-Users-cliftonc-work-guideai/*.jsonl`
**Target:** `src/processors/providers/claude-code/__tests__/fixtures/`

#### Gemini Code Fixtures
Create JSONL fixtures with:
- **Thinking/thoughts data** - Messages with `thoughts` arrays
- **Cached token usage** - Messages with `tokens.cached > 0`
- **Tool calls** - Messages with `tools` field
- **Large sessions** - 100K+ files with 50+ messages

**Target:** `src/processors/providers/gemini/__tests__/fixtures/`

#### GitHub Copilot Fixtures
Add larger fixtures (50K-100K) with:
- **Multiple tool uses** - 10+ tool calls
- **Various message types** - User, assistant, tool results
- **Real conversation flows** - Complex back-and-forth

**Source:** `~/.guideai/providers/copilot/snapshots/`
**Target:** `src/processors/providers/github-copilot/__tests__/fixtures/`

#### Codex Fixtures
Current fixture is good (1.2M), but consider adding:
- **Medium-sized session** - 50K-100K for faster tests
- **Small session** - 10K for unit tests

**Source:** `~/.codex/sessions/`
**Target:** `src/processors/providers/codex/__tests__/fixtures/`

### Phase 3: Comprehensive Metric Coverage (Priority: MEDIUM)

**Goal:** Test all metric processors thoroughly

Add tests for each provider covering:

1. **Performance Metrics**
   - Response latency calculations with various session sizes
   - Task completion time with short vs long sessions
   - Edge cases: instant responses, very slow responses

2. **Engagement Metrics**
   - Interruption rate with various interruption patterns
   - Session length calculations
   - Improvement tips generation

3. **Quality Metrics**
   - Task success rate with different success/failure ratios
   - Iteration count tracking
   - Plan mode detection (Claude Code specific)
   - Todo tracking detection (Claude Code specific)
   - Process quality score calculation

4. **Usage Metrics**
   - Read/write ratio with different file operation patterns
   - Input clarity score calculation
   - Total operations counting

5. **Error Metrics**
   - Error counting and categorization
   - Recovery attempt tracking
   - Fatal error detection
   - Error type classification

### Phase 4: Edge Case Testing (Priority: MEDIUM)

**Goal:** Handle malformed and unusual inputs gracefully

Test scenarios:
1. **Malformed JSONL lines**
   - Invalid JSON syntax
   - Missing required fields
   - Extra whitespace/formatting issues

2. **Missing timestamps**
   - Messages without timestamps
   - Invalid timestamp formats
   - Out-of-order timestamps

3. **Empty sessions**
   - No messages
   - Only metadata, no content
   - Zero-length files

4. **Very long sessions**
   - 1MB+ files
   - 100+ messages
   - Performance benchmarks

5. **Incomplete sessions**
   - Sessions with only user messages
   - Sessions with only assistant messages
   - Sessions with missing message pairs

6. **Corrupted tool results**
   - Tool use without result
   - Tool result without use
   - Malformed tool JSON

### Phase 5: Integration Testing (Priority: LOW)

**Goal:** Test full processing pipeline

1. **Full pipeline tests**
   - Load fixture → Parse → Process all metrics → Validate output
   - Test with all 5 providers
   - Verify metric consistency

2. **Metric processor chaining**
   - Sequential processing order
   - Processor independence (one failure doesn't break others)
   - Result aggregation

3. **Registry integration**
   - Provider auto-detection
   - Registry lookup
   - Provider fallback logic

4. **Performance benchmarks**
   - Processing speed with large fixtures
   - Memory usage monitoring
   - Identify bottlenecks

## Implementation Checklist

### Immediate Actions (Fix Failing Tests)
- [ ] Fix Gemini fixture format (JSONL with gemini_raw)
- [ ] Update Gemini processor tests
- [ ] Verify all tests pass (0 failures)

### Short Term (Add Large Fixtures)
- [ ] Copy 2-3 Claude Code sessions (100K-500K) to fixtures
- [ ] Create/copy 2-3 Gemini JSONL sessions to fixtures
- [ ] Add 1-2 larger GitHub Copilot sessions
- [ ] Add medium-sized Codex session for faster tests
- [ ] Anonymize fixtures if needed (remove sensitive paths/data)

### Medium Term (Comprehensive Coverage)
- [ ] Write comprehensive metric tests for each provider
- [ ] Add edge case tests for malformed inputs
- [ ] Document test patterns in README
- [ ] Create fixture manifest documenting each fixture's purpose

### Long Term (Infrastructure)
- [ ] Add test coverage reporting (vitest coverage)
- [ ] Set up performance benchmarking
- [ ] Create integration test suite
- [ ] Document testing best practices

## Test Organization

### Recommended Structure

```
src/processors/providers/[provider]/__tests__/
├── fixtures/
│   ├── README.md                          # Fixture documentation
│   ├── small-[scenario].jsonl            # <10K - fast unit tests
│   ├── medium-[scenario].jsonl           # 10K-100K - integration tests
│   ├── large-[scenario].jsonl            # 100K+ - realistic scenarios
│   └── edge-cases/
│       ├── malformed-*.jsonl
│       ├── empty-*.jsonl
│       └── corrupted-*.jsonl
├── [provider]-processor.test.ts           # Main processor tests
├── [provider]-metrics.test.ts             # Metric-specific tests
└── [provider]-edge-cases.test.ts          # Edge case tests
```

### Fixture Naming Convention

- `small-basic-session.jsonl` - Minimal valid session
- `medium-plan-mode.jsonl` - Medium session with plan mode
- `large-multi-file-edit.jsonl` - Large session editing multiple files
- `edge-malformed-jsonl.jsonl` - Invalid JSON lines
- `edge-missing-timestamps.jsonl` - Missing timestamp fields

## Success Metrics

- **100% test pass rate** - All tests green
- **Coverage targets:**
  - Line coverage: >80%
  - Branch coverage: >75%
  - Function coverage: >90%
- **Fixture diversity:**
  - Small (fast): 2-3 per provider
  - Medium (integration): 2-3 per provider
  - Large (realistic): 2-3 per provider
  - Edge cases: 5+ per provider
- **Performance:**
  - Full test suite completes in <10 seconds
  - Individual processor tests <1 second
  - Large fixture tests <2 seconds each

## Notes

- Fixtures should be **anonymized** - remove sensitive file paths, user data, API keys
- Consider **git-lfs** for large fixtures (>1MB) to keep repo size manageable
- **Document each fixture** - create README in fixtures/ explaining what each file tests
- Add **.gitignore** for local test sessions that shouldn't be committed
- Consider **compression** for very large fixtures (gzip + decompress in test setup)
