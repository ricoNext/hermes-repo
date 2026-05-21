import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { RefRecord } from "./types.js";
import { refsDir } from "./paths.js";

export function listRefFiles(repoRoot: string): string[] {
  const dir = refsDir(repoRoot);
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).filter((n) => n.endsWith(".json"));
}

export function readRefFile(repoRoot: string, fileName: string): RefRecord | null {
  try {
    const raw = readFileSync(join(refsDir(repoRoot), fileName), "utf8");
    const parsed = JSON.parse(raw) as RefRecord;
    if (
      typeof parsed.target !== "string" ||
      typeof parsed.reason !== "string" ||
      typeof parsed.date !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function listAllRefs(repoRoot: string): RefRecord[] {
  const out: RefRecord[] = [];
  for (const name of listRefFiles(repoRoot)) {
    const rec = readRefFile(repoRoot, name);
    if (rec) {
      out.push(rec);
    }
  }
  return out;
}

export function deleteRefFile(repoRoot: string, fileName: string): void {
  try {
    unlinkSync(join(refsDir(repoRoot), fileName));
  } catch {
    // best effort
  }
}
