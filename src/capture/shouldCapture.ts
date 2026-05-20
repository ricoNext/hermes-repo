import type { ParsedSession } from "./types.js";

const STRONG_SIGNALS = [
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
  "fix",
  "because",
  "change to",
  "note",
  "convention",
  "never",
  "always",
  "root cause",
  "pattern",
  "架构",
  "决策",
];

const CORRECTION_RE =
  /不对|错了|不是这样|不应该|别用|stop|wrong|incorrect|改成|修正/i;

const SEMANTIC_SIGNAL_RE =
  /约定|必须|架构|决策|规范|convention|pattern|always|never/i;

/** v0.2：不因 fileChanges===0 单独否决（见 phase-2 已确认决策） */
export function shouldCapture(session: ParsedSession): boolean {
  if (session.messages.length < 3) {
    return false;
  }

  const hasStrongSignal = STRONG_SIGNALS.some((w) =>
    session.text.toLowerCase().includes(w.toLowerCase()),
  );
  const hasUserCorrection = session.messages.some(
    (m) => m.role === "user" && CORRECTION_RE.test(m.text),
  );
  const hasComplexTask = session.toolCalls > 5;

  return hasStrongSignal || hasUserCorrection || hasComplexTask;
}

export function inferCaptureType(session: ParsedSession): "semantic" | "episodic" {
  if (SEMANTIC_SIGNAL_RE.test(session.text)) {
    return "semantic";
  }
  return "episodic";
}
