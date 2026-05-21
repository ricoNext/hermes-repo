import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  isLlmAvailable,
} from "../src/config/llmConfig.js";
import { readLlmConfigAtRepo } from "../src/config/readLlmConfig.js";
import { mergeLlmConfigForInit } from "../src/init/mergeLlmConfig.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-llm-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  return dir;
}

describe("llm config", () => {
  it("readLlmConfigAtRepo returns null when missing", () => {
    const repo = makeRepo();
    expect(readLlmConfigAtRepo(repo)).toBeNull();
  });

  it("isLlmAvailable requires enabled and credentials", () => {
    expect(
      isLlmAvailable({
        enabled: false,
        baseUrl: "https://api.openai.com/v1",
        model: "m",
        apiKey: "k",
        timeoutMs: 60000,
        maxInputChars: 24000,
        mode: "async",
      }),
    ).toBe(false);
    expect(
      isLlmAvailable({
        enabled: true,
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: "sk-test",
        timeoutMs: 60000,
        maxInputChars: 24000,
        mode: "async",
      }),
    ).toBe(true);
  });

  it("mergeLlmConfigForInit uses DeepSeek defaults for new llm.json", () => {
    const repo = makeRepo();
    const { content } = mergeLlmConfigForInit(repo, { enabled: false });
    const parsed = JSON.parse(content) as { baseUrl: string; model: string };
    expect(parsed.baseUrl).toBe(DEFAULT_LLM_BASE_URL);
    expect(parsed.model).toBe(DEFAULT_LLM_MODEL);
  });

  it("mergeLlmConfigForInit preserves existing apiKey when not provided", () => {
    const repo = makeRepo();
    writeFileSync(
      join(repo, ".memory/llm.json"),
      `${JSON.stringify({
        enabled: true,
        baseUrl: "https://api.openai.com/v1",
        model: "old-model",
        apiKey: "secret-key",
        timeoutMs: 60000,
        maxInputChars: 24000,
        mode: "async",
      })}\n`,
      "utf8",
    );
    const { content } = mergeLlmConfigForInit(repo, {
      enabled: true,
      model: "new-model",
    });
    const parsed = JSON.parse(content) as { apiKey: string; model: string };
    expect(parsed.apiKey).toBe("secret-key");
    expect(parsed.model).toBe("new-model");
  });
});
