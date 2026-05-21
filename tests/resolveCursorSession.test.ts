import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeCursorProjectDir,
  resolveCursorSessionJsonl,
} from "../src/capture/cursor/resolveSession.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("encodeCursorProjectDir", () => {
  it("drops leading slash unlike Claude encoding", () => {
    expect(encodeCursorProjectDir("/Users/me/proj")).toBe("Users-me-proj");
  });
});

describe("resolveCursorSessionJsonl", () => {
  it("uses HERMES_CURSOR_SESSION override", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cursor-res-"));
    tempDirs.push(dir);
    const jsonl = join(dir, "sess.jsonl");
    writeFileSync(jsonl, '{"role":"user","message":{"content":[{"type":"text","text":"hi"}]}}\n', "utf8");

    const prev = process.env.HERMES_CURSOR_SESSION;
    process.env.HERMES_CURSOR_SESSION = jsonl;
    const resolved = resolveCursorSessionJsonl({ repoRoot: dir });
    if (prev === undefined) {
      delete process.env.HERMES_CURSOR_SESSION;
    } else {
      process.env.HERMES_CURSOR_SESSION = prev;
    }
    expect(resolved).toBe(jsonl);
  });

  it("resolves by session_id under CURSOR_CONFIG_DIR/projects", () => {
    const repo = mkdtempSync(join(tmpdir(), "hermes-cursor-repo-"));
    tempDirs.push(repo);
    const cursorHome = mkdtempSync(join(tmpdir(), "hermes-cursor-home-"));
    tempDirs.push(cursorHome);
    const sessionId = "test-session-uuid";
    const encoded = encodeCursorProjectDir(repo);
    const transcriptsDir = join(
      cursorHome,
      "projects",
      encoded,
      "agent-transcripts",
      sessionId,
    );
    mkdirSync(transcriptsDir, { recursive: true });
    const jsonl = join(transcriptsDir, `${sessionId}.jsonl`);
    writeFileSync(
      jsonl,
      '{"role":"user","message":{"content":[{"type":"text","text":"x"}]}}\n',
      "utf8",
    );

    const prevSession = process.env.HERMES_CURSOR_SESSION;
    const prevHome = process.env.CURSOR_CONFIG_DIR;
    delete process.env.HERMES_CURSOR_SESSION;
    process.env.CURSOR_CONFIG_DIR = cursorHome;

    const resolved = resolveCursorSessionJsonl({
      repoRoot: repo,
      hookInput: { sessionId, hookEventName: "stop" },
    });

    if (prevSession === undefined) {
      delete process.env.HERMES_CURSOR_SESSION;
    } else {
      process.env.HERMES_CURSOR_SESSION = prevSession;
    }
    if (prevHome === undefined) {
      delete process.env.CURSOR_CONFIG_DIR;
    } else {
      process.env.CURSOR_CONFIG_DIR = prevHome;
    }
    expect(resolved).toBe(jsonl);
  });
});
