import { listPendingJobs } from "../capture/enqueueLlmJob.js";
import {
  CONSOLIDATE_COUNT_THRESHOLD,
  CONSOLIDATE_HOURS_THRESHOLD,
} from "./constants.js";
import { detectConflicts } from "./detectConflict.js";
import { filterActiveCaptures, listAllCaptures, selectNewCaptures } from "./listCaptures.js";
import { readConsolidateState } from "./state.js";

export interface ShouldConsolidateInput {
  repoRoot: string;
  force?: boolean;
  manual?: boolean;
}

export interface ShouldConsolidateResult {
  shouldRun: boolean;
  reason?: string;
  newCaptureCount: number;
  hasConflict: boolean;
  deferredPendingLlm?: boolean;
}

export function shouldRunConsolidate(
  input: ShouldConsolidateInput,
): ShouldConsolidateResult {
  const { repoRoot, force, manual } = input;

  if (force || manual) {
    const all = filterActiveCaptures(listAllCaptures(repoRoot));
    return {
      shouldRun: all.length > 0 || force === true,
      reason: manual ? "manual" : "force",
      newCaptureCount: all.length,
      hasConflict: detectConflicts(all).length > 0,
    };
  }

  const pending = listPendingJobs(repoRoot);
  if (pending.length > 0) {
    return {
      shouldRun: false,
      reason: "pending-llm-jobs",
      newCaptureCount: 0,
      hasConflict: false,
      deferredPendingLlm: true,
    };
  }

  const state = readConsolidateState(repoRoot);
  const all = listAllCaptures(repoRoot);
  const active = filterActiveCaptures(all);
  const newOnes = selectNewCaptures(active, state.processedCapturePaths, false);

  if (detectConflicts(active).length > 0 && newOnes.length > 0) {
    return {
      shouldRun: true,
      reason: "conflict",
      newCaptureCount: newOnes.length,
      hasConflict: true,
    };
  }

  if (newOnes.length >= CONSOLIDATE_COUNT_THRESHOLD) {
    return {
      shouldRun: true,
      reason: "count",
      newCaptureCount: newOnes.length,
      hasConflict: false,
    };
  }

  const lastMs = Date.parse(state.lastConsolidatedAt);
  const hoursSince =
    Number.isNaN(lastMs) ? Infinity : (Date.now() - lastMs) / (1000 * 60 * 60);

  if (hoursSince >= CONSOLIDATE_HOURS_THRESHOLD && newOnes.length >= 1) {
    return {
      shouldRun: true,
      reason: "time",
      newCaptureCount: newOnes.length,
      hasConflict: false,
    };
  }

  return {
    shouldRun: false,
    newCaptureCount: newOnes.length,
    hasConflict: false,
  };
}
