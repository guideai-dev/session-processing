# GitHub Copilot Message Types

This document catalogs the distinct message types found in GitHub Copilot snapshot files (`.jsonl` format) located at `~/.guideai/providers/copilot/snapshots/*.jsonl`.

## Overview

GitHub Copilot sessions are stored as JSONL (JSON Lines) files, where each line represents a distinct message or event in the conversation timeline. There are **5 distinct message types**:

1. `user` - User input messages
2. `copilot` - Copilot's response messages
3. `tool_call_requested` - Tool invocations requested by Copilot
4. `tool_call_completed` - Tool execution results
5. `info` - System information messages

---

## 1. User Messages (`type: "user"`)

User messages represent input from the user to Copilot.

### Structure

```typescript
interface UserMessage {
  type: "user";
  id: string;
  timestamp: string; // ISO 8601 format
  text: string;
  expandedText: string;
  mentions: any[]; // Array of mentions
  imageAttachments: any[]; // Array of image attachments
}
```

### Example

```json
{
  "type": "user",
  "id": "496c175d-18c3-4b91-b4a1-b3786a1c4186",
  "timestamp": "2025-10-04T05:35:56.461Z",
  "text": "The next challenge to solve is that all github-copilot sessions do not come through with a project attached.",
  "expandedText": "The next challenge to solve is that all github-copilot sessions do not come through with a project attached.  We need to:\n- Use the ~/.copilot/config.json - it has a property called 'trusted_folders",
  "mentions": [],
  "imageAttachments": []
}
```

### Metrics Relevance

- **Engagement**: Count of user messages, message length
- **Usage**: Frequency of mentions, image attachments
- **Quality**: Message complexity, clarity

---

## 2. Copilot Messages (`type: "copilot"`)

Copilot messages represent responses from the AI assistant.

### Structure

```typescript
interface CopilotMessage {
  type: "copilot";
  id: string;
  timestamp: string; // ISO 8601 format
  text: string;
}
```

### Example

```json
{
  "type": "copilot",
  "id": "c5825184-4082-44fb-8c9d-4ef682c000e2",
  "timestamp": "2025-10-04T05:36:04.736Z",
  "text": "I'll help you solve the issue where GitHub Copilot sessions don't come through with a project attached by using the `~/.copilot/config.json` file's `trusted_folders` property.\n\nLet me start by exploring the current codebase to understand how sessions are being processed and where we need to integrate the trusted folders functionality."
}
```

### Metrics Relevance

- **Performance**: Response time (time between user message and copilot response)
- **Quality**: Response length, complexity
- **Usage**: Number of responses generated

---

## 3. Tool Call Requested (`type: "tool_call_requested"`)

Tool call requested messages represent Copilot's invocation of various tools (bash commands, file operations, etc.).

### Structure

```typescript
interface ToolCallRequested {
  type: "tool_call_requested";
  id: string;
  timestamp: string; // ISO 8601 format
  callId: string;
  name: string; // Tool name (e.g., "bash", "str_replace_editor")
  toolTitle: string;
  intentionSummary: string; // Human-readable description
  arguments: Record<string, any>; // Tool-specific arguments
}
```

### Example - Bash Tool

```json
{
  "type": "tool_call_requested",
  "id": "63be8d18-ef39-40c7-b5ec-5023ea4ee542",
  "timestamp": "2025-10-04T05:36:04.736Z",
  "callId": "toolu_01QD8piLEBbmuacXW4tSaXw8",
  "name": "bash",
  "toolTitle": "bash",
  "intentionSummary": "Check the structure of the Copilot config file",
  "arguments": {
    "command": "cat ~/.copilot/config.json",
    "description": "Check the structure of the Copilot config file",
    "sessionId": "main",
    "async": false
  }
}
```

### Example - File Editor Tool

```json
{
  "type": "tool_call_requested",
  "id": "355a77df-c032-41e6-9dda-5fa6d70b45a3",
  "timestamp": "2025-10-04T05:36:04.736Z",
  "callId": "toolu_01WPwvGa3nWCjzhTSW6eYJL4",
  "name": "str_replace_editor",
  "toolTitle": "str_replace_editor",
  "intentionSummary": "view the file at /Users/cliftonc/work/guideai.",
  "arguments": {
    "command": "view",
    "path": "/Users/cliftonc/work/guideai"
  }
}
```

### Metrics Relevance

- **Usage**: Tool invocation counts by type
- **Performance**: Time to tool invocation
- **Quality**: Tool success/failure rates
- **Engagement**: Diversity of tools used

### Common Tool Names

- `bash` - Shell command execution
- `str_replace_editor` - File viewing and editing
- (Others may exist depending on Copilot configuration)

---

## 4. Tool Call Completed (`type: "tool_call_completed"`)

Tool call completed messages contain the results of tool executions.

### Structure

