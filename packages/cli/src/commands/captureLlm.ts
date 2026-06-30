import { configureDebugLogging } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { flushPendingLlmJobs, runLlmJobById } from "../capture/runLlmJob.js";
import { finalizeHookCommand } from "../hookExit.js";

export interface CaptureLlmCommandOptions {
  cwd?: string;
  job?: string;
  flush?: boolean;
  strict?: boolean;
}

export function runCaptureLlmCommand(opts: CaptureLlmCommandOptions): void {
  const ctx = loadRepoContext(opts.cwd);
  const debug = ctx?.config.debug === true;
  configureDebugLogging(ctx?.repoRoot ?? null, debug);

  finalizeHookCommand(async () => {
    if (!ctx) {
      console.error("hermes-repo: not initialized");
      return;
    }
    const repoRoot = ctx.repoRoot;

    if (opts.flush) {
      const n = await flushPendingLlmJobs(repoRoot, debug);
      if (debug) {
        console.error(`hermes-repo: flushed ${n} llm job(s)`);
      }
      return;
    }

    if (!opts.job) {
      console.error("hermes-repo capture-llm: require --job <id> or --flush");
      return;
    }

    const result = await runLlmJobById(repoRoot, opts.job, debug);
    if (!result.ok && opts.strict) {
      throw new Error(result.reason ?? "capture-llm failed");
    }
  }, opts.strict, debug);
}
