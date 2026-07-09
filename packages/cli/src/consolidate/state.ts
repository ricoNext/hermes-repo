import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { memoryPath } from "../init/paths.js";

export interface SessionStatusRecord {
  status: "pending" | "done" | "stale";
  consolidatedAt: string | null;
  lastCaptureAt: string;
}

export interface ConsolidateState {
  lastConsolidatedAt: string;
  stats: {
    totalCapturesProcessed: number;
    domains: string[];
    knowledgeFilesCreated: number;
  };
  /** sessionId → status record */
  processedSessions: Record<string, SessionStatusRecord>;
}

const EMPTY_STATE: ConsolidateState = {
  lastConsolidatedAt: new Date(0).toISOString(),
  stats: {
    totalCapturesProcessed: 0,
    domains: [],
    knowledgeFilesCreated: 0,
  },
  processedSessions: {},
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
    return { ...EMPTY_STATE, processedSessions: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null) {
      return { ...EMPTY_STATE, processedSessions: {} };
    }
    const obj = raw as Record<string, unknown>;
    const processedSessions =
      obj.processedSessions &&
      typeof obj.processedSessions === "object" &&
      !Array.isArray(obj.processedSessions)
        ? (obj.processedSessions as Record<string, SessionStatusRecord>)
        : {};
    const stats =
      obj.stats && typeof obj.stats === "object" && !Array.isArray(obj.stats)
        ? (obj.stats as Record<string, unknown>)
        : {};

    return {
      lastConsolidatedAt:
        typeof obj.lastConsolidatedAt === "string"
          ? obj.lastConsolidatedAt
          : EMPTY_STATE.lastConsolidatedAt,
      stats: {
        totalCapturesProcessed:
          typeof stats.totalCapturesProcessed === "number"
            ? stats.totalCapturesProcessed
            : EMPTY_STATE.stats.totalCapturesProcessed,
        domains: Array.isArray(stats.domains)
          ? stats.domains.filter((d): d is string => typeof d === "string")
          : [],
        knowledgeFilesCreated:
          typeof stats.knowledgeFilesCreated === "number"
            ? stats.knowledgeFilesCreated
            : EMPTY_STATE.stats.knowledgeFilesCreated,
      },
      processedSessions,
    };
  } catch {
    return { ...EMPTY_STATE, processedSessions: {} };
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

// ─── Lock（保留不变）─────────────────────────

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
