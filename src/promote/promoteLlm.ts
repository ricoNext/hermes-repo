import type { LlmConfig } from "../config/llmConfig.js";
import type { ParsedCapture } from "../consolidate/parseCapture.js";
import { primaryTag } from "../consolidate/parseCapture.js";

async function chatJson(
  llm: LlmConfig,
  system: string,
  user: string,
): Promise<unknown | null> {
  const url = `${llm.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llm.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const ANALYZE_SYSTEM = `You help review whether a personal memory capture should be promoted to team-shared topics.
Respond with JSON only: { "note": "<1-2 sentences in Chinese>", "suggestedAction": "approve" | "defer" | "reject" }
Use defer when uncertain or one-off episodic events; reject when clearly personal noise.`;

export async function analyzeNoteViaLlm(
  llm: LlmConfig,
  capture: ParsedCapture,
  conflictSummary: string,
): Promise<{ note: string; suggestedAction?: string } | null> {
  const user = `Tag: ${primaryTag(capture)}
Type: ${capture.type}
Scope: ${capture.scope}
Summary: ${capture.summary}
Findings excerpt: ${capture.findings.slice(0, 800)}
Conflict check: ${conflictSummary}`;

  const parsed = (await chatJson(llm, ANALYZE_SYSTEM, user)) as {
    note?: string;
    suggestedAction?: string;
  } | null;

  if (!parsed?.note?.trim()) {
    return null;
  }
  return {
    note: parsed.note.trim(),
    suggestedAction: parsed.suggestedAction,
  };
}
