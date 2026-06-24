import { commitCapture } from "../commitCapture.js";
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

  // v2: 始终捕获（去掉 shouldCapture 质量过滤），由 LLM 在 consolidate 时判断价值
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
    assistant: "codebuddy",
    dryRun,
    debug: options?.debug,
  });
}
