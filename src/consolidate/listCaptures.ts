import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CaptureMemoryType } from "../capture/types.js";
import { memoryPath } from "../init/paths.js";
import { parseCaptureMarkdown, type ParsedCapture } from "./parseCapture.js";

const TYPES: CaptureMemoryType[] = ["semantic", "episodic", "procedural"];

export function listAllCaptures(repoRoot: string): ParsedCapture[] {
  const results: ParsedCapture[] = [];
  for (const type of TYPES) {
    const dir = memoryPath(repoRoot, "captures", type);
    if (!existsSync(dir)) {
      continue;
    }
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) {
        continue;
      }
      const relativePath = `captures/${type}/${name}`;
      const absolutePath = join(dir, name);
      try {
        const content = readFileSync(absolutePath, "utf8");
        const parsed = parseCaptureMarkdown(
          content,
          relativePath,
          absolutePath,
        );
        if (parsed) {
          results.push(parsed);
        }
      } catch {
        // skip unreadable
      }
    }
  }
  return results;
}

export function filterActiveCaptures(
  captures: ParsedCapture[],
): ParsedCapture[] {
  return captures.filter((c) => c.confidence !== "superseded");
}

export function selectNewCaptures(
  captures: ParsedCapture[],
  processedPaths: string[],
  force: boolean,
): ParsedCapture[] {
  const active = filterActiveCaptures(captures);
  if (force) {
    return active;
  }
  const processed = new Set(processedPaths);
  return active.filter((c) => !processed.has(c.path));
}

export function captureMtimeMs(capture: ParsedCapture): number {
  try {
    const st = statSync(capture.absolutePath);
    return st.mtimeMs;
  } catch {
    return 0;
  }
}
