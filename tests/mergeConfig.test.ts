import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mergeConfigForInit } from "../src/init/mergeConfig.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("mergeConfigForInit", () => {
  it("creates config when missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-merge-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });

    const { content, action } = mergeConfigForInit(root, ["claude-code"]);
    expect(action).toBe("created");
    const config = JSON.parse(content) as {
      version: number;
      assistants: string[];
      debug: boolean;
      llm?: Record<string, unknown>;
      consolidate?: Record<string, unknown>;
    };
    expect(config.version).toBe(2); // v2: version=2
    expect(config.assistants).toEqual(["claude-code"]);
    expect(config.debug).toBe(false);
    // v2: 包含 llm 和 consolidate 默认字段
    expect(config.llm).toBeDefined();
    expect(config.llm?.enabled).toBe(false);
    expect(config.consolidate).toBeDefined();
    expect(config.consolidate?.autoArchiveDays).toBe(30);
    expect(config.consolidate?.autoFlush).toEqual({
      enabled: false,
      minPendingSessions: 3,
      minIntervalMinutes: 30,
      maxPendingChars: 20_000,
    });
  });

  it("merges init fields into existing config and preserves debug true", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-merge-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });
    writeFileSync(
      join(root, ".memory", "config.json"),
      `${JSON.stringify({
        version: 1,
        storage: { backend: "file" },
        assistants: ["legacy-id"],
        debug: true,
        customFlag: "keep-me",
      })}\n`,
      "utf8",
    );

    const { content, action } = mergeConfigForInit(root, [
      "claude-code",
      "legacy-id",
    ]);
    expect(action).toBe("overwritten");
    const config = JSON.parse(content) as {
      assistants: string[];
      debug: boolean;
      customFlag?: string;
    };
    expect(config.assistants).toEqual(["claude-code", "legacy-id"]);
    expect(config.debug).toBe(true);
    expect(config.customFlag).toBe("keep-me");
  });

  it("adds debug false when missing on re-init merge", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-merge-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });
    writeFileSync(
      join(root, ".memory", "config.json"),
      `${JSON.stringify({
        version: 1,
        storage: { backend: "file" },
        assistants: ["claude-code"],
      })}\n`,
      "utf8",
    );

    const { content } = mergeConfigForInit(root, ["claude-code"]);
    const config = JSON.parse(content) as { debug: boolean };
    expect(config.debug).toBe(false);
  });

  it("preserves existing autoFlush settings on re-init merge", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-merge-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });
    writeFileSync(
      join(root, ".memory", "config.json"),
      `${JSON.stringify({
        version: 2,
        storage: { backend: "file" },
        assistants: ["claude-code"],
        consolidate: {
          autoArchiveDays: 14,
          autoFlush: {
            enabled: true,
            minPendingSessions: 5,
          },
        },
      })}\n`,
      "utf8",
    );

    const { content } = mergeConfigForInit(root, ["claude-code"]);
    const config = JSON.parse(content) as {
      consolidate: {
        autoArchiveDays: number;
        autoFlush: {
          enabled: boolean;
          minPendingSessions: number;
          minIntervalMinutes: number;
          maxPendingChars: number;
        };
      };
    };
    expect(config.consolidate.autoArchiveDays).toBe(14);
    expect(config.consolidate.autoFlush).toEqual({
      enabled: true,
      minPendingSessions: 5,
      minIntervalMinutes: 30,
      maxPendingChars: 20_000,
    });
  });
});
