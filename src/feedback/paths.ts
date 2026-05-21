import { createHash } from "node:crypto";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";

export function refsDir(repoRoot: string): string {
  return memoryPath(repoRoot, "refs");
}

export function skillUsagePath(repoRoot: string): string {
  return memoryPath(repoRoot, "skill-usage.json");
}

export function refFileName(target: string, date: string): string {
  const hash = createHash("sha256").update(target).digest("hex").slice(0, 8);
  return `${date}-${hash}.json`;
}

export function refFilePath(repoRoot: string, target: string, date: string): string {
  return join(refsDir(repoRoot), refFileName(target, date));
}

export function normalizeCaptureTarget(input: string): string {
  let p = input.replace(/\\/g, "/").trim();
  if (p.startsWith(".memory/")) {
    p = p.slice(".memory/".length);
  }
  if (!p.startsWith("captures/")) {
    throw new Error(`capture path must start with captures/: ${input}`);
  }
  return p;
}

export function normalizeSkillTarget(slug: string): string {
  const s = slug.replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  return `skills/${s}/SKILL.md`;
}
