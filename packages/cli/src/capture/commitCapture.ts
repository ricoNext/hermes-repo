import { debugLog } from "../config/debugLog.js";
import { effectiveLlmMode, isLlmAvailable } from "../config/llmConfig.js";
import { readConfigAtRepo } from "../config/readConfig.js";
import type { AssistantId } from "../init/assistants/types.js";
import { enqueueLlmJob } from "./enqueueLlmJob.js";
import { llmFormat, simpleFormat } from "./formatCapture.js";
import { needsLlm } from "./needsLlm.js";
import type { CaptureResult } from "./types.js";
import { maybeScheduleConsolidate } from "../consolidate/scheduleConsolidate.js";
import {
  appendCaptureToSession,
} from "./writeCapture.js";
import type { ParsedSession } from "./types.js";

function finishCapture(
  repoRoot: string,
  debug: boolean | undefined,
  result: CaptureResult,
): CaptureResult {
  if (result.written) {
    maybeScheduleConsolidate({ repoRoot, debug });
  }
  return result;
}

export interface CommitCaptureOptions {
  repoRoot: string;
  session: ParsedSession;
  jsonlPath: string;
  assistant: AssistantId;
  dryRun?: boolean;
  debug?: boolean;
}

export async function commitCapture(
  opts: CommitCaptureOptions,
): Promise<CaptureResult> {
  const { repoRoot, session, jsonlPath, assistant, dryRun, debug } = opts;
  const formatted = simpleFormat(session, assistant);

  if (dryRun) {
    debugLog(
      debug === true,
      "capture",
      `[dry-run] would capture session=${session.sessionId} from ${jsonlPath}`,
    );
    return { written: false, reason: "dry-run", jsonlPath };
  }

  // v2: 使用 session 聚合模式写入
  const result = appendCaptureToSession(repoRoot, formatted);
  const captureFile = result.relativePath;

  // v2: 不再维护 sessions/index.json

  const llm = readConfigAtRepo(repoRoot)?.llm ?? null;
  if (!isLlmAvailable(llm) || !needsLlm(session)) {
    debugLog(debug === true, "capture", `ok: ${captureFile} (format=simple)`);
    return finishCapture(repoRoot, debug, {
      written: true,
      capturePath: captureFile,
      jsonlPath,
    });
  }

  const mode = effectiveLlmMode(llm!);
  if (mode === "sync") {
    const upgraded = await llmFormat(session, assistant, llm!);
    if (upgraded) {
      // v2: LLM upgrade 后重新追加到同一 session 文件（覆盖最后一个 capture 段落）
      // 简化处理：当前暂不实现 LLM in-place upgrade，后续在 Phase 2 完善
      debugLog(debug === true, "capture", `ok: ${captureFile} (format=llm-sync)`);
      return finishCapture(repoRoot, debug, {
        written: true,
        capturePath: captureFile,
        jsonlPath,
      });
    }
    debugLog(debug === true, "capture", `ok: ${captureFile} (format=simple, llm-fallback)`);
    return finishCapture(repoRoot, debug, {
      written: true,
      capturePath: captureFile,
      jsonlPath,
    });
  }

  const enqueued = enqueueLlmJob({
    repoRoot,
    sessionId: session.sessionId,
    jsonlPath,
    captureFile,
    assistant,
    debug,
  });
  if (enqueued) {
    debugLog(debug === true, "capture", `ok: ${captureFile} (format=simple, llm-enqueued)`);
  } else {
    debugLog(debug === true, "capture", `ok: ${captureFile} (format=simple, llm-skip-enqueue)`);
  }

  return finishCapture(repoRoot, debug, {
    written: true,
    capturePath: captureFile,
    jsonlPath,
  });
}
