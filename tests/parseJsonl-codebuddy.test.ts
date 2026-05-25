import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";
import { shouldCapture } from "../src/capture/shouldCapture.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const codebuddySample = join(fixturesDir, "codebuddy-sample.jsonl");

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
});
