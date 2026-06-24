import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { memoryPath } from "../init/paths.js";

// ─── v2 状态模型 ─────────────────────────────

export interface SessionStatusRecord {
  status: "pending" | "done" | "stale";
  consolidatedAt: string | null;
  lastCaptureAt: string;
}

export interface ConsolidateStateV2 {
  version: 2;
  lastConsolidatedAt: string;
  stats: {
    totalCapturesProcessed: number;
    domains: string[];
    knowledgeFilesCreated: number;
  };
  /** sessionId → status record */
  processedSessions: Record<string, SessionStatusRecord>;
}

const EMPTY_STATE: ConsolidateStateV2 = {
  version: 2,
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

export function readConsolidateState(repoRoot: string): ConsolidateStateV2 {
  const path = consolidateStatePath(repoRoot);
  if (!existsSync(path)) {
    return { ...EMPTY_STATE, processedSessions: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    // v1 → v2 自动升级
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.version === 2 && typeof obj.processedSessions === "object") {
        return raw as ConsolidateStateV2;
      }
      // v1 升级：processedCapturePaths → 空 processedSessions
      return {
        ...EMPTY_STATE,
        lastConsolidatedAt:
          typeof obj.lastConsolidatedAt === "string"
            ? obj.lastConsolidatedAt
            : EMPTY_STATE.lastConsolidatedAt,
      };
    }
    return { ...EMPTY_STATE, processedSessions: {} };
  } catch {
    return { ...EMPTY_STATE, processedSessions: {} };
  }
}

export function writeConsolidateState(
  repoRoot: string,
  state: ConsolidateStateV2,
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
