import { loadRepoContext } from "../config/readConfig.js";
import {
  runConsolidate,
  type ConsolidateResultV2,
} from "./runConsolidate.js";
import { CONSOLIDATE_LOCK_TTL_MS } from "./constants.js";
import { scanAllSessions, filterPendingSessions } from "./sessionScanner.js";
import { readConsolidateLock, isLockStale } from "./state.js";

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

/**
 * v2: 自动调度 consolidate（由 capture hook 触发）。
 *
 * 暂时保留接口但简化逻辑：不再自动调度，
 * 因为 v2 采用懒 consolidate 策略（手动 flush）。
 * 后续如需自动触发可在此扩展。
 */
export function maybeScheduleConsolidate(opts: {
  repoRoot: string;
  debug?: boolean;
}): void {
  const lock = readConsolidateLock(opts.repoRoot);
  if (lock && !isLockStale(lock, CONSOLIDATE_LOCK_TTL_MS)) {
    return; // 锁已被持有
  }

  // v2: 不再自动调度，仅记录日志
  // 如需自动 flush，可取消下面的注释
  /*
  const child = spawn(process.execPath, [cliPath(), 'flush', '-C', opts.repoRoot], {
    detached: true, stdio: 'ignore', cwd: opts.repoRoot
  });
  child.unref();
  */
}
