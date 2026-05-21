import { commitCapture } from "../commitCapture.js";
import { shouldCapture } from "../shouldCapture.js";
import type { CaptureResult } from "../types.js";
import { parseJsonlFile } from "../claude-code/parseJsonl.js";
import { resolveCodebuddySessionJsonl } from "./resolveSession.js";

export async function runCodebuddyCapture(
  repoRoot: string,
  cwd?: string,
  dryRun?: boolean,
  options?: { transcriptPath?: string; debug?: boolean },
): Promise<CaptureResult> {
  const jsonlPath = resolveCodebuddySessionJsonl({
    repoRoot,
    cwd,
    transcriptPath: options?.transcriptPath,
  });
  if (!jsonlPath) {
    return { written: false, reason: "no codebuddy session found" };
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
    assistant: "codebuddy",
    dryRun,
    debug: options?.debug,
  });
}
