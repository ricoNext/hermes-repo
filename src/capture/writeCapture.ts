import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { CaptureMemoryType, ParsedSession } from "./types.js";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextCaptureFilename(repoRoot: string, type: CaptureMemoryType): string {
  const dir = memoryPath(repoRoot, "captures", type);
  mkdirSync(dir, { recursive: true });
  const date = todayString();
  const prefix = `capture-${date}-`;
  let max = 0;
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(prefix) && name.endsWith(".md")) {
        const num = Number.parseInt(name.slice(prefix.length, -3), 10);
        if (!Number.isNaN(num) && num > max) {
          max = num;
        }
      }
    }
  }
  const seq = String(max + 1).padStart(3, "0");
  return `capture-${date}-${seq}.md`;
}

function buildBody(session: ParsedSession): string {
  const recent = session.messages.slice(-6);
  const context = recent
    .map((m) => `**${m.role}**: ${m.text.slice(0, 500)}`)
    .join("\n\n");

  return `## 上下文

自动捕获自 Claude Code 会话 \`${session.sessionId}\`。

## 发现

${context || "（无提取内容）"}

## 影响

（待 consolidate 或人工补充）
`;
}

export function writeCaptureFile(
  repoRoot: string,
  session: ParsedSession,
  type: CaptureMemoryType,
): { absolutePath: string; filename: string } {
  const filename = nextCaptureFilename(repoRoot, type);
  const absolutePath = memoryPath(repoRoot, "captures", type, filename);
  const date = todayString();

  const content = `---
type: ${type}
date: ${date}
session: ${session.sessionId}
tags: [auto-capture, claude-code]
scope: all
confidence: pending
---

${buildBody(session)}
`;

  writeFileSync(absolutePath, content, "utf8");
  return { absolutePath, filename };
}
