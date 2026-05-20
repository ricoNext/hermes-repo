import { debugLog } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { routeCapture } from "./router.js";
import type { CaptureResult } from "./types.js";

export interface CaptureOptions {
  cwd?: string;
  dryRun?: boolean;
  strict?: boolean;
  /** Claude Stop hook stdin 中的 transcript_path */
  transcriptPath?: string;
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

export function runCapture(options: CaptureOptions = {}): CaptureResult {
  const ctx = loadRepoContext(options.cwd);
  if (!ctx) {
    return { written: false, reason: "not initialized" };
  }

  const result = routeCapture(ctx, {
    cwd: options.cwd,
    dryRun: options.dryRun,
    transcriptPath: options.transcriptPath,
  });
  logCaptureResult(ctx.config.debug, result);
  return result;
}
