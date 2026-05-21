import type { ParsedCapture } from "../consolidate/parseCapture.js";
import {
  filterMemoryEligible,
  shouldArchiveCapture,
} from "./memoryEligibility.js";
import { moveCaptureToArchive } from "./archiveCapture.js";

export interface ApplyLifecycleResult {
  archived: number;
  demotedFromMemory: number;
  memoryCaptures: ParsedCapture[];
}

export function applyLifecycle(
  repoRoot: string,
  allActive: ParsedCapture[],
  dryRun?: boolean,
  nowMs: number = Date.now(),
): ApplyLifecycleResult {
  const remaining: ParsedCapture[] = [];
  let archived = 0;

  for (const c of allActive) {
    if (shouldArchiveCapture(c, repoRoot, nowMs)) {
      if (!dryRun) {
        if (moveCaptureToArchive(repoRoot, c.path)) {
          archived++;
        }
      } else {
        archived++;
      }
      continue;
    }
    remaining.push(c);
  }

  const memoryCaptures = filterMemoryEligible(remaining, nowMs);
  const demotedFromMemory = remaining.length - memoryCaptures.length;

  return { archived, demotedFromMemory, memoryCaptures };
}
