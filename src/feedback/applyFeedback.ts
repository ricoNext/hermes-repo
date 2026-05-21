import { aggregateRefs, type AggregateRefsResult } from "./aggregateRefs.js";

export function applyFeedback(
  repoRoot: string,
  dryRun?: boolean,
): AggregateRefsResult {
  return aggregateRefs(repoRoot, dryRun);
}
