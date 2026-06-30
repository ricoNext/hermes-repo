import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { debugLog } from "../config/debugLog.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { loadRepoContext } from "../config/readConfig.js";
import type { ConsolidateConfig } from "../config/types.js";
import {
  runConsolidate,
  type ConsolidateResultV2,
} from "./runConsolidate.js";
import { CONSOLIDATE_LOCK_TTL_MS } from "./constants.js";
import {
  scanAllSessions,
  filterPendingSessions,
  type ScannedSession,
} from "./sessionScanner.js";
import {
  readConsolidateLock,
  isLockStale,
  readConsolidateState,
} from "./state.js";

function cliPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
}

/**
 * v2: flush 命令入口。
 * 直接调用 runConsolidate（单次 LLM 调用）。
 */
export async function runFlushCommand(opts: {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}): Promise<ConsolidateResultV2> {
  const ctx = loadRepoContext(opts.cwd);
  if (!ctx) {
    return {
      ran: false,
      reason: "not-initialized",
      sessionsProcessed: 0,
      knowledgeCreated: 0,
      knowledgeUpdated: 0,
      skippedCount: 0,
      archived: 0,
    };
  }

  // 检查是否有可处理的 session
  const allSessions = scanAllSessions(ctx.repoRoot);
  const pendingSessions = opts.force
    ? allSessions
    : filterPendingSessions(allSessions);

  if (pendingSessions.length === 0 && !opts.force && !opts.dryRun) {
    return {
      ran: false,
      reason: "no-pending-sessions",
      sessionsProcessed: 0,
      knowledgeCreated: 0,
      knowledgeUpdated: 0,
      skippedCount: 0,
      archived: 0,
    };
  }

  return runConsolidate({
    repoRoot: ctx.repoRoot,
    config: ctx.config,
    force: opts.force,
    dryRun: opts.dryRun,
    debug: opts.debug ?? ctx.config.debug,
  });
}

export function shouldAutoFlush(
  sessions: ScannedSession[],
  consolidate: ConsolidateConfig,
  lastConsolidatedAt: string,
): boolean {
  const autoFlush = consolidate.autoFlush;
  if (!autoFlush.enabled || sessions.length === 0) {
    return false;
  }

  if (sessions.length >= autoFlush.minPendingSessions) {
    return true;
  }

  const pendingChars = sessions.reduce(
    (sum, session) => sum + session.bodyContent.length,
    0,
  );
  if (pendingChars >= autoFlush.maxPendingChars) {
    return true;
  }

  const last = Date.parse(lastConsolidatedAt);
  if (Number.isNaN(last)) {
    return true;
  }

  const minIntervalMs = autoFlush.minIntervalMinutes * 60 * 1000;
  return Date.now() - last >= minIntervalMs;
}

/**
 * v2: 自动调度 consolidate（由 capture hook 触发）。
 */
export function maybeScheduleConsolidate(opts: {
  repoRoot: string;
  debug?: boolean;
}): void {
  const ctx = loadRepoContext(opts.repoRoot);
  if (!ctx) {
    return;
  }

  const autoFlush = ctx.config.consolidate.autoFlush;
  if (!autoFlush.enabled) {
    return;
  }

  if (!isLlmAvailable(ctx.config.llm)) {
    debugLog(opts.debug === true, "consolidate", "auto flush skipped: llm not available");
    return;
  }

  const lock = readConsolidateLock(opts.repoRoot);
  if (lock && !isLockStale(lock, CONSOLIDATE_LOCK_TTL_MS)) {
    debugLog(opts.debug === true, "consolidate", "auto flush skipped: lock held");
    return; // 锁已被持有
  }

  const pendingSessions = filterPendingSessions(scanAllSessions(opts.repoRoot));
  const state = readConsolidateState(opts.repoRoot);
  if (
    !shouldAutoFlush(
      pendingSessions,
      ctx.config.consolidate,
      state.lastConsolidatedAt,
    )
  ) {
    debugLog(
      opts.debug === true,
      "consolidate",
      `auto flush skipped: ${pendingSessions.length} pending session(s) below thresholds`,
    );
    return;
  }

  try {
    const child = spawn(
      process.execPath,
      [cliPath(), "flush", "-C", opts.repoRoot],
      {
        detached: true,
        stdio: "ignore",
        cwd: opts.repoRoot,
      },
    );
    child.unref();
    debugLog(
      opts.debug === true,
      "consolidate",
      `auto flush scheduled: ${pendingSessions.length} pending session(s)`,
    );
  } catch (err) {
    debugLog(
      opts.debug === true,
      "consolidate",
      `auto flush spawn failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
