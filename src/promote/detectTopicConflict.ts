import { existsSync, readFileSync } from "node:fs";
import type { ParsedCapture } from "../consolidate/parseCapture.js";
import { primaryTag, tagToSlug } from "../consolidate/parseCapture.js";
import { memoryPath } from "../init/paths.js";
import type { TopicConflictInfo } from "./types.js";

/** 与 consolidate/detectConflict 对齐的互斥词对 */
const MUTEX_PAIRS: [string, string][] = [
  ["localstorage", "httponly"],
  ["local storage", "httponly"],
  ["mysql", "postgresql"],
  ["mysql", "postgres"],
  ["javascript", "typescript-only"],
  ["npm", "pnpm-only"],
];

function hasTerm(blob: string, term: string): boolean {
  return blob.includes(term.toLowerCase());
}

function pairConflicts(a: string, b: string): boolean {
  for (const [x, y] of MUTEX_PAIRS) {
    const hasX = hasTerm(a, x) && hasTerm(b, y);
    const hasY = hasTerm(a, y) && hasTerm(b, x);
    if (hasX || hasY) {
      return true;
    }
  }
  return false;
}

function captureBlob(c: ParsedCapture): string {
  return `${c.summary} ${c.findings}`.toLowerCase();
}

export function detectTopicConflict(
  repoRoot: string,
  capture: ParsedCapture,
): TopicConflictInfo {
  const tag = primaryTag(capture);
  const slug = tagToSlug(tag);
  const topicPath = memoryPath(repoRoot, "topics", `${slug}.md`);
  const relTopic = `topics/${slug}.md`;

  if (!existsSync(topicPath)) {
    return { hasConflict: false, reason: "none" };
  }

  let existing = "";
  try {
    existing = readFileSync(topicPath, "utf8");
  } catch {
    return { hasConflict: false, reason: "none" };
  }

  const blobCap = captureBlob(capture);
  const blobTopic = existing.toLowerCase();

  if (pairConflicts(blobCap, blobTopic)) {
    return {
      hasConflict: true,
      reason: "与现有团队 topic 存在互斥断言（规则检测）",
      topicPath: relTopic,
    };
  }

  return { hasConflict: false, reason: "none", topicPath: relTopic };
}
