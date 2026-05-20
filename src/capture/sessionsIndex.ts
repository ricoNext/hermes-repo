import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";

export interface SessionIndexEntry {
  id: string;
  capturedAt: string;
  captureFile: string;
  assistant: string;
}

interface SessionsIndexFile {
  version: number;
  sessions: SessionIndexEntry[];
}

export function readSessionsIndex(repoRoot: string): SessionsIndexFile {
  const indexPath = memoryPath(repoRoot, "sessions", "index.json");
  try {
    const data = JSON.parse(readFileSync(indexPath, "utf8")) as SessionsIndexFile;
    if (data.version === 1 && Array.isArray(data.sessions)) {
      return data;
    }
  } catch {
    // fall through
  }
  return { version: 1, sessions: [] };
}

export function appendSessionIndex(
  repoRoot: string,
  entry: SessionIndexEntry,
): void {
  const index = readSessionsIndex(repoRoot);
  index.sessions.push(entry);
  const indexPath = memoryPath(repoRoot, "sessions", "index.json");
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export function relativeCapturePath(
  type: string,
  filename: string,
): string {
  return join(".memory", "captures", type, filename).replace(/\\/g, "/");
}
