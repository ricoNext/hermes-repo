import { debugLog } from "../config/debugLog.js";
import type { AssistantId } from "../init/assistants/types.js";
import { simpleFormat } from "./formatCapture.js";
import type { CaptureResult } from "./types.js";
import { maybeScheduleConsolidate } from "../consolidate/scheduleConsolidate.js";
import { appendCaptureToSession } from "./writeCapture.js";
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

  const result = appendCaptureToSession(repoRoot, formatted);
  debugLog(debug === true, "capture", `ok: ${result.relativePath}`);

  return finishCapture(repoRoot, debug, {
    written: true,
    capturePath: result.relativePath,
    jsonlPath,
  });
}
