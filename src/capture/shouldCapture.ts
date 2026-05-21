import type { ParsedSession } from "./types.js";

const CHINESE_STRONG_SIGNALS = [
  "修复",
  "因为",
  "改成",
  "注意",
  "约定",
  "不要",
  "必须",
  "最佳实践",
  "根因",
  "原因",
  "架构",
  "决策",
];

/** 整词匹配，避免 fix/note/pattern 子串误伤 */
const ENGLISH_STRONG_SIGNAL_PATTERNS: RegExp[] = [
  /\bfix\b/i,
  /\bbecause\b/i,
  /\bchange to\b/i,
  /\bnote\b/i,
  /\bconvention\b/i,
  /\bnever\b/i,
  /\balways\b/i,
  /\broot cause\b/i,
  /\bpattern\b/i,
];

const CORRECTION_RE =
  /不对|错了|不是这样|不应该|别用|stop|wrong|incorrect|改成|修正/i;

const SEMANTIC_SIGNAL_RE =
  /约定|必须|架构|决策|规范|convention|pattern|always|never/i;

function countUserMessages(session: ParsedSession): number {
  return session.messages.filter((m) => m.role === "user").length;
}

function hasStrongSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (CHINESE_STRONG_SIGNALS.some((w) => lower.includes(w.toLowerCase()))) {
    return true;
  }
  return ENGLISH_STRONG_SIGNAL_PATTERNS.some((re) => re.test(text));
}

export function hasUserCorrection(session: ParsedSession): boolean {
  return session.messages.some(
    (m) => m.role === "user" && CORRECTION_RE.test(m.text),
  );
}

/** v0.2：不因 fileChanges===0 单独否决（见 phase-2 已确认决策） */
export function shouldCapture(session: ParsedSession): boolean {
  if (session.messages.length < 3) {
    return false;
  }

  if (countUserMessages(session) < 2 && session.toolCalls <= 1) {
    return false;
  }

  const hasComplexTask = session.toolCalls > 5;

  return (
    hasStrongSignal(session.text) ||
    hasUserCorrection(session) ||
    hasComplexTask
  );
}

export function inferCaptureType(session: ParsedSession): "semantic" | "episodic" {
  if (SEMANTIC_SIGNAL_RE.test(session.text)) {
    return "semantic";
  }
  return "episodic";
}
