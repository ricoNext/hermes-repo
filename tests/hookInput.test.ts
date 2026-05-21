import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isClaudeCaptureHook,
  isCodebuddyCaptureHook,
  isCursorCaptureHook,
  isCursorInjectHook,
  parseHookInputJson,
} from "../src/capture/hookInput.js";

describe("hookInput", () => {
  it("parses Claude transcript_path under .claude", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-hook-"));
    const jsonl = join(dir, ".claude", "projects", "p", "session.jsonl");
    mkdirSync(join(dir, ".claude", "projects", "p"), { recursive: true });
    writeFileSync(jsonl, "{}\n", "utf8");
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "Stop",
        transcript_path: jsonl,
      }),
    );
    expect(hook?.transcriptPath).toBe(jsonl);
    expect(isClaudeCaptureHook(hook)).toBe(true);
    expect(isCodebuddyCaptureHook(hook)).toBe(false);
    expect(isCursorCaptureHook(hook)).toBe(false);
  });

  it("parses CodeBuddy transcript_path under .codebuddy", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-hook-"));
    const jsonl = join(dir, ".codebuddy", "projects", "p", "session.jsonl");
    mkdirSync(join(dir, ".codebuddy", "projects", "p"), { recursive: true });
    writeFileSync(jsonl, "{}\n", "utf8");
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "Stop",
        transcript_path: jsonl,
      }),
    );
    expect(isCodebuddyCaptureHook(hook)).toBe(true);
    expect(isClaudeCaptureHook(hook)).toBe(false);
  });

  it("parses Cursor stop payload", () => {
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "stop",
        session_id: "abc-123",
        workspace_roots: ["/Users/me/proj"],
        status: "completed",
      }),
    );
    expect(hook?.sessionId).toBe("abc-123");
    expect(isCursorCaptureHook(hook)).toBe(true);
    expect(isClaudeCaptureHook(hook)).toBe(false);
  });

  it("detects cursor sessionStart", () => {
    const hook = parseHookInputJson(
      JSON.stringify({ hook_event_name: "sessionStart" }),
    );
    expect(isCursorInjectHook(hook)).toBe(true);
  });
});
