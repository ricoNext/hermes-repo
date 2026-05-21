import { debugLog } from "../config/debugLog.js";
import { effectiveLlmMode, isLlmAvailable } from "../config/llmConfig.js";
import { readLlmConfigAtRepo } from "../config/readLlmConfig.js";
import type { AssistantId } from "../init/assistants/types.js";
import { enqueueLlmJob } from "./enqueueLlmJob.js";
import { llmFormat, simpleFormat } from "./formatCapture.js";
import { needsLlm } from "./needsLlm.js";
import {
  appendSessionIndex,
  relativeCapturePath,
} from "./sessionsIndex.js";
import type { CaptureResult } from "./types.js";
import { maybeScheduleConsolidate } from "../consolidate/scheduleConsolidate.js";
import { replaceCaptureFile, writeCaptureFile } from "./writeCapture.js";
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
  const type = formatted.type;

  if (dryRun) {
    debugLog(
      debug === true,
      "capture",
      `[dry-run] would capture ${type} session=${session.sessionId} from ${jsonlPath}`,
    );
    return { written: false, reason: "dry-run", jsonlPath };
  }

  const { filename } = writeCaptureFile(repoRoot, formatted);
  const captureFile = relativeCapturePath(type, filename);

  appendSessionIndex(repoRoot, {
    id: session.sessionId,
    capturedAt: new Date().toISOString(),
    captureFile,
    assistant,
  });

  const llm = readLlmConfigAtRepo(repoRoot);
  if (!isLlmAvailable(llm) || !needsLlm(session)) {
    debugLog(
      debug === true,
      "capture",
      `ok: ${captureFile} (format=simple)`,
    );
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
      replaceCaptureFile(repoRoot, captureFile, upgraded);
      debugLog(debug === true, "capture", `ok: ${captureFile} (format=llm-sync)`);
      return finishCapture(repoRoot, debug, {
        written: true,
        capturePath: captureFile,
        jsonlPath,
      });
    }
    debugLog(
      debug === true,
      "capture",
      `ok: ${captureFile} (format=simple, llm-fallback)`,
    );
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
    debugLog(
      debug === true,
      "capture",
      `ok: ${captureFile} (format=simple, llm-enqueued)`,
    );
  } else {
    debugLog(
      debug === true,
      "capture",
      `ok: ${captureFile} (format=simple, llm-skip-enqueue)`,
    );
  }

  return finishCapture(repoRoot, debug, {
    written: true,
    capturePath: captureFile,
    jsonlPath,
  });
}
