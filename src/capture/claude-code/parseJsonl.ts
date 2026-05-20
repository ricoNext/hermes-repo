import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ParsedSession, SessionMessage } from "../types.js";

const FILE_CHANGE_TOOLS =
  /^(Write|Edit|MultiEdit|NotebookEdit|write|edit)$/i;

function extractText(record: Record<string, unknown>): string {
  if (typeof record.content === "string") {
    return record.content;
  }
  const message = record.message;
  if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    if (typeof msg.content === "string") {
      return msg.content;
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((part) => {
          if (part && typeof part === "object" && "text" in part) {
            return String((part as { text: string }).text);
          }
          return "";
        })
        .join("\n");
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

function isToolUse(record: Record<string, unknown>): boolean {
  const t = String(record.type ?? "").toLowerCase();
  return t === "tool_use" || t === "tool";
}

function toolName(record: Record<string, unknown>): string {
  if (typeof record.name === "string") return record.name;
  const tool = record.tool;
  if (tool && typeof tool === "object" && "name" in tool) {
    return String((tool as { name: string }).name);
  }
  return "";
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
      if (isToolUse(record)) {
        toolCalls += 1;
        const name = toolName(record);
        if (FILE_CHANGE_TOOLS.test(name)) {
          fileChanges += 1;
        }
        continue;
      }
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
