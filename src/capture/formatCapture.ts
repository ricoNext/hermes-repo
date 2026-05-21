import type { LlmConfig } from "../config/llmConfig.js";
import { extractCaptureViaLlm } from "../llm/chatCompletions.js";
import {
  renderBodyFromExtract,
  type LlmExtractResult,
} from "../llm/renderCaptureFromJson.js";
import type { AssistantId } from "../init/assistants/types.js";
import { inferCaptureType } from "./shouldCapture.js";
import type { CaptureMemoryType, ParsedSession } from "./types.js";

export interface FormattedCapture {
  type: CaptureMemoryType;
  sessionId: string;
  tags: string[];
  scope: string;
  bodyMarkdown: string;
  llmUpgradedAt?: string;
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

export function formattedFromLlmExtract(
  session: ParsedSession,
  assistant: AssistantId,
  extract: LlmExtractResult,
): FormattedCapture {
  const tagSet = new Set(["auto-capture", assistant, ...extract.tags]);
  return {
    type: extract.type,
    sessionId: session.sessionId,
    tags: [...tagSet],
    scope: extract.scope,
    bodyMarkdown: renderBodyFromExtract(extract),
    llmUpgradedAt: new Date().toISOString(),
  };
}

export async function llmFormat(
  session: ParsedSession,
  assistant: AssistantId,
  llm: LlmConfig,
): Promise<FormattedCapture | null> {
  const extract = await extractCaptureViaLlm(session, llm);
  if (!extract) {
    return null;
  }
  return formattedFromLlmExtract(session, assistant, extract);
}
