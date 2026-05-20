import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";
import { shouldCapture } from "../src/capture/shouldCapture.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

describe("shouldCapture", () => {
  it("rejects minimal session under 3 messages", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    expect(session.messages.length).toBeLessThan(3);
    expect(shouldCapture(session)).toBe(false);
  });

  it("accepts rich session with correction and signals", () => {
    const session = parseJsonlFile(join(fixturesDir, "session-rich.jsonl"));
    expect(shouldCapture(session)).toBe(true);
  });

  it("accepts no file changes when user corrects", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-no-files-correction.jsonl"),
    );
    expect(session.fileChanges).toBe(0);
    expect(shouldCapture(session)).toBe(true);
  });

  it("rejects no file changes without signals", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-no-files-correction.jsonl"),
    );
    session.text = "hello world only";
    session.messages = [
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
      { role: "user", text: "c" },
    ];
    expect(shouldCapture(session)).toBe(false);
  });
});
