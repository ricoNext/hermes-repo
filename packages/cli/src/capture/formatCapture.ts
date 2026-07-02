import type { AssistantId } from "../init/assistants/types.js";
import type { CaptureMemoryType, ParsedSession } from "./types.js";

function inferCaptureType(session: ParsedSession): "semantic" | "episodic" {
  const SEMANTIC_SIGNAL_RE =
    /约定|必须|架构|决策|规范|convention|pattern|always|never/i;
  if (SEMANTIC_SIGNAL_RE.test(session.text)) {
    return "semantic";
  }
  return "episodic";
}

export interface FormattedCapture {
  type: CaptureMemoryType;
  sessionId: string;
  tags: string[];
  scope: string;
  bodyMarkdown: string;
}

function assistantLabel(assistant: AssistantId): string {
  return assistant;
}

export function simpleFormat(
  session: ParsedSession,
  assistant: AssistantId,
): FormattedCapture {
  const type = inferCaptureType(session);
  const recent = session.messages.slice(-6);
  const context = recent
    .map((m) => `**${m.role}**: ${m.text.slice(0, 500)}`)
    .join("\n\n");

  const bodyMarkdown = `## 上下文

自动捕获自 ${assistantLabel(assistant)} 会话 \`${session.sessionId}\`。

## 发现

${context || "（无提取内容）"}

## 影响

（待 consolidate 或人工补充）`;

  return {
    type,
    sessionId: session.sessionId,
    tags: ["auto-capture", assistant],
    scope: "all",
    bodyMarkdown,
  };
}
