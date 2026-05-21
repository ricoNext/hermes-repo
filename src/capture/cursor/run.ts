import { commitCapture } from "../commitCapture.js";
import { shouldCapture } from "../shouldCapture.js";
import type { HookInput } from "../hookInput.js";
import type { CaptureResult } from "../types.js";
import { parseJsonlFile } from "../claude-code/parseJsonl.js";
import { resolveCursorSessionJsonl } from "./resolveSession.js";

export async function runCursorCapture(
  repoRoot: string,
  cwd?: string,
  dryRun?: boolean,
  options?: { hookInput?: HookInput | null; debug?: boolean },
): Promise<CaptureResult> {
  if (
    options?.hookInput?.status === "aborted" &&
    !options.hookInput.sessionId
  ) {
    return { written: false, reason: "cursor stop aborted" };
  }

  const jsonlPath = resolveCursorSessionJsonl({
    repoRoot,
    cwd,
    hookInput: options?.hookInput,
  });
  if (!jsonlPath) {
    return { written: false, reason: "no cursor session found" };
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
    assistant: "cursor",
    dryRun,
    debug: options?.debug,
  });
}
