import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ParsedSession, SessionMessage } from "../types.js";

const FILE_CHANGE_TOOLS =
  /^(Write|Edit|MultiEdit|NotebookEdit|write|edit)$/i;

/** CodeBuddy：跳过元数据行，避免干扰统计 */
const SKIP_LINE_TYPES = new Set([
  "file-history-snapshot",
  "summary",
  "function_call_result",
]);

function textFromContentParts(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") {
        return p.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractText(record: Record<string, unknown>): string {
  if (typeof record.content === "string") {
    return record.content;
  }
  if (Array.isArray(record.content)) {
    const top = textFromContentParts(record.content);
    if (top) {
      return top;
    }
  }
  const message = record.message;
  if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    if (typeof msg.content === "string") {
      return msg.content;
    }
    if (Array.isArray(msg.content)) {
      return textFromContentParts(msg.content);
    }
  }
  return "";
}

function inferRole(record: Record<string, unknown>): string {
  if (typeof record.role === "string") {
    return record.role;
  }
  if (typeof record.type === "string") {
    const t = record.type.toLowerCase();
    if (t === "user" || t === "human") return "user";
    if (t === "assistant") return "assistant";
  }
  return "unknown";
}

function isSkippedLine(record: Record<string, unknown>): boolean {
  const t = String(record.type ?? "").toLowerCase();
  return SKIP_LINE_TYPES.has(t);
}

function isToolUse(record: Record<string, unknown>): boolean {
  const t = String(record.type ?? "").toLowerCase();
  return t === "tool_use" || t === "tool" || t === "function_call";
}

function toolName(record: Record<string, unknown>): string {
  if (typeof record.name === "string") return record.name;
  const tool = record.tool;
  if (tool && typeof tool === "object" && "name" in tool) {
    return String((tool as { name: string }).name);
  }
  return "";
}

/** Cursor 等助手：tool_use 嵌在 message.content 数组内 */
function countNestedTools(record: Record<string, unknown>): {
  toolCalls: number;
  fileChanges: number;
} {
  let toolCalls = 0;
  let fileChanges = 0;
  const message = record.message;
  if (!message || typeof message !== "object") {
    return { toolCalls, fileChanges };
  }
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return { toolCalls, fileChanges };
  }
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const p = part as Record<string, unknown>;
    const t = String(p.type ?? "").toLowerCase();
    if (t !== "tool_use" && t !== "tool") {
      continue;
    }
    toolCalls += 1;
    const name = typeof p.name === "string" ? p.name : "";
    if (FILE_CHANGE_TOOLS.test(name)) {
      fileChanges += 1;
    }
  }
  return { toolCalls, fileChanges };
}

export function parseJsonlFile(jsonlPath: string): ParsedSession {
  const sessionId = basename(jsonlPath, ".jsonl");
  const raw = readFileSync(jsonlPath, "utf8");
  const messages: SessionMessage[] = [];
  let fileChanges = 0;
  let toolCalls = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as Record<string, unknown>;
      if (isSkippedLine(record)) {
        continue;
      }
      if (isToolUse(record)) {
        toolCalls += 1;
        const name = toolName(record);
        if (FILE_CHANGE_TOOLS.test(name)) {
          fileChanges += 1;
        }
        continue;
      }
      const nested = countNestedTools(record);
      toolCalls += nested.toolCalls;
      fileChanges += nested.fileChanges;
      const role = inferRole(record);
      const text = extractText(record);
      if (text) {
        messages.push({ role, text });
      }
    } catch {
      // skip malformed lines
    }
  }

  const text = messages.map((m) => m.text).join("\n");

  return {
    sessionId,
    messages,
    text,
    fileChanges,
    toolCalls,
  };
}
