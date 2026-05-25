import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";
import { shouldCapture } from "../src/capture/shouldCapture.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "tests", "fixtures");
const codebuddySample = join(fixturesDir, "codebuddy-sample.jsonl");
const codebuddyReal = join(
  rootDir,
  "docs",
  "f6bbcf18-2c4c-417a-b452-8ce47427512a.jsonl",
);

describe("parseJsonl CodeBuddy", () => {
  it("extracts input_text/output_text and counts function_call", () => {
    const session = parseJsonlFile(codebuddySample);
    expect(session.messages.length).toBeGreaterThanOrEqual(3);
    expect(session.messages.some((m) => m.role === "user")).toBe(true);
    expect(session.messages.some((m) => m.role === "assistant")).toBe(true);
    expect(session.text).toContain("CustomerList");
    expect(session.toolCalls).toBe(7);
    expect(shouldCapture(session)).toBe(true);
  });

  it("parses real CodeBuddy export in docs/", () => {
    const session = parseJsonlFile(codebuddyReal);
    expect(session.messages.length).toBeGreaterThanOrEqual(3);
    expect(session.toolCalls).toBeGreaterThan(5);
    expect(shouldCapture(session)).toBe(true);
  });
});
