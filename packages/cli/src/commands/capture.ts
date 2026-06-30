import { readHookInputSync, isCodebuddyCaptureHook } from "../capture/hookInput.js";
import { runCapture } from "../capture/runCapture.js";
import { configureDebugLogging, debugLog } from "../config/debugLog.js";
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
  const hookInput = readHookInputSync();

  if (hookInput && isCodebuddyCaptureHook(hookInput)) {
    const stdinPath =
      hookInput.transcriptPathRaw ??
      hookInput.transcriptPath ??
      "(missing)";
    debugLog(
      debug,
      "capture",
      `codebuddy stop stdin transcript_path=${stdinPath}`,
    );
  }

  finalizeHookCommand(async () => {
    await runCapture({
      cwd: opts.cwd,
      dryRun: opts.dryRun,
      strict: opts.strict,
      hookInput,
      transcriptPath: hookInput?.transcriptPath,
    });
  }, opts.strict, debug);
}
