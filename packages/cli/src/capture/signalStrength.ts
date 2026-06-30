import type { ParsedSession } from "./types.js";

/**
 * 修复 3：信号强度分级
 * 从二元判断（有/无）改进为多级评分（强/中/弱/无）
 * 根据信号强度和对话复杂度加权决策
 */

export type SignalStrength = "strong" | "medium" | "weak" | "none";

const STRONG_SIGNAL_RE = /改成|不对|错了|应该是|决定用|约定是|必须|架构/i;
const MEDIUM_SIGNAL_RE =
  /考虑|也许|可能|试试|我们可以|看起来|似乎|建议|优化/i;
const WEAK_SIGNAL_RE = /为什么|怎样|怎么|什么时候|哪里|如何/i;

/**
 * 判断文本的信号强度
 * strong: 明确的决策或纠正
 * medium: 有价值但不确定的建议
 * weak: 可能有价值的探索性问题
 * none: 无信号
 */
export function getSignalStrength(text: string): SignalStrength {
  if (STRONG_SIGNAL_RE.test(text)) {
    return "strong";
  }
  if (MEDIUM_SIGNAL_RE.test(text)) {
    return "medium";
  }
  if (WEAK_SIGNAL_RE.test(text)) {
    return "weak";
  }
  return "none";
}

/**
 * 根据信号强度和对话复杂度加权决策
 */
export function shouldCaptureBySignalStrength(session: ParsedSession): boolean {
  const strength = getSignalStrength(session.text);

  // 强信号：始终保留
  if (strength === "strong") {
    return true;
  }

  // 中等信号：需要多轮对话或复杂任务
  if (strength === "medium") {
    return session.messages.length >= 4 || session.toolCalls > 3;
  }

  // 弱信号：只有特别复杂的任务才保留
  if (strength === "weak") {
    return session.toolCalls > 8 || session.fileChanges > 5;
  }

  // 无信号：返回 false，让其他逻辑决策
  return false;
}

/**
 * 为捕获计算综合强度分数（0-100）
 * 考虑文本信号、会话复杂度、文件修改等多个因子
 */
export function computeSignalScore(session: ParsedSession): number {
  let score = 0;

  // 文本信号权重：30 分
  const strength = getSignalStrength(session.text);
  if (strength === "strong") {
    score += 30;
  } else if (strength === "medium") {
    score += 15;
  } else if (strength === "weak") {
    score += 5;
  }

  // 会话复杂度权重：30 分
  const messageBonus = Math.min(30, (session.messages.length - 2) * 5);
  score += Math.max(0, messageBonus);

  // 工具调用权重：20 分
  const toolBonus = Math.min(20, session.toolCalls * 2);
  score += toolBonus;

  // 文件修改权重：20 分
  const fileBonus = Math.min(20, session.fileChanges * 5);
  score += fileBonus;

  return Math.min(100, score);
}

/**
 * 根据综合分数决策是否捕获
 * < 40: 不捕获
 * 40-70: 边界情况（可选 LLM 判断）
 * > 70: 捕获
 */
export function shouldCaptureByScore(session: ParsedSession): boolean {
  const score = computeSignalScore(session);
  return score >= 70;
}
