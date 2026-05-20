import { debugLog } from "../../config/debugLog.js";
import { inferCaptureType, shouldCapture } from "../shouldCapture.js";
import {
  appendSessionIndex,
  relativeCapturePath,
} from "../sessionsIndex.js";
import type { CaptureResult } from "../types.js";
import { writeCaptureFile } from "../writeCapture.js";
import { parseJsonlFile } from "./parseJsonl.js";
import { resolveSessionJsonlPath } from "./resolveSession.js";

export function runClaudeCodeCapture(
  repoRoot: string,
  cwd?: string,
  dryRun?: boolean,
  options?: { transcriptPath?: string; debug?: boolean },
): CaptureResult {
  const jsonlPath = resolveSessionJsonlPath(repoRoot, {
    cwd,
    transcriptPath: options?.transcriptPath,
  });
  if (!jsonlPath) {
    return { written: false, reason: "no session jsonl found" };
  }

  const session = parseJsonlFile(jsonlPath);
  if (!shouldCapture(session)) {
    return {
      written: false,
      reason: `heuristic rejected (messages=${session.messages.length}, toolCalls=${session.toolCalls})`,
      jsonlPath,
    };
  }

  const type = inferCaptureType(session);

  if (dryRun) {
    debugLog(
      options?.debug === true,
      "capture",
      `[dry-run] would capture ${type} session=${session.sessionId} from ${jsonlPath}`,
    );
    return { written: false, reason: "dry-run", jsonlPath };
  }

  const { filename } = writeCaptureFile(repoRoot, session, type);
  const captureFile = relativeCapturePath(type, filename);

  appendSessionIndex(repoRoot, {
    id: session.sessionId,
    capturedAt: new Date().toISOString(),
    captureFile,
    assistant: "claude-code",
  });

  return { written: true, capturePath: captureFile };
}
