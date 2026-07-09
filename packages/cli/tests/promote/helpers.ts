import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function initPromoteRepo(dir: string): void {
  mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
  mkdirSync(join(dir, ".memory", "topics"), { recursive: true });
  mkdirSync(join(dir, ".memory", "templates"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({ assistants: ["claude-code"], debug: false })}\n`,
  );
  writeFileSync(
    join(dir, ".memory", "templates", "PROMOTE_PR.md"),
    `## 记忆晋升申请

本次检测到 {total_count} 条，建议 {ai_approve_count} 条。

| 序号 | 摘要 | AI 建议 | scope |
|------|------|---------|-------|
| — | — | — | — |

<!-- 由 promote --pr 自动填充每条捕获 -->
`,
  );
}

export function writeSemanticCapture(
  dir: string,
  name: string,
  opts?: { promote?: boolean; summary?: string; findings?: string },
): string {
  const rel = `captures/semantic/${name}`;
  const body = `---
type: semantic
date: 2026-05-20
session: s1
tags: [auth, auto-capture]
scope: all
confidence: pending
---

## 发现

${opts?.findings ?? "Use HttpOnly cookies for tokens"}

## 摘要

${opts?.summary ?? "Token storage uses HttpOnly"}
`;
  const abs = join(dir, ".memory", rel);
  writeFileSync(abs, body, "utf8");
  if (opts?.promote) {
    writeFileSync(`${abs}.promote`, "", "utf8");
  }
  return rel;
}
