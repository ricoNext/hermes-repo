import type { ParsedSession } from "./types.js";

/**
 * 修复 2：CI/外部反馈信号集成
 * 根据 CI 结果和用户反应加权调整捕获决策
 */

export interface ExternalSignals {
  hasCIFailed: boolean;     // AI 修改导致 CI 失败
  hasCIPassed: boolean;     // AI 修改导致 CI 通过
  hasUserDislike: boolean;  // 用户明确表示不满意
  hasUserLike: boolean;     // 用户明确表示满意
}

export function analyzeExternalSignals(session: ParsedSession): ExternalSignals {
  return {
    hasCIFailed: session.ciStatus === "failed",
    hasCIPassed: session.ciStatus === "passed",
    hasUserDislike: session.userEmoji === "👎",
    hasUserLike: session.userEmoji === "👍",
  };
}

/**
 * 评估外部信号对捕获决策的影响
 * 返回值：
 *   > 0 = 增加保留倾向
 *   = 0 = 不影响
 *   < 0 = 增加丢弃倾向
 */
export function scoreExternalSignals(session: ParsedSession): number {
  const signals = analyzeExternalSignals(session);
  let score = 0;

  // 用户明确反馈最重要
  if (signals.hasUserLike) {
    score += 2;  // 用户喜欢，高价值
  }
  if (signals.hasUserDislike) {
    score -= 2;  // 用户不满意，低价值
  }

  // CI 结果是客观反馈
  if (signals.hasCIPassed && session.fileChanges > 0) {
    score += 1;  // AI 修改导致 CI 通过 = 有效
  }
  if (signals.hasCIFailed && session.fileChanges > 0) {
    score -= 1.5;  // AI 修改导致 CI 失败 = 无效（权重更大）
  }

  return score;
}

/**
 * 判断外部信号是否应该拒绝捕获
 * 返回 true = 应该拒绝（低价值）
 * 返回 false = 可以保留
 */
export function shouldRejectByExternalSignals(session: ParsedSession): boolean {
  // 如果没有外部信号，不做决定
  if (
    !session.ciStatus &&
    !session.userEmoji
  ) {
    return false;
  }

  const signals = analyzeExternalSignals(session);
  const score = scoreExternalSignals(session);

  // 有文件修改但 CI 失败 + 有纠正 = 低价值（应拒绝）
  if (
    signals.hasCIFailed &&
    session.fileChanges > 0 &&
    score < -0.5
  ) {
    return true;
  }

  // 用户明确表示不满意 = 拒绝
  if (signals.hasUserDislike) {
    return true;
  }

  return false;
}
