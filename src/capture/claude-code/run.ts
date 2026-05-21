import { commitCapture } from "../commitCapture.js";
import { shouldCapture } from "../shouldCapture.js";
import type { CaptureResult } from "../types.js";
import { parseJsonlFile } from "./parseJsonl.js";
import { resolveSessionJsonlPath } from "./resolveSession.js";

export async function runClaudeCodeCapture(
  repoRoot: string,
  cwd?: string,
  dryRun?: boolean,
  options?: { transcriptPath?: string; debug?: boolean },
): Promise<CaptureResult> {
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

  return commitCapture({
    repoRoot,
    session,
    jsonlPath,
    assistant: "claude-code",
    dryRun,
    debug: options?.debug,
  });
}
