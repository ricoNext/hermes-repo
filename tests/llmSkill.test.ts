import { describe, expect, it, afterEach } from "vitest";
import { generateSkillViaLlm } from "../src/skills/llmSkill.js";
import type { LlmConfig } from "../src/config/llmConfig.js";
import type { ProceduralGroup } from "../src/skills/groupProcedural.js";
import type { ParsedCapture } from "../src/consolidate/parseCapture.js";

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

const capture: ParsedCapture = {
  path: "captures/procedural/capture-2026-05-20-001.md",
  absolutePath: "/tmp/c.md",
  type: "procedural",
  date: "2026-05-20",
  session: "s1",
  tags: ["deploy"],
  scope: "all",
  confidence: "pending",
  bodyMarkdown: "## 目标\n\ndeploy\n\n## 步骤\n\n1. build\n2. push",
  findings: "",
  summary: "deploy",
};

const group: ProceduralGroup = {
  skillSlug: "deploy",
  primaryTagName: "deploy",
  captures: [capture],
  forcedByPromote: true,
};

describe("llmSkill", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("generateSkillViaLlm parses mock response", async () => {
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  description: "部署流程",
                  steps: "1. build\n2. push",
                  cautions: "- 先跑测试",
                  verification: "- smoke test",
                }),
              },
            },
          ],
        }),
      }) as Response;

    const extract = await generateSkillViaLlm(llm, group);
    expect(extract?.steps).toContain("build");
    expect(extract?.description).toContain("部署");
  });
});
