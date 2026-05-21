import { describe, expect, it, afterEach } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";
import { llmFormat, simpleFormat } from "../src/capture/formatCapture.js";
import type { LlmConfig } from "../src/config/llmConfig.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

const llm: LlmConfig = {
  enabled: true,
  provider: "openai",
  baseUrl: "https://api.example/v1",
  model: "test-model",
  apiKey: "sk-test",
  timeoutMs: 5000,
  maxInputChars: 8000,
  mode: "async",
};

const originalFetch = globalThis.fetch;

describe("formatCapture", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("simpleFormat tags include assistant id", () => {
    const session = parseJsonlFile(join(fixturesDir, "session-rich.jsonl"));
    const formatted = simpleFormat(session, "cursor");
    expect(formatted.tags).toContain("cursor");
    expect(formatted.tags).toContain("auto-capture");
  });

  it("llmFormat parses mock API response", async () => {
    const session = parseJsonlFile(join(fixturesDir, "session-rich.jsonl"));
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: "semantic",
                  tags: ["auth"],
                  scope: "all",
                  context: "认证模块重构",
                  findings: "使用 httpOnly cookie",
                  impact: "避免 XSS",
                }),
              },
            },
          ],
        }),
      }) as Response;

    const formatted = await llmFormat(session, "claude-code", llm);
    expect(formatted?.type).toBe("semantic");
    expect(formatted?.bodyMarkdown).toContain("httpOnly");
    expect(formatted?.llmUpgradedAt).toBeDefined();
  });
});
