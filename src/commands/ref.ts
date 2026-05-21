import { loadRepoContext } from "../config/readConfig.js";
import { writeRef } from "../feedback/writeRef.js";
import { hookExit } from "../hookExit.js";

export function runRefCommand(opts: {
  cwd?: string;
  capture?: string;
  skill?: string;
  reason?: string;
  session?: string;
  strict?: boolean;
}): void {
  try {
    const ctx = loadRepoContext(opts.cwd);
    if (!ctx) {
      throw new Error("not a hermes-repo project (run init first)");
    }
    if (!opts.reason?.trim()) {
      throw new Error("--reason is required");
    }
    if (!opts.capture && !opts.skill) {
      throw new Error("specify --capture or --skill");
    }
    if (opts.capture && opts.skill) {
      throw new Error("use only one of --capture or --skill");
    }

    const { target, file } = writeRef({
      repoRoot: ctx.repoRoot,
      capture: opts.capture,
      skill: opts.skill,
      reason: opts.reason.trim(),
      session: opts.session,
    });

    console.error(`hermes-repo: ref recorded ${target} (${file})`);
    hookExit(0, opts.strict);
  } catch (err) {
    console.error(
      `hermes-repo ref: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
