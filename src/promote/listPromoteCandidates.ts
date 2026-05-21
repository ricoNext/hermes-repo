import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CaptureMemoryType } from "../capture/types.js";
import { readCaptureFile } from "../consolidate/parseCapture.js";
import type { ParsedCapture } from "../consolidate/parseCapture.js";
import { memoryPath } from "../init/paths.js";
import { hasPromoteMarker } from "../skills/promoteMarker.js";

const TYPES: CaptureMemoryType[] = ["semantic", "episodic", "procedural"];

export function normalizeCapturePath(input: string): string {
  let p = input.replace(/\\/g, "/").trim();
  if (p.startsWith(".memory/")) {
    p = p.slice(".memory/".length);
  }
  if (p.startsWith("/")) {
    p = p.slice(1);
  }
  return p;
}

export function listPromoteCandidates(
  repoRoot: string,
  filterPaths?: string[],
): ParsedCapture[] {
  const filterSet =
    filterPaths && filterPaths.length > 0
      ? new Set(filterPaths.map(normalizeCapturePath))
      : null;

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
      if (filterSet && !filterSet.has(relativePath)) {
        continue;
      }
      if (!hasPromoteMarker(repoRoot, relativePath)) {
        continue;
      }
      const parsed = readCaptureFile(repoRoot, relativePath);
      if (parsed) {
        parsed.hasPromoteMarker = true;
        results.push(parsed);
      }
    }
  }

  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

export function listPromoteSidecarPaths(repoRoot: string): string[] {
  const paths: string[] = [];
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
      if (hasPromoteMarker(repoRoot, relativePath)) {
        paths.push(relativePath);
      }
    }
  }
  return paths;
}
