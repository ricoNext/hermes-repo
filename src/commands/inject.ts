import { isCursorInjectHook, readHookInputSync } from "../capture/hookInput.js";
import { configureDebugLogging } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { finalizeHookCommand } from "../hookExit.js";
import { runInject } from "../inject/runInject.js";

export interface InjectCommandOptions {
  cwd?: string;
  strict?: boolean;
}

export function runInjectCommand(opts: InjectCommandOptions): void {
  const ctx = loadRepoContext(opts.cwd);
  const debug = ctx?.config.debug === true;
  configureDebugLogging(ctx?.repoRoot ?? null, debug);

  const hookInput = readHookInputSync();
  const cursorHookOutput = isCursorInjectHook(hookInput);

  finalizeHookCommand(() => {
    runInject(opts.cwd, { cursorHookOutput });
  }, opts.strict, debug);
}
