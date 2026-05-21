import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { FormattedCapture } from "./formatCapture.js";
import type { CaptureMemoryType } from "./types.js";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextCaptureFilename(
  repoRoot: string,
  type: CaptureMemoryType,
): string {
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

function formatTags(tags: string[]): string {
  return tags.map((t) => JSON.stringify(t)).join(", ");
}

export function renderCaptureMarkdown(
  formatted: FormattedCapture,
  date: string,
): string {
  const lines = [
    "---",
    `type: ${formatted.type}`,
    `date: ${date}`,
    `session: ${formatted.sessionId}`,
    `tags: [${formatTags(formatted.tags)}]`,
    `scope: ${formatted.scope}`,
    "confidence: pending",
  ];
  if (formatted.llmUpgradedAt) {
    lines.push(`llmUpgradedAt: ${formatted.llmUpgradedAt}`);
  }
  if (formatted.type === "procedural") {
    const stepCount = (formatted.bodyMarkdown.match(/^## 步骤/m) ? 1 : 0) +
      (formatted.bodyMarkdown.split("\n").filter((l) => /^\d+\./.test(l)).length);
    lines.push(`step_count: ${stepCount || 0}`);
    lines.push("repeat_count: 1");
  }
  lines.push("---", "", formatted.bodyMarkdown);
  return `${lines.join("\n")}\n`;
}

export function writeCaptureFile(
  repoRoot: string,
  formatted: FormattedCapture,
  filename?: string,
): { absolutePath: string; filename: string; type: CaptureMemoryType } {
  const type = formatted.type;
  const name = filename ?? nextCaptureFilename(repoRoot, type);
  const absolutePath = memoryPath(repoRoot, "captures", type, name);
  const date = todayString();
  const content = renderCaptureMarkdown(formatted, date);
  mkdirSync(join(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
  return { absolutePath, filename: name, type };
}

/** Replace capture file content in place (LLM upgrade) */
export function replaceCaptureFile(
  repoRoot: string,
  captureFile: string,
  formatted: FormattedCapture,
): void {
  const absolutePath = join(repoRoot, captureFile);
  const date = todayString();
  writeFileSync(absolutePath, renderCaptureMarkdown(formatted, date), "utf8");
}
