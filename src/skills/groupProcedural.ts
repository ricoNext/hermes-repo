import {
  primaryTag,
  tagToSlug,
  type ParsedCapture,
} from "../consolidate/parseCapture.js";
import {
  captureTextBlob,
  countStepsInText,
  parseProceduralSections,
} from "./parseProcedural.js";
import {
  HIGH_RISK_KEYWORDS,
  SKILL_MIN_STEPS_FOR_PROMOTE,
  SKILL_PROMOTE_COUNT_THRESHOLD,
} from "./constants.js";

export interface ProceduralGroup {
  skillSlug: string;
  primaryTagName: string;
  captures: ParsedCapture[];
  forcedByPromote: boolean;
}

export function isHighRiskGroup(captures: ParsedCapture[]): boolean {
  for (const c of captures) {
    const blob = captureTextBlob(c);
    if (HIGH_RISK_KEYWORDS.some((kw) => blob.includes(kw.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

export function effectiveStepCount(capture: ParsedCapture): number {
  if (typeof capture.stepCount === "number" && capture.stepCount > 0) {
    return capture.stepCount;
  }
  const { steps } = parseProceduralSections(capture);
  return countStepsInText(steps);
}

export function shouldPromoteGroup(group: ProceduralGroup): boolean {
  const { captures, forcedByPromote } = group;
  if (forcedByPromote) {
    return true;
  }
  const count = captures.length;
  if (count >= SKILL_PROMOTE_COUNT_THRESHOLD) {
    return true;
  }
  if (isHighRiskGroup(captures) && count >= 1) {
    return true;
  }
  const maxSteps = Math.max(...captures.map((c) => effectiveStepCount(c)), 0);
  if (maxSteps <= SKILL_MIN_STEPS_FOR_PROMOTE) {
    return false;
  }
  return false;
}

export function groupProceduralCaptures(
  procedural: ParsedCapture[],
): ProceduralGroup[] {
  const map = new Map<string, ParsedCapture[]>();

  for (const c of procedural) {
    if (c.confidence === "superseded") {
      continue;
    }
    const tag = primaryTag(c);
    const slug = tagToSlug(tag);
    const list = map.get(slug) ?? [];
    list.push(c);
    map.set(slug, list);
  }

  const groups: ProceduralGroup[] = [];
  for (const [skillSlug, caps] of map) {
    const sorted = [...caps].sort((a, b) => b.date.localeCompare(a.date));
    const forcedByPromote = sorted.some((c) => c.hasPromoteMarker === true);
    groups.push({
      skillSlug,
      primaryTagName: primaryTag(sorted[0]),
      captures: sorted,
      forcedByPromote,
    });
  }

  return groups;
}

export function groupsToPromote(groups: ProceduralGroup[]): ProceduralGroup[] {
  return groups.filter(shouldPromoteGroup);
}
