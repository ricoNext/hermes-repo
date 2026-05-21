import type { ParsedSession } from "./types.js";
import { hasUserCorrection } from "./shouldCapture.js";

const ARCHITECTURE_SIGNAL_RE =
  /约定|必须|架构|决策|规范|根因|migration|refactor|convention|root cause/i;

export function hasArchitectureSignal(text: string): boolean {
  return ARCHITECTURE_SIGNAL_RE.test(text);
}

/** 复杂会话才走 LLM（需 isLlmAvailable 同时为 true） */
export function needsLlm(session: ParsedSession): boolean {
  return (
    session.messages.length >= 20 ||
    session.fileChanges >= 3 ||
    hasArchitectureSignal(session.text) ||
    hasUserCorrection(session)
  );
}
