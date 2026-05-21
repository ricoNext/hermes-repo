import { loadRepoContext } from "../config/readConfig.js";
import {
  collectStats,
  formatStatsHuman,
  formatStatsJson,
} from "../stats/runStats.js";
import { hookExit } from "../hookExit.js";

export function runStatsCommand(opts: {
  cwd?: string;
  json?: boolean;
  strict?: boolean;
}): void {
  try {
    const ctx = loadRepoContext(opts.cwd);
    if (!ctx) {
      throw new Error("not a hermes-repo project (run init first)");
    }

    const stats = collectStats(ctx.repoRoot);
    const out = opts.json ? formatStatsJson(stats) : formatStatsHuman(stats);
    console.log(out.endsWith("\n") ? out.slice(0, -1) : out);
    hookExit(0, opts.strict);
  } catch (err) {
    console.error(
      `hermes-repo stats: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
