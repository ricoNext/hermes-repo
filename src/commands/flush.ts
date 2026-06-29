import { hookExit } from "../hookExit.js";
import { runFlushCommand } from "../consolidate/scheduleConsolidate.js";
import type { ConsolidateResultV2 } from "../consolidate/runConsolidate.js";
import { configureDebugLogging, debugLog } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";

export async function runFlushCommandCli(opts: {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
  strict?: boolean;
}): Promise<void> {
  const ctx = loadRepoContext(opts.cwd);
  const debug = ctx?.config.debug === true;
  configureDebugLogging(ctx?.repoRoot ?? null, debug);
  debugLog(
    debug,
    "flush",
    `start: force=${opts.force === true}, dryRun=${opts.dryRun === true}`,
  );

  try {
    const result = await runFlushCommand({
      cwd: opts.cwd,
      force: opts.force,
      dryRun: opts.dryRun,
    });
    debugLog(
      debug,
      "flush",
      `result: ran=${result.ran}, reason=${result.reason ?? "ok"}, sessions=${result.sessionsProcessed}, created=${result.knowledgeCreated}, updated=${result.knowledgeUpdated}, skipped=${result.skippedCount}, archived=${result.archived}`,
    );

    if (result.ran) {
      if (result.reason === "dry-run") {
        console.error(
          `hermes-repo: dry-run would process ${result.sessionsProcessed} session(s)`,
        );
      } else {
        const parts: string[] = [];
        if (result.knowledgeCreated > 0)
          parts.push(`${result.knowledgeCreated} created`);
        if (result.knowledgeUpdated > 0)
          parts.push(`${result.knowledgeUpdated} updated`);
        if (result.skippedCount > 0)
          parts.push(`${result.skippedCount} skipped`);
        if (result.archived > 0)
          parts.push(`${result.archived} archived`);
        const suffix = parts.length > 0 ? `, ${parts.join(", ")}` : "";

        console.error(
          `hermes-repo: consolidated ${result.sessionsProcessed} session(s)${suffix}`,
        );
      }
    } else {
      switch (result.reason) {
        case "not-initialized":
          console.error(
            "hermes-repo flush: not initialized (.memory/config.json missing)",
          );
          break;
        case "llm-not-enabled":
          console.error("hermes-repo flush: LLM not enabled in config.json");
          break;
        case "no-pending-sessions":
          console.error("hermes-repo flush: no pending sessions to process");
          break;
        default:
          console.error(`hermes-repo flush: ${result.reason ?? "skipped"}`);
      }
    }

    hookExit(0, opts.strict);
  } catch (err) {
    debugLog(
      debug,
      "flush",
      `error: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error(
      `hermes-repo flush: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
