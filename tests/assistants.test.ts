import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mergeAssistants } from "../src/init/mergeAssistants.js";
import { parseToolsArg } from "../src/init/assistants/registry.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("assistants registry", () => {
  it("parseToolsArg accepts claude-code", () => {
    expect(parseToolsArg("claude-code")).toEqual(["claude-code"]);
  });

  it("parseToolsArg rejects unknown", () => {
    expect(() => parseToolsArg("unknown")).toThrow(/unknown/i);
  });

  it("parseToolsArg accepts cursor", () => {
    expect(parseToolsArg("cursor")).toEqual(["cursor"]);
  });

  it("parseToolsArg accepts claude-code,cursor", () => {
    expect(parseToolsArg("claude-code,cursor")).toEqual([
      "claude-code",
      "cursor",
    ]);
  });

  it("parseToolsArg accepts codebuddy", () => {
    expect(parseToolsArg("codebuddy")).toEqual(["codebuddy"]);
  });

  it("parseToolsArg accepts claude-code,cursor,codebuddy", () => {
    expect(parseToolsArg("claude-code,cursor,codebuddy")).toEqual([
      "claude-code",
      "cursor",
      "codebuddy",
    ]);
  });
});

describe("mergeAssistants", () => {
  it("unions existing and selected", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-merge-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, ".memory"), { recursive: true });

    writeFileSync(
      join(dir, ".memory/config.json"),
      `${JSON.stringify({
        version: 1,
        storage: { backend: "file" },
        assistants: ["legacy-id"],
      })}\n`,
      "utf8",
    );

    const merged = mergeAssistants(dir, ["claude-code"]);
    expect(merged).toContain("legacy-id");
    expect(merged).toContain("claude-code");
    expect(merged.length).toBe(2);
  });
});
