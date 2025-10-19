import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ClaudeCodeProcessor } from "@guideai-dev/session-processing/processors";

describe("ClaudeCodeProcessor", () => {
  const processor = new ClaudeCodeProcessor();

  test("should process real Claude Code session data", async () => {
    // Load test fixture
    const fixturePath = join(
      __dirname,
      "../fixtures/sessions/claude-code-sample-1.jsonl",
    );
    const sessionContent = readFileSync(fixturePath, "utf-8");

    // Verify processor can handle the content
    expect(processor.canProcess(sessionContent)).toBe(true);

    // Parse the session
    const session = processor.parseSession(sessionContent);

    // Verify basic session structure
    expect(session).toBeDefined();
    expect(session.sessionId).toBeDefined();
    expect(session.provider).toBe("claude-code");
    expect(session.messages).toBeDefined();
    expect(session.messages.length).toBeGreaterThan(0);
    expect(session.startTime).toBeInstanceOf(Date);
    expect(session.endTime).toBeInstanceOf(Date);
    expect(session.duration).toBeGreaterThanOrEqual(0);
  });

  test("should run all metric processors", async () => {
    // Load test fixture
    const fixturePath = join(
      __dirname,
      "../fixtures/sessions/claude-code-sample-1.jsonl",
    );
    const sessionContent = readFileSync(fixturePath, "utf-8");

    // Parse session
    const session = processor.parseSession(sessionContent);

    // Get all metric processors
    const metricProcessors = processor.getMetricProcessors();

    expect(metricProcessors.length).toBeGreaterThan(0);

    // Test each processor
    for (const metricProcessor of metricProcessors) {
      const metrics = await metricProcessor.process(session);
      expect(metrics).toBeDefined();
    }
  });

  test("should process full metrics pipeline", async () => {
    // Load test fixture
    const fixturePath = join(
      __dirname,
      "../fixtures/sessions/claude-code-sample-1.jsonl",
    );
    const sessionContent = readFileSync(fixturePath, "utf-8");

    // Simulate the full processing pipeline
    const context = {
      sessionId: "test-session-123",
      tenantId: "test-tenant-456",
      userId: "test-user-789",
      provider: "claude-code",
    };

    const results = await processor.processMetrics(sessionContent, context);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.metricType).toBeDefined();
      expect(result.metrics).toBeDefined();
    }
  });

  test("should handle smaller session file", async () => {
    // Load smaller test fixture
    const fixturePath = join(
      __dirname,
      "../fixtures/sessions/claude-code-sample-2.jsonl",
    );
    const sessionContent = readFileSync(fixturePath, "utf-8");

    if (sessionContent.trim().length === 0) {
      return; // Skip if file is empty
    }

    // Verify processor can handle the content
    const canProcess = processor.canProcess(sessionContent);

    if (canProcess) {
      const session = processor.parseSession(sessionContent);
      expect(session.messages.length).toBeGreaterThan(0);
      expect(session.duration).toBeGreaterThanOrEqual(0);
    }
  });

  test("should handle files with summary lines without timestamps", async () => {
    // Load test fixture with summary lines
    const fixturePath = join(
      __dirname,
      "../fixtures/sessions/claude-code-with-summary.jsonl",
    );
    const sessionContent = readFileSync(fixturePath, "utf-8");

    // Verify processor can handle the content
    expect(processor.canProcess(sessionContent)).toBe(true);

    // Parse the session
    const session = processor.parseSession(sessionContent);

    // Verify basic session structure
    expect(session).toBeDefined();
    expect(session.sessionId).toBe("test-session-123");
    expect(session.provider).toBe("claude-code");
    expect(session.messages).toBeDefined();
    expect(session.messages.length).toBe(2); // Should skip summary lines and only parse 2 actual messages
    expect(session.startTime).toBeInstanceOf(Date);
    expect(session.endTime).toBeInstanceOf(Date);
    expect(session.duration).toBeGreaterThanOrEqual(0);
  });

  test("processor registry integration", () => {
    const processorInfo = processor.getProcessorInfo();

    expect(processorInfo.providerName).toBe("claude-code");
    expect(processorInfo.description).toBeDefined();
    expect(processorInfo.metricProcessors).toBeDefined();
    expect(Array.isArray(processorInfo.metricProcessors)).toBe(true);
    expect(processorInfo.metricProcessors.length).toBeGreaterThan(0);

    for (const mp of processorInfo.metricProcessors) {
      expect(mp.name).toBeDefined();
      expect(mp.metricType).toBeDefined();
      expect(mp.description).toBeDefined();
    }
  });
});
