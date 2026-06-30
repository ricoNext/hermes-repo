import { commitCapture } from "../commitCapture.js";
import type { CaptureResult } from "../types.js";
import type { HookInput } from "../hookInput.js";
import { parseJsonlFile } from "../claude-code/parseJsonl.js";
import { resolveCodexSessionJsonl } from "./resolveSession.js";

export async function runCodexCapture(
  repoRoot: string,
  cwd?: string,
  dryRun?: boolean,
  options?: { hookInput?: HookInput | null; transcriptPath?: string; debug?: boolean },
): Promise<CaptureResult> {
  const jsonlPath = resolveCodexSessionJsonl({
    repoRoot,
    cwd,
    transcriptPath: options?.transcriptPath,
    hookInput: options?.hookInput,
  });
  if (!jsonlPath) {
    return { written: false, reason: "no codex session found" };
  }

  // v2: always capture (quality filtering removed — LLM decides value during consolidate)
  const session = parseJsonlFile(jsonlPath);
  if (session.messages.length <= 1 && session.toolCalls === 0) {
    return {
      written: false,
      reason: "empty session (no messages or tool calls)",
      jsonlPath,
    };
  }

  return commitCapture({
    repoRoot,
    session,
    jsonlPath,
    assistant: "codex",
    dryRun,
    debug: options?.debug,
  });
}
