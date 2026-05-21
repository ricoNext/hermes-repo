import { debugLog } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import type { HookInput } from "./hookInput.js";
import { routeCapture } from "./router.js";
import type { CaptureResult } from "./types.js";

export interface CaptureOptions {
  cwd?: string;
  dryRun?: boolean;
  strict?: boolean;
  /** Claude Stop hook stdin 中的 transcript_path（兼容旧调用） */
  transcriptPath?: string;
  hookInput?: HookInput | null;
}

function logCaptureResult(debug: boolean, result: CaptureResult): void {
  if (!debug) {
    return;
  }
  if (result.written && result.capturePath) {
    debugLog(true, "capture", `ok: ${result.capturePath}`);
    return;
  }
  const parts = [result.reason ?? "unknown"];
  if (result.jsonlPath) {
    parts.push(`jsonl=${result.jsonlPath}`);
  }
  debugLog(true, "capture", `skip: ${parts.join(", ")}`);
}

export async function runCapture(
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const ctx = loadRepoContext(options.cwd);
  if (!ctx) {
    return { written: false, reason: "not initialized" };
  }

  const result = await routeCapture(ctx, {
    cwd: options.cwd,
    dryRun: options.dryRun,
    transcriptPath: options.transcriptPath,
    hookInput: options.hookInput,
  });
  logCaptureResult(ctx.config.debug, result);
  return result;
}
