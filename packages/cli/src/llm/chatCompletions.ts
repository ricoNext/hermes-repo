import type { LlmConfig } from "../config/llmConfig.js";
import { buildSessionDigest } from "./buildSessionDigest.js";
import {
  parseLlmExtractJson,
  type LlmExtractResult,
} from "./renderCaptureFromJson.js";
import type { ParsedSession } from "../capture/types.js";

const SYSTEM_PROMPT = `You extract project memory from an AI coding session transcript.
Respond with a single JSON object only (no markdown fence), matching this shape:
{
  "type": "semantic" | "episodic" | "procedural",
  "tags": ["tag1"],
  "scope": "all" | "frontend" | "backend",
  "title": "short summary",
  "context": "what was being done",
  "findings": "facts/decisions/root cause (semantic/episodic)",
  "impact": "effect on future work",
  "goal": "for procedural only",
  "steps": ["step 1"],
  "cautions": ["pitfall"],
  "verification": ["how to verify"]
}
Use procedural only for repeatable multi-step workflows. Use Chinese for content when the session is mainly Chinese.`;

export async function extractCaptureViaLlm(
  session: ParsedSession,
  llm: LlmConfig,
): Promise<LlmExtractResult | null> {
  const digest = buildSessionDigest(session, llm.maxInputChars);
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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract memory from this session:\n\n${digest}`,
          },
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    return parseLlmExtractJson(parsed);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
