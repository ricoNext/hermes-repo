import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isLlmAvailable,
} from "../src/config/llmConfig.js";
import { readConfigAtRepo } from "../src/config/readConfig.js";
import { mergeConfigForInit } from "../src/init/mergeConfig.js";

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
  it("readConfigAtRepo returns null when config is missing", () => {
    const repo = makeRepo();
    expect(readConfigAtRepo(repo)).toBeNull();
  });

  it("isLlmAvailable requires enabled and credentials", () => {
    expect(
      isLlmAvailable({
        enabled: false,
        baseUrl: "https://api.deepseek.com",
        model: "m",
        apiKey: "k",
        timeoutMs: 60000,
        maxInputChars: 24000,
      }),
    ).toBe(false);
    expect(
      isLlmAvailable({
        enabled: true,
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        apiKey: "sk-test",
        timeoutMs: 60000,
        maxInputChars: 24000,
      }),
    ).toBe(true);
  });

  it("mergeConfigForInit writes LLM fields into config.json", () => {
    const repo = makeRepo();
    const { content } = mergeConfigForInit(repo, ["claude-code"]);
    const parsed = JSON.parse(content) as {
      llm: {
        enabled: boolean;
        baseUrl: string;
        model: string;
        apiKey: string;
        timeoutMs: number;
        maxInputChars: number;
      };
    };
    expect(parsed.llm.enabled).toBe(false);
    expect(parsed.llm.baseUrl).toBe("https://api.deepseek.com");
    expect(parsed.llm.model).toBe("deepseek-v4-flash");
    expect(parsed.llm.apiKey).toBe("");
    expect(parsed.llm.timeoutMs).toBe(60_000);
    expect(parsed.llm.maxInputChars).toBe(24_000);
  });

  it("mergeConfigForInit preserves existing apiKey", () => {
    const repo = makeRepo();
    writeFileSync(
      join(repo, ".memory/config.json"),
      `${JSON.stringify({
        assistants: ["claude-code"],
        llm: {
          enabled: true,
          baseUrl: "https://api.deepseek.com",
          model: "old-model",
          apiKey: "secret-key",
          timeoutMs: 60000,
          maxInputChars: 24000,
        },
      })}\n`,
      "utf8",
    );
    const { content } = mergeConfigForInit(repo, ["claude-code"]);
    const parsed = JSON.parse(content) as { llm: { apiKey: string; model: string } };
    expect(parsed.llm.apiKey).toBe("secret-key");
    expect(parsed.llm.model).toBe("old-model");
  });
});
