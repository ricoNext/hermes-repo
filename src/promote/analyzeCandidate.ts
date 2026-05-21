import type { LlmConfig } from "../config/llmConfig.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { primaryTag, tagToSlug, type ParsedCapture } from "../consolidate/parseCapture.js";
import { buildTopicDraftBody } from "./buildTopicDraft.js";
import { detectTopicConflict } from "./detectTopicConflict.js";
import { analyzeNoteViaLlm } from "./promoteLlm.js";
import { suggestTarget, targetHintForPr } from "./suggestTarget.js";
import type {
  PromoteCandidateAnalysis,
  PromoteSuggestedAction,
} from "./types.js";

function ruleNote(
  capture: ParsedCapture,
  conflict: ReturnType<typeof detectTopicConflict>,
  target: ReturnType<typeof suggestTarget>,
): string {
  const hint = targetHintForPr(target);
  if (conflict.hasConflict) {
    return `与 ${conflict.topicPath ?? "topics"} 可能存在冲突，建议延后讨论。${hint}`;
  }
  if (capture.type === "episodic") {
    return `情景记忆，请确认是否值得固化为团队约定。${hint}`;
  }
  return `无规则冲突，可进入团队层审查。${hint}`;
}

function resolveSuggestedAction(
  conflict: ReturnType<typeof detectTopicConflict>,
  capture: ParsedCapture,
  llmAction?: string,
): PromoteSuggestedAction {
  if (llmAction === "approve" || llmAction === "defer" || llmAction === "reject") {
    return llmAction;
  }
  if (conflict.hasConflict) {
    return "defer";
  }
  if (capture.type === "episodic") {
    return "defer";
  }
  return "approve";
}

export async function analyzeCandidate(
  repoRoot: string,
  capture: ParsedCapture,
  llm: LlmConfig | null,
): Promise<PromoteCandidateAnalysis> {
  const tag = primaryTag(capture);
  const topicSlug = tagToSlug(tag);
  const suggestedTarget = suggestTarget(capture);
  const conflict = detectTopicConflict(repoRoot, capture);

  let note = ruleNote(capture, conflict, suggestedTarget);
  let suggestedAction = resolveSuggestedAction(conflict, capture);

  if (isLlmAvailable(llm)) {
    const conflictSummary = conflict.hasConflict
      ? conflict.reason
      : "no conflict detected";
    const llmResult = await analyzeNoteViaLlm(llm!, capture, conflictSummary);
    if (llmResult?.note) {
      note = llmResult.note;
      suggestedAction = resolveSuggestedAction(
        conflict,
        capture,
        llmResult.suggestedAction,
      );
    }
  }

  const { body: topicDraftBody } = await buildTopicDraftBody(repoRoot, [capture], llm);

  return {
    capture,
    primaryTag: tag,
    topicSlug,
    suggestedTarget,
    suggestedAction,
    conflict,
    note,
    topicDraftBody,
  };
}

export async function analyzeCandidates(
  repoRoot: string,
  captures: ParsedCapture[],
  llm: LlmConfig | null,
): Promise<PromoteCandidateAnalysis[]> {
  const analyses: PromoteCandidateAnalysis[] = [];
  for (const c of captures) {
    analyses.push(await analyzeCandidate(repoRoot, c, llm));
  }
  return analyses;
}

/** 按 topic slug 合并 staging 草案（同 tag 多条捕获） */
export async function buildMergedStagingDrafts(
  repoRoot: string,
  analyses: PromoteCandidateAnalysis[],
  llm: LlmConfig | null,
): Promise<Map<string, string>> {
  const bySlug = new Map<string, ParsedCapture[]>();
  for (const a of analyses) {
    const list = bySlug.get(a.topicSlug) ?? [];
    list.push(a.capture);
    bySlug.set(a.topicSlug, list);
  }

  const drafts = new Map<string, string>();
  for (const [, group] of bySlug) {
    const { slug, body } = await buildTopicDraftBody(repoRoot, group, llm);
    drafts.set(slug, body);
  }
  return drafts;
}
