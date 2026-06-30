import type { ParsedSession } from "./types.js";

export interface MessagePattern {
  userCorrections: number;
  lastUserMessage: string;
  hasFinalApproval: boolean;
  hasUncertainty: boolean;
}

/**
 * 分析对话的收敛性：是否最后有明确的结论/批准？
 * 用于判断"改来改去但没结束"这类低价值对话
 */
export function analyzeMessagePattern(session: ParsedSession): MessagePattern {
  let userCorrections = 0;
  let lastUserMessage = "";

  // 后向扫描：从最后开始找用户的最后一条消息
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];

    if (msg.role === "user") {
      lastUserMessage = msg.text;

      // 统计所有的纠正信号
      for (const userMsg of session.messages) {
        if (
          userMsg.role === "user" &&
          /不对|错了|改|改成|改为|应该是|应该用/i.test(userMsg.text)
        ) {
          userCorrections++;
        }
      }

      break; // 只关心最后一条用户消息
    }
  }

  // 检查最后的态度
  const hasFinalApproval =
    /好的|可以|就这样|同意|对|yes|ok|looks good|perfect|确认|同意/i.test(
      lastUserMessage
    );

  // 检查是否表示不确定/未解决
  const hasUncertainty =
    /不明白|还是|有问题|不太对|感觉|好像|可能|应该|不是很|似乎/i.test(
      lastUserMessage
    );

  return {
    userCorrections,
    lastUserMessage,
    hasFinalApproval,
    hasUncertainty,
  };
}

/**
 * 判断对话是否收敛（最后有明确结论）
 * 返回 true = 有价值（收敛或无纠正）
 * 返回 false = 低价值（多次纠正但无结论）
 */
export function isConvergent(session: ParsedSession): boolean {
  const pattern = analyzeMessagePattern(session);

  // 情况 1：有明确批准 = 收敛（高价值）
  if (pattern.hasFinalApproval) {
    return true;
  }

  // 情况 2：多次纠正但无明确结论 = 未收敛（低价值）
  if (pattern.userCorrections > 1 && !pattern.hasFinalApproval) {
    // 还额外检查是否表示不确定
    if (pattern.hasUncertainty) {
      return false; // 明确丢弃：改来改去 + 仍不确定
    }
    // 如果只是"改来改去"但最后默认接受，还是算收敛
    return true;
  }

  // 情况 3：无纠正或单次纠正 = 默认收敛
  return true;
}
