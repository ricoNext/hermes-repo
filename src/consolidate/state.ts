import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { memoryPath } from "../init/paths.js";

export interface ConsolidateState {
  version: 1;
  lastConsolidatedAt: string;
  processedCapturePaths: string[];
}

const EMPTY_STATE: ConsolidateState = {
  version: 1,
  lastConsolidatedAt: new Date(0).toISOString(),
  processedCapturePaths: [],
};

export function consolidateStatePath(repoRoot: string): string {
  return memoryPath(repoRoot, "consolidate-state.json");
}

export function consolidateLockPath(repoRoot: string): string {
  return memoryPath(repoRoot, ".consolidate.lock");
}

export function readConsolidateState(repoRoot: string): ConsolidateState {
  const path = consolidateStatePath(repoRoot);
  if (!existsSync(path)) {
    return { ...EMPTY_STATE, processedCapturePaths: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ConsolidateState>;
    if (raw.version !== 1) {
      return { ...EMPTY_STATE, processedCapturePaths: [] };
    }
    return {
      version: 1,
      lastConsolidatedAt:
        typeof raw.lastConsolidatedAt === "string"
          ? raw.lastConsolidatedAt
          : EMPTY_STATE.lastConsolidatedAt,
      processedCapturePaths: Array.isArray(raw.processedCapturePaths)
        ? raw.processedCapturePaths.filter((p) => typeof p === "string")
        : [],
    };
  } catch {
    return { ...EMPTY_STATE, processedCapturePaths: [] };
  }
}

export function writeConsolidateState(
  repoRoot: string,
  state: ConsolidateState,
): void {
  const path = consolidateStatePath(repoRoot);
  mkdirSync(memoryPath(repoRoot), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export interface ConsolidateLock {
  pid: number;
  startedAt: string;
}

export function readConsolidateLock(repoRoot: string): ConsolidateLock | null {
  const path = consolidateLockPath(repoRoot);
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ConsolidateLock;
  } catch {
    return null;
  }
}

export function writeConsolidateLock(repoRoot: string): void {
  const payload: ConsolidateLock = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  mkdirSync(memoryPath(repoRoot), { recursive: true });
  writeFileSync(
    consolidateLockPath(repoRoot),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

export function releaseConsolidateLock(repoRoot: string): void {
  const path = consolidateLockPath(repoRoot);
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

export function isLockStale(
  lock: ConsolidateLock,
  ttlMs: number,
): boolean {
  const started = Date.parse(lock.startedAt);
  if (Number.isNaN(started)) {
    return true;
  }
  return Date.now() - started > ttlMs;
}
