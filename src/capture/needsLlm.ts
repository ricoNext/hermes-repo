import type { ParsedSession } from "./types.js";
import {
  computeSignalScore,
  getSignalStrength,
} from "./signalStrength.js";

const ARCHITECTURE_SIGNAL_RE =
  /约定|必须|架构|决策|规范|根因|migration|refactor|convention|root cause/i;
const CORRECTION_RE =
  /不对|错了|不是这样|不应该|别用|stop|wrong|incorrect|改成|修正/i;

/** 内联：用户纠正检测（原 shouldCapture.ts） */
function hasUserCorrection(session: ParsedSession): boolean {
  return session.messages.some(
    (m) => m.role === "user" && CORRECTION_RE.test(m.text),
  );
}

export function hasArchitectureSignal(text: string): boolean {
  return ARCHITECTURE_SIGNAL_RE.test(text);
}

/**
 * 判断会话是否需要 LLM 升级
 *
 * 触发条件（满足任一即可）：
 * 1. 高复杂度：消息数、文件修改、工具调用达到阈值
 * 2. 强信号：明确决策、约定、架构相关
 * 3. 用户纠正：用户有纠正行为
 * 4. 组合条件：中等复杂度 + 中等信号
 * 5. 综合分数：分数 ≥ 55
 */
export function needsLlm(session: ParsedSession): boolean {
  // 1. 高复杂度会话
  if (session.messages.length >= 20) return true;
  if (session.fileChanges >= 3) return true;
  if (session.toolCalls >= 8) return true;

  // 2. 强信号（重要约定、决策应被 LLM 提炼）
  const strength = getSignalStrength(session.text);
  if (strength === "strong") return true;

  // 3. 架构信号
  if (hasArchitectureSignal(session.text)) return true;

  // 4. 用户纠正（纠正过程有价值，需要 LLM 总结）
  if (hasUserCorrection(session)) return true;

  // 5. 组合条件：中等复杂度 + 有实质工作
  if (session.messages.length >= 10 && session.toolCalls >= 5) return true;
  if (strength === "medium" && session.fileChanges >= 2) return true;
  if (session.toolCalls >= 5 && session.fileChanges >= 1) return true;

  // 6. 基于综合分数
  const score = computeSignalScore(session);
  if (score >= 55) return true;

  return false;
}
