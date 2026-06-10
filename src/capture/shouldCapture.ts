import type { ParsedSession } from "./types.js";
import { isConvergent } from "./convergence.js";
import { shouldRejectByExternalSignals } from "./externalSignals.js";

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

/** v0.2：不因 fileChanges===0 单独否决（见 phase-2 已确认决策）
 * 优化 v2（修复 1）：添加收敛性分析，避免"改来改去但没结束"
 * 优化 v3（修复 2）：集成 CI/外部反馈信号 */
export function shouldCapture(session: ParsedSession): boolean {
  // 修复 2：外部信号否决（最高优先级的否决）
  if (shouldRejectByExternalSignals(session)) {
    return false;
  }

  // 有强信号：立即接受（即使短对话），这是最高优先级
  if (hasStrongSignal(session.text) || hasUserCorrection(session)) {
    // 但检查收敛性：多次纠正但没有结束 = 低价值
    if (hasUserCorrection(session) && !isConvergent(session)) {
      return false;
    }
    return true;
  }

  // 复杂任务：多工具调用说明有实质工作
  if (session.toolCalls > 5) {
    return true;
  }

  // 有文件修改 + 多轮对话：接受
  if (session.fileChanges > 0 && session.messages.length >= 3) {
    return true;
  }

  // 无任何实质信号的短对话才拒绝（greeting only）
  const isGreetingOnly = session.messages.length <= 2 && session.toolCalls === 0 && session.fileChanges === 0;
  if (isGreetingOnly) {
    return false;
  }

  return false;
}

export function inferCaptureType(session: ParsedSession): "semantic" | "episodic" {
  if (SEMANTIC_SIGNAL_RE.test(session.text)) {
    return "semantic";
  }
  return "episodic";
}
