import type { ParsedCapture } from "../consolidate/parseCapture.js";

export type PromoteTarget = "topics" | "skills";

export type PromoteSuggestedAction = "approve" | "defer" | "reject";

export type PromoteDecisionAction = "approve" | "defer" | "reject";

export interface TopicConflictInfo {
  hasConflict: boolean;
  reason: string;
  topicPath?: string;
}

export interface PromoteCandidateAnalysis {
  capture: ParsedCapture;
  primaryTag: string;
  topicSlug: string;
  suggestedTarget: PromoteTarget;
  suggestedAction: PromoteSuggestedAction;
  conflict: TopicConflictInfo;
  /** PR 条目说明（规则或 LLM） */
  note: string;
  topicDraftBody: string;
}

export interface PromoteManifest {
  generatedAt: string;
  decisions: PromoteManifestDecision[];
}

export interface PromoteManifestDecision {
  capturePath: string;
  action: PromoteDecisionAction;
  target?: PromoteTarget;
  note?: string;
}

export interface PromotePrResult {
  analyses: PromoteCandidateAnalysis[];
  prBodyPath: string;
  stagingTopicPaths: string[];
  manifestTemplatePath: string;
}

export interface PromoteApplyResult {
  approved: string[];
  rejected: string[];
  deferred: string[];
  topicsWritten: string[];
}
