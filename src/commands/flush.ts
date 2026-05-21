import { hookExit } from "../hookExit.js";
import { runFlushCommand } from "../consolidate/scheduleConsolidate.js";

export async function runFlushCommandCli(opts: {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
  strict?: boolean;
}): Promise<void> {
  try {
    const result = await runFlushCommand({
      cwd: opts.cwd,
      force: opts.force,
      dryRun: opts.dryRun,
    });

    if (result.ran && result.memoryUpdated) {
      const extra: string[] = [];
      if (result.refsAggregated > 0) {
        extra.push(`${result.refsAggregated} ref(s) aggregated`);
      }
      if (result.archived > 0) {
        extra.push(`${result.archived} archived`);
      }
      const suffix = extra.length > 0 ? `, ${extra.join(", ")}` : "";
      console.error(
        `hermes-repo: consolidated ${result.newProcessed} capture(s), ${result.topicsWritten} topic(s), ${result.skillsWritten} skill(s)${suffix}`,
      );
    } else if (result.ran && result.reason === "dry-run") {
      console.error(
        `hermes-repo: dry-run would process ${result.newProcessed} capture(s)`,
      );
    }

    hookExit(0, opts.strict);
  } catch (err) {
    console.error(
      `hermes-repo flush: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
