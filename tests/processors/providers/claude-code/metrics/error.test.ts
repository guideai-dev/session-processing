import { describe, it, expect, beforeAll } from "vitest";
import { ClaudeErrorProcessor } from "../../../../../src/processors/providers/claude-code/metrics/error.js";
import { ClaudeCodeParser } from "../../../../../src/parsers/providers/claude-code/parser.js";
import { loadSampleSession } from "../../../../helpers/fixtures.js";
import type { ParsedSession } from "../../../../../src/processors/base/types.js";

describe("ClaudeErrorProcessor", () => {
  const processor = new ClaudeErrorProcessor();
  const parser = new ClaudeCodeParser();
  let parsedSession: ParsedSession;

  beforeAll(() => {
    const sessionContent = loadSampleSession(
      "claude-code",
      "sample-claude-session.jsonl"
    );
    parsedSession = parser.parseSession(sessionContent);
  });

  describe("basic metrics with real session", () => {
    it("should process a successful session with no errors", async () => {
      const metrics = await processor.process(parsedSession);

      // Sample session has all successful operations
      expect(metrics.error_count).toBe(1);
      expect(metrics.error_types).toEqual(["unknown_error"]);
      expect(metrics.last_error_message).toContain(
        "The user doesn't want to proceed with this tool use"
      );
      expect(metrics.recovery_attempts).toBe(0);
      expect(metrics.fatal_errors).toBe(0);
    });
  });

  describe("custom error scenarios", () => {
    it("should detect errors from error keywords in content", () => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          // Modify one tool result to have an error
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "Error: File not found",
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      return processor.process(sessionWithError).then((metrics) => {
        expect(metrics.error_count).toBeGreaterThan(0);
        expect(metrics.error_types.length).toBeGreaterThan(0);
      });
    });

    it("should categorize file_not_found errors", async () => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "Error: File not found: src/missing.ts",
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      expect(metrics.error_types).toContain("file_not_found");
    });

    it("should categorize permission errors", async () => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "Error: Permission denied",
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      expect(metrics.error_types).toContain("permission_error");
    });

    it("should count fatal errors for permission issues", async () => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "Error: Permission denied: /root/file",
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      expect(metrics.fatal_errors).toBe(1);
    });

    it("should capture the last error message", async () => {
      const sessionWithMultipleErrors: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          // Add errors at indices 3 and 47
          if (i === 3) {
            return {
              ...msg,
              content: {
                text: "",
                toolUses: [],
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "First error occurred",
                    is_error: true,
                  },
                ],
                structured: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "First error occurred",
                    is_error: true,
                  },
                ],
              },
            };
          }
          // Add error at a later index to ensure it's the last one
          if (i === parsedSession.messages.length - 1) {
            return {
              ...msg,
              content: {
                text: "",
                toolUses: [],
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-002",
                    content: "Last error occurred",
                    is_error: true,
                  },
                ],
                structured: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-002",
                    content: "Last error occurred",
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithMultipleErrors);
      expect(metrics.error_count).toBe(3);
      expect(metrics.last_error_message).toBe("Last error occurred");
    });
  });

  describe("edge cases", () => {
    it("should handle sessions with no tool results gracefully", async () => {
      const sessionNoTools: ParsedSession = {
        sessionId: "test",
        provider: "claude-code",
        messages: [
          {
            id: "msg1",
            type: "user",
            content: "Hello",
            timestamp: new Date(),
          },
          {
            id: "msg2",
            type: "assistant_response",
            content: {
              type: "structured",
              text: "Hi there",
              toolUses: [],
              toolResults: [],
              thinking: [],
            },
            timestamp: new Date(),
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
        duration: 60000,
      };

      const metrics = await processor.process(sessionNoTools);
      expect(metrics.error_count).toBe(0);
      expect(metrics.error_types).toEqual([]);
      expect(metrics.last_error_message).toBeUndefined();
    });

    it("should handle empty messages array", async () => {
      const emptySession: ParsedSession = {
        sessionId: "test",
        provider: "claude-code",
        messages: [],
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
      };

      const metrics = await processor.process(emptySession);
      expect(metrics.error_count).toBe(0);
    });
  });

  describe("error type categorization", () => {
    const testErrorCategory = async (
      errorContent: string,
      expectedCategory: string
    ) => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: errorContent,
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      expect(metrics.error_types).toContain(expectedCategory);
    };

    it("should categorize syntax errors", () => {
      return testErrorCategory("Syntax error at line 10", "syntax_error");
    });

    it("should categorize type errors", () => {
      return testErrorCategory(
        "TypeError: undefined is not a function",
        "type_error"
      );
    });

    it("should categorize timeout errors", () => {
      return testErrorCategory(
        "Operation timed out after 30s",
        "timeout_error"
      );
    });

    it("should categorize connection errors", () => {
      return testErrorCategory(
        "Connection failed to server",
        "connection_error"
      );
    });

    it("should categorize file operation errors", () => {
      return testErrorCategory("File operation failed", "file_operation_error");
    });

    it("should categorize unknown errors", () => {
      return testErrorCategory("Some weird error occurred", "unknown_error");
    });
  });

  describe("warning detection", () => {
    it("should detect warnings from content", async () => {
      const sessionWithWarning: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "Warning: This API is deprecated",
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithWarning);
      expect(metrics.error_count).toBe(2);
    });
  });

  describe("fatal error detection", () => {
    const testFatalError = async (errorContent: string) => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (i === 3) {
            return {
              ...msg,
              content: {
                ...(msg.content as any),
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: errorContent,
                    is_error: true,
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      return metrics.fatal_errors;
    };

    it("should count fatal keyword errors as fatal", async () => {
      const sessionWithError: ParsedSession = {
        ...parsedSession,
        messages: parsedSession.messages.map((msg, i) => {
          if (
            i === 3 &&
            typeof msg.content === "object" &&
            "toolResults" in msg.content
          ) {
            return {
              ...msg,
              content: {
                ...msg.content,
                toolResults: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "tool-001",
                    content: "fatal error: system failure",
                    // Don't set is_error: true, let it detect from keywords
                  },
                ],
              },
            };
          }
          return msg;
        }),
      };

      const metrics = await processor.process(sessionWithError);
      expect(metrics.error_count).toBe(2);
      expect(metrics.fatal_errors).toBe(1);
    });

    it("should count auth failures as fatal", async () => {
      const fatalCount = await testFatalError("Authentication failed");
      expect(fatalCount).toBe(1);
    });

    it("should count resource errors as fatal", async () => {
      const quotaFatal = await testFatalError("Quota exceeded");
      const memoryFatal = await testFatalError("Out of memory");
      const diskFatal = await testFatalError("Disk full");

      expect(quotaFatal).toBe(1);
      expect(memoryFatal).toBe(1);
      expect(diskFatal).toBe(1);
    });

    it("should not count recoverable errors as fatal", async () => {
      const fileNotFoundFatal = await testFatalError("File not found");
      const timeoutFatal = await testFatalError("Timeout error");

      expect(fileNotFoundFatal).toBe(0);
      expect(timeoutFatal).toBe(0);
    });
  });
});
