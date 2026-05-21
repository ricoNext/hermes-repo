import type { ParsedCapture } from "../consolidate/parseCapture.js";
import { hasIgnoreMarker } from "./ignoreMarker.js";
import { daysSince, isWithinDays } from "./dates.js";
import {
  LIFECYCLE_ACTIVE_DAYS,
  LIFECYCLE_ARCHIVE_DAYS,
} from "./constants.js";

export function shouldArchiveCapture(
  capture: ParsedCapture,
  repoRoot: string,
  nowMs: number = Date.now(),
): boolean {
  if (hasIgnoreMarker(repoRoot, capture.path)) {
    return true;
  }

  const lastRef = capture.lastUsed;
  const created = capture.date;

  if (lastRef && isWithinDays(lastRef, LIFECYCLE_ARCHIVE_DAYS, nowMs)) {
    return false;
  }
  if (!lastRef && created && isWithinDays(created, LIFECYCLE_ARCHIVE_DAYS, nowMs)) {
    return false;
  }

  const refAge = lastRef ? daysSince(lastRef, nowMs) : Number.POSITIVE_INFINITY;
  const createAge = created ? daysSince(created, nowMs) : Number.POSITIVE_INFINITY;
  const idleDays = Math.min(refAge, createAge);

  return idleDays >= LIFECYCLE_ARCHIVE_DAYS;
}

export function isMemoryEligible(
  capture: ParsedCapture,
  nowMs: number = Date.now(),
): boolean {
  if (capture.date && isWithinDays(capture.date, LIFECYCLE_ACTIVE_DAYS, nowMs)) {
    return true;
  }
  if (capture.lastUsed && isWithinDays(capture.lastUsed, LIFECYCLE_ACTIVE_DAYS, nowMs)) {
    return true;
  }
  return false;
}

export function filterMemoryEligible(
  captures: ParsedCapture[],
  nowMs?: number,
): ParsedCapture[] {
  return captures.filter((c) => isMemoryEligible(c, nowMs));
}
