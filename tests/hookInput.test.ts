import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isClaudeCaptureHook,
  isCodexCaptureHook,
  isCodexInjectHook,
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
    expect(hook?.transcriptPathRaw).toBe(jsonl);
  });

  it("keeps transcriptPathRaw when file is missing", () => {
    const raw = "/tmp/.codebuddy/projects/test/session.jsonl";
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "Stop",
        transcript_path: raw,
      }),
    );
    expect(hook?.transcriptPath).toBeUndefined();
    expect(hook?.transcriptPathRaw).toBe(raw);
    expect(isCodebuddyCaptureHook(hook)).toBe(true);
  });

  it("parses Cursor stop payload", () => {
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "stop",
        session_id: "abc-123",
        conversation_id: "conv-456",
        workspace_roots: ["/Users/me/proj"],
        status: "completed",
      }),
    );
    expect(hook?.sessionId).toBe("abc-123");
    expect(hook?.conversationId).toBe("conv-456");
    expect(isCursorCaptureHook(hook)).toBe(true);
    expect(isClaudeCaptureHook(hook)).toBe(false);
    expect(isCodexCaptureHook(hook)).toBe(false);
  });

  it("detects cursor sessionStart", () => {
    const hook = parseHookInputJson(
      JSON.stringify({ hook_event_name: "sessionStart" }),
    );
    expect(isCursorInjectHook(hook)).toBe(true);
  });

  it("detects codex capture via transcript_path under .codex", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-hook-"));
    const jsonl = join(dir, ".codex", "sessions", "session.jsonl");
    mkdirSync(join(dir, ".codex", "sessions"), { recursive: true });
    writeFileSync(jsonl, "{}\n", "utf8");
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "Stop",
        transcript_path: jsonl,
      }),
    );
    expect(isCodexCaptureHook(hook)).toBe(true);
    expect(isClaudeCaptureHook(hook)).toBe(false);
    expect(isCursorCaptureHook(hook)).toBe(false);
    expect(isCodebuddyCaptureHook(hook)).toBe(false);
  });

  it("detects codex capture without transcript_path (session_id + Stop)", () => {
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "Stop",
        session_id: "codex-session-123",
      }),
    );
    expect(isCodexCaptureHook(hook)).toBe(true);
  });

  it("detects codex SessionStart inject hook", () => {
    const hook = parseHookInputJson(
      JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "codex-session-456",
      }),
    );
    expect(isCodexInjectHook(hook)).toBe(true);
    // Cursor inject should not match (no session_id or has conversationId)
    const cursorHook = parseHookInputJson(
      JSON.stringify({ hook_event_name: "sessionStart" }),
    );
    expect(isCodexInjectHook(cursorHook)).toBe(false);
  });
});
