import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureMemoryType } from "../capture/types.js";
import { memoryPath } from "../init/paths.js";
import { parseCaptureMarkdown } from "../consolidate/parseCapture.js";

export interface SearchHit {
  path: string;
  summary: string;
}

export interface RunSearchOptions {
  repoRoot: string;
  keyword: string;
  type?: CaptureMemoryType;
  limit?: number;
}

function walkMdFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name.endsWith(".md")) {
      out.push(full);
    } else if (!name.startsWith(".")) {
      try {
        const st = readdirSync(full);
        if (Array.isArray(st)) {
          for (const child of readdirSync(full)) {
            if (child.endsWith(".md")) {
              out.push(join(full, child));
            }
          }
        }
      } catch {
        // not a directory
      }
    }
  }
  return out;
}

function listSkillMd(repoRoot: string): string[] {
  const skillsDir = memoryPath(repoRoot, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }
  const out: string[] = [];
  for (const slug of readdirSync(skillsDir)) {
    const f = join(skillsDir, slug, "SKILL.md");
    if (existsSync(f)) {
      out.push(f);
    }
  }
  return out;
}

function summaryFromFile(absPath: string, relFromMemory: string): string {
  try {
    const content = readFileSync(absPath, "utf8");
    if (relFromMemory.startsWith("captures/")) {
      const parsed = parseCaptureMarkdown(content, relFromMemory, absPath);
      if (parsed) {
        return parsed.summary.slice(0, 80);
      }
    }
    const line = content
      .split("\n")
      .find((l) => l.trim() && !l.startsWith("---") && !l.startsWith("#"));
    return (line ?? content).slice(0, 80).trim();
  } catch {
    return "";
  }
}

export function runSearch(opts: RunSearchOptions): SearchHit[] {
  const kw = opts.keyword.trim().toLowerCase();
  if (!kw) {
    return [];
  }
  const limit = opts.limit ?? 20;
  const hits: SearchHit[] = [];
  const memRoot = memoryPath(opts.repoRoot);

  const captureTypes: CaptureMemoryType[] = opts.type
    ? [opts.type]
    : ["semantic", "episodic", "procedural"];

  for (const t of captureTypes) {
    const dir = join(memRoot, "captures", t);
    for (const abs of walkMdFiles(dir)) {
      const rel = abs.replace(memRoot + "/", "").replace(/\\/g, "/");
      const content = readFileSync(abs, "utf8").toLowerCase();
      if (content.includes(kw)) {
        hits.push({
          path: rel,
          summary: summaryFromFile(abs, rel),
        });
      }
      if (hits.length >= limit) {
        return hits;
      }
    }
  }

  const topicsDir = join(memRoot, "topics");
  for (const abs of walkMdFiles(topicsDir)) {
    const rel = abs.replace(memRoot + "/", "").replace(/\\/g, "/");
    if (readFileSync(abs, "utf8").toLowerCase().includes(kw)) {
      hits.push({ path: rel, summary: summaryFromFile(abs, rel) });
    }
    if (hits.length >= limit) {
      return hits;
    }
  }

  for (const abs of listSkillMd(opts.repoRoot)) {
    const rel = abs.replace(memRoot + "/", "").replace(/\\/g, "/");
    if (readFileSync(abs, "utf8").toLowerCase().includes(kw)) {
      hits.push({ path: rel, summary: summaryFromFile(abs, rel) });
    }
    if (hits.length >= limit) {
      return hits;
    }
  }

  return hits;
}
