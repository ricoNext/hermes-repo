import type { RepoContext } from "../config/types.js";
import { runClaudeCodeCapture } from "./claude-code/run.js";
import type { CaptureResult } from "./types.js";

export function routeCapture(
  ctx: RepoContext,
  options: {
    cwd?: string;
    dryRun?: boolean;
    transcriptPath?: string;
  },
): CaptureResult {
  if (!ctx.config.assistants.includes("claude-code")) {
    return { written: false, reason: "claude-code not in assistants" };
  }

  return runClaudeCodeCapture(ctx.repoRoot, options.cwd, options.dryRun, {
    transcriptPath: options.transcriptPath,
    debug: ctx.config.debug === true,
  });
}
