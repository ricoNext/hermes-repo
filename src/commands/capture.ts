import { readHookTranscriptPathSync } from "../capture/claude-code/resolveSession.js";
import { runCapture } from "../capture/runCapture.js";
import { configureDebugLogging } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { finalizeHookCommand } from "../hookExit.js";

export interface CaptureCommandOptions {
  cwd?: string;
  dryRun?: boolean;
  strict?: boolean;
}

export function runCaptureCommand(opts: CaptureCommandOptions): void {
  const ctx = loadRepoContext(opts.cwd);
  const debug = ctx?.config.debug === true;
  configureDebugLogging(ctx?.repoRoot ?? null, debug);
  const transcriptPath = readHookTranscriptPathSync();

  finalizeHookCommand(() => {
    runCapture({
      cwd: opts.cwd,
      dryRun: opts.dryRun,
      strict: opts.strict,
      transcriptPath: transcriptPath ?? undefined,
    });
  }, opts.strict, debug);
}
