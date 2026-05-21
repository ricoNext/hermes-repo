import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { debugLog } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { CONSOLIDATE_LOCK_TTL_MS } from "./constants.js";
import {
  filterActiveCaptures,
  listAllCaptures,
} from "./listCaptures.js";
import { runConsolidate, type RunConsolidateResult } from "./runConsolidate.js";
import { isLockStale, readConsolidateLock } from "./state.js";
import { shouldRunConsolidate } from "./shouldRunConsolidate.js";

function cliPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
}

export function maybeScheduleConsolidate(opts: {
  repoRoot: string;
  debug?: boolean;
}): void {
  const { repoRoot, debug } = opts;
  const check = shouldRunConsolidate({ repoRoot });
  if (!check.shouldRun) {
    if (check.deferredPendingLlm) {
      debugLog(
        debug === true,
        "capture",
        "consolidate-deferred: pending llm jobs",
      );
    }
    return;
  }

  const lock = readConsolidateLock(repoRoot);
  if (lock && !isLockStale(lock, CONSOLIDATE_LOCK_TTL_MS)) {
    debugLog(debug === true, "capture", "consolidate-skip: lock held");
    return;
  }

  const child = spawn(
    process.execPath,
    [cliPath(), "flush", "-C", repoRoot],
    {
      detached: true,
      stdio: "ignore",
      cwd: repoRoot,
    },
  );
  child.unref();
  debugLog(
    debug === true,
    "capture",
    `consolidate scheduled (${check.reason}, ${check.newCaptureCount} new)`,
  );
}

export async function runFlushCommand(opts: {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}): Promise<RunConsolidateResult> {
  const ctx = loadRepoContext(opts.cwd);
  if (!ctx) {
    console.error(
      "hermes-repo flush: not initialized (.memory/config.json missing)",
    );
    return {
      ran: false,
      reason: "not-initialized",
      memoryUpdated: false,
      topicsWritten: 0,
      skillsWritten: 0,
      newProcessed: 0,
      refsAggregated: 0,
      archived: 0,
      demotedFromMemory: 0,
    };
  }

  const active = filterActiveCaptures(listAllCaptures(ctx.repoRoot));
  if (active.length === 0) {
    console.error("hermes-repo flush: no captures to consolidate");
    return {
      ran: false,
      reason: "no-captures",
      memoryUpdated: false,
      topicsWritten: 0,
      skillsWritten: 0,
      newProcessed: 0,
      refsAggregated: 0,
      archived: 0,
      demotedFromMemory: 0,
    };
  }

  return runConsolidate({
    repoRoot: ctx.repoRoot,
    force: opts.force,
    dryRun: opts.dryRun,
    debug: opts.debug ?? ctx.config.debug,
    manual: true,
  });
}