```typescript
interface ToolCallCompleted {
  type: "tool_call_completed";
  id: string;
  timestamp: string; // ISO 8601 format
  callId: string; // Matches callId from tool_call_requested
  name: string; // Tool name
  toolTitle: string;
  intentionSummary: string;
  arguments: Record<string, any>; // Original arguments
  result: {
    type: "success" | "error";
    log?: string; // Tool output/logs
    [key: string]: any; // Tool-specific result fields
  };
}
```

### Example

```json
{
  "type": "tool_call_completed",
  "id": "f8c84710-ce14-4f5d-bda8-3596f5cd2206",
  "timestamp": "2025-10-04T05:40:10.977Z",
  "callId": "toolu_01Q8gUSdNdin1aQGDNzYGsSt",
  "name": "str_replace_editor",
  "toolTitle": "str_replace_editor",
  "intentionSummary": "edit the file at /Users/cliftonc/work/guideai/apps/desktop/src-tauri/src/providers/copilot_parser.rs.",
  "arguments": {
    "command": "str_replace",
    "path": "/Users/cliftonc/work/guideai/apps/desktop/src-tauri/src/providers/copilot_parser.rs",
    "old_str": "/// GitHub Copilot session format...",
    "new_str": "/// GitHub Copilot config.json format..."
  },
  "result": {
    "type": "success",
    "log": "\ndiff --git a/Users/cliftonc/work/guideai/apps/desktop/src-tauri/src/providers/copilot_parser.rs...\n"
  }
}
```

### Metrics Relevance

- **Performance**: Tool execution time (time between request and completion)
- **Quality**: Success vs error rates
- **Usage**: Tool output analysis (e.g., lines changed, files affected)
- **Error Tracking**: Error messages and types

---

## 5. Info Messages (`type: "info"`)

Info messages represent system-level events and notifications.

### Structure

```typescript
interface InfoMessage {
  type: "info";
  id: string;
  timestamp: string; // ISO 8601 format
  text: string; // Human-readable message
}
```

### Example

```json
{
  "type": "info",
  "id": "3b6bb66e-ecad-44d9-9e73-4d184f3d080d",
  "timestamp": "2025-10-04T05:36:46.124Z",
  "text": "Operation cancelled by user"
}
```

### Metrics Relevance

- **Engagement**: User cancellations, interruptions
- **Error Tracking**: System warnings and errors
- **Usage**: Session lifecycle events

### Common Info Messages

- `"Operation cancelled by user"` - User interrupted an operation
- (Others may exist - needs further investigation)

---

## Message Timeline

Messages are ordered chronologically in the JSONL file. A typical interaction flow:

1. **user** - User asks a question
2. **copilot** - Copilot responds with a plan
3. **tool_call_requested** - Copilot requests to run a tool
4. **tool_call_requested** - Copilot requests another tool (often parallel)
5. **tool_call_completed** - First tool completes
6. **tool_call_completed** - Second tool completes
7. **copilot** - Copilot analyzes results
8. **tool_call_requested** - Copilot requests follow-up action
9. **tool_call_completed** - Tool completes
10. **copilot** - Copilot provides final response

---

## Key Metrics to Extract

### Performance Metrics

- **Response Time**: Time between `user` message and first `copilot` response
- **Tool Execution Time**: Time between `tool_call_requested` and `tool_call_completed`
- **Session Duration**: Time from first to last message
- **Average Thinking Time**: Average delay between messages

### Usage Metrics

- **Total Messages**: Count of all messages
- **User Messages**: Count of user inputs
- **Copilot Responses**: Count of copilot outputs
- **Tool Invocations**: Count by tool type
- **Tool Success Rate**: Successful vs failed tool calls
- **Commands Executed**: Count of bash commands

### Quality Metrics

- **Message Length**: Average length of user/copilot messages
- **Tool Diversity**: Number of unique tools used
- **Error Rate**: Percentage of tool failures
- **Cancellation Rate**: Percentage of cancelled operations

### Engagement Metrics

- **Turn Count**: Number of user-copilot exchanges
- **Tools per Turn**: Average tool calls per user request
- **Session Complexity**: Depth of tool call chains
- **Interactive Features**: Use of mentions, attachments

---

## Implementation Notes

### Parsing Strategy

1. Read JSONL file line by line
2. Parse each line as JSON
3. Switch on `type` field to handle each message type
4. Link `tool_call_requested` and `tool_call_completed` by `callId`
5. Calculate metrics by analyzing message sequences

### TypeScript Types

Consider creating discriminated union types:

```typescript
type CopilotMessage =
  | UserMessage
  | CopilotMessage
  | ToolCallRequested
  | ToolCallCompleted
  | InfoMessage;
```

### callId Linking

Tool calls can be linked by their `callId`:
- `tool_call_requested.callId` → `tool_call_completed.callId`
- This enables calculating tool execution time and success rates

---

## Data Source

Sample file analyzed: `~/.guideai/providers/copilot/snapshots/ba81014c-8061-402b-bbab-0d24b3794a07.jsonl`

Last updated: 2025-10-04
