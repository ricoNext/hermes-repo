import { describe, expect, it, afterEach } from "vitest";
import { generateMemoryViaLlm } from "../src/consolidate/llmConsolidate.js";
import type { LlmConfig } from "../src/config/llmConfig.js";

const llm: LlmConfig = {
  enabled: true,
  provider: "openai",
  baseUrl: "https://api.example/v1",
  model: "test",
  apiKey: "sk-test",
  timeoutMs: 5000,
  maxInputChars: 8000,
  mode: "async",
};

const originalFetch = globalThis.fetch;

describe("llmConsolidate", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("generateMemoryViaLlm parses mock response", async () => {
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  activeTopics: "- **auth**: httpOnly",
                  recentExperience: "- [2026-05-20] fix",
                  conventions: "- use pnpm",
                  conflicts: "",
                }),
              },
            },
          ],
        }),
      }) as Response;

    const sections = await generateMemoryViaLlm(
      llm,
      "topics/auth.md",
      "recent line",
      "none",
      "3 captures",
    );
    expect(sections?.activeTopics).toContain("auth");
    expect(sections?.conventions).toContain("pnpm");
  });
});
