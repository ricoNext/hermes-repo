import { commitCapture } from "../commitCapture.js";
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

  // v2: 始终捕获（去掉 shouldCapture 质量过滤）
  const session = parseJsonlFile(jsonlPath);

  return commitCapture({
    repoRoot,
    session,
    jsonlPath,
    assistant: "claude-code",
    dryRun,
    debug: options?.debug,
  });
}
