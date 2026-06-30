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
  it("rejects greeting-only session (1-2 msgs + no work)", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    expect(session.messages.length).toBeLessThan(3);
    expect(session.toolCalls).toBe(0);
    expect(session.fileChanges).toBe(0);
    expect(shouldCapture(session)).toBe(false);
  });

  it("accepts short session with strong correction signal", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    // Simulate user correction in minimal session
    session.messages = [
      { role: "user", text: "这样对吗?" },
      { role: "assistant", text: "不对，应该改成..." },
      { role: "user", text: "错了，应该这样" },
    ];
    session.text = session.messages.map((m) => m.text).join("\n");
    expect(session.messages.length).toBe(3);
    expect(shouldCapture(session)).toBe(true);
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

  it("rejects greeting-only session", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-greeting-only.jsonl"),
    );
    expect(shouldCapture(session)).toBe(false);
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

  it("accepts short session with strong semantic signal", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    session.messages = [
      { role: "user", text: "我们应该改变架构吗?" },
      { role: "assistant", text: "建议改成..." },
    ];
    session.text = session.messages.map((m) => m.text).join("\n");
    session.fileChanges = 0;
    session.toolCalls = 0;
    expect(session.messages.length).toBe(2);
    expect(shouldCapture(session)).toBe(true);
  });

  it("rejects multiple corrections without convergence", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    session.messages = [
      { role: "user", text: "这样对吗?" },
      { role: "assistant", text: "我认为应该这样..." },
      { role: "user", text: "不对，改成X" },
      { role: "assistant", text: "好的改成X..." },
      { role: "user", text: "还是不对，改成Y" },
      { role: "assistant", text: "改成Y..." },
      { role: "user", text: "嗯，感觉还是有问题" },
    ];
    session.text = session.messages.map((m) => m.text).join("\n");
    session.fileChanges = 0;
    session.toolCalls = 2;
    expect(shouldCapture(session)).toBe(false);
  });

  it("accepts multiple corrections that converge to approval", () => {
    const session = parseJsonlFile(
      join(fixturesDir, "session-minimal.jsonl"),
    );
    session.messages = [
      { role: "user", text: "这样对吗?" },
      { role: "assistant", text: "我认为应该这样..." },
      { role: "user", text: "不对，改成X" },
      { role: "assistant", text: "好的改成X..." },
      { role: "user", text: "改成Y吧" },
      { role: "assistant", text: "改成Y..." },
      { role: "user", text: "好的，就这样" },
    ];
    session.text = session.messages.map((m) => m.text).join("\n");
    session.fileChanges = 1;
    session.toolCalls = 2;
    expect(shouldCapture(session)).toBe(true);
  });
});
