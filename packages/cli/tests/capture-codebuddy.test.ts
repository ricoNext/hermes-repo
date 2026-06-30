import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  isClaudeCaptureHook,
  isCodebuddyCaptureHook,
} from "../src/capture/hookInput.js";
import { runCapture } from "../src/capture/runCapture.js";
import { routeCapture } from "../src/capture/router.js";
import { loadRepoContext } from "../src/config/readConfig.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "tests", "fixtures");

const tempDirs: string[] = [];

function makeRepo(assistants: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-cb-cap-"));
  tempDirs.push(dir);
  // v2: captures/raw/
  mkdirSync(join(dir, ".memory", "captures", "raw"), { recursive: true });
  mkdirSync(join(dir, ".memory", "sessions"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      version: 1,
      storage: { backend: "file" },
      assistants,
    })}\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, ".memory", "sessions", "index.json"),
    `${JSON.stringify({ version: 1, sessions: [] })}\n`,
    "utf8",
  );
  return dir;
}

function makeCodebuddyTranscriptCopy(): string {
  const base = mkdtempSync(join(tmpdir(), "hermes-cb-tx-"));
  tempDirs.push(base);
  const dir = join(base, ".codebuddy", "projects", "test-proj");
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, "session-rich.jsonl");
  copyFileSync(join(fixturesDir, "session-rich.jsonl"), dest);
  return dest;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("capture codebuddy", () => {
  it("codebuddy-only uses HERMES_CODEBUDDY_SESSION without Claude", async () => {
    const dir = makeRepo(["codebuddy"]);
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const prevCb = process.env.HERMES_CODEBUDDY_SESSION;
    const prevClaude = process.env.HERMES_SESSION_JSONL;
    const prevClaudeHome = process.env.CLAUDE_CONFIG_DIR;
    const prevCursorHome = process.env.CURSOR_CONFIG_DIR;
    process.env.HERMES_CODEBUDDY_SESSION = fixture;
    delete process.env.HERMES_SESSION_JSONL;
    const emptyClaude = mkdtempSync(join(tmpdir(), "empty-claude-"));
    tempDirs.push(emptyClaude);
    process.env.CLAUDE_CONFIG_DIR = emptyClaude;
    mkdirSync(join(emptyClaude, "projects"), { recursive: true });
    const emptyCursor = mkdtempSync(join(tmpdir(), "empty-cursor-"));
    tempDirs.push(emptyCursor);
    process.env.CURSOR_CONFIG_DIR = emptyCursor;
    mkdirSync(join(emptyCursor, "projects"), { recursive: true });

    const result = await runCapture({ cwd: dir });

    restoreEnv(prevCb, prevClaude, prevClaudeHome, prevCursorHome);

    expect(result.written).toBe(true);
    // v2: 不再维护 sessions/index.json（assistant 字段不可用）
    // 改为验证 raw/ 目录下有文件写入
    const rawDir = join(dir, ".memory", "captures", "raw");
    const mdFiles = require("node:fs").readdirSync(rawDir).filter((f: string) => f.endsWith(".md"));
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it("routes .codebuddy transcript_path to codebuddy branch", async () => {
    const dir = makeRepo(["claude-code", "codebuddy"]);
    const cbPath = makeCodebuddyTranscriptCopy();
    const hook = {
      transcriptPath: cbPath,
      hookEventName: "Stop",
    };
    expect(isCodebuddyCaptureHook(hook)).toBe(true);
    expect(isClaudeCaptureHook(hook)).toBe(false);

    const ctx = loadRepoContext(dir);
    expect(ctx).not.toBeNull();

    const prevCb = process.env.HERMES_CODEBUDDY_SESSION;
    delete process.env.HERMES_CODEBUDDY_SESSION;
    delete process.env.HERMES_SESSION_JSONL;

    const result = await routeCapture(ctx!, { hookInput: hook });

    if (prevCb === undefined) {
      delete process.env.HERMES_CODEBUDDY_SESSION;
    } else {
      process.env.HERMES_CODEBUDDY_SESSION = prevCb;
    }

    expect(result.written).toBe(true);
    expect(result.jsonlPath).toContain(".codebuddy");
  });

  it("routes generic transcript_path to claude when path has .claude", async () => {
    const dir = makeRepo(["claude-code", "codebuddy"]);
    const base = mkdtempSync(join(tmpdir(), "hermes-cl-tx-"));
    tempDirs.push(base);
    const clDir = join(base, ".claude", "projects", "test-proj");
    mkdirSync(clDir, { recursive: true });
    const clPath = join(clDir, "session-rich.jsonl");
    copyFileSync(join(fixturesDir, "session-rich.jsonl"), clPath);

    const hook = { transcriptPath: clPath, hookEventName: "Stop" };
    expect(isClaudeCaptureHook(hook)).toBe(true);
    expect(isCodebuddyCaptureHook(hook)).toBe(false);

    const ctx = loadRepoContext(dir);
    const prevClaude = process.env.HERMES_SESSION_JSONL;
    delete process.env.HERMES_SESSION_JSONL;
    delete process.env.HERMES_CODEBUDDY_SESSION;

    const result = await routeCapture(ctx!, { hookInput: hook });

    if (prevClaude === undefined) {
      delete process.env.HERMES_SESSION_JSONL;
    } else {
      process.env.HERMES_SESSION_JSONL = prevClaude;
    }

    expect(result.written).toBe(true);
  });

  it("codebuddy-only returns no session when paths empty", async () => {
    const dir = makeRepo(["codebuddy"]);
    const prevCb = process.env.HERMES_CODEBUDDY_SESSION;
    const prevHome = process.env.CODEBUDDY_CONFIG_DIR;
    delete process.env.HERMES_CODEBUDDY_SESSION;
    const empty = mkdtempSync(join(tmpdir(), "empty-cb-"));
    tempDirs.push(empty);
    mkdirSync(join(empty, "projects"), { recursive: true });
    process.env.CODEBUDDY_CONFIG_DIR = empty;

    const result = await runCapture({ cwd: dir });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/no codebuddy session/i);

    if (prevCb === undefined) {
      delete process.env.HERMES_CODEBUDDY_SESSION;
    } else {
      process.env.HERMES_CODEBUDDY_SESSION = prevCb;
    }
    if (prevHome === undefined) {
      delete process.env.CODEBUDDY_CONFIG_DIR;
    } else {
      process.env.CODEBUDDY_CONFIG_DIR = prevHome;
    }
  });
});

function restoreEnv(
  prevCb: string | undefined,
  prevClaude: string | undefined,
  prevClaudeHome: string | undefined,
  prevCursorHome: string | undefined,
): void {
  if (prevCb === undefined) {
    delete process.env.HERMES_CODEBUDDY_SESSION;
  } else {
    process.env.HERMES_CODEBUDDY_SESSION = prevCb;
  }
  if (prevClaude === undefined) {
    delete process.env.HERMES_SESSION_JSONL;
  } else {
    process.env.HERMES_SESSION_JSONL = prevClaude;
  }
  if (prevClaudeHome === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = prevClaudeHome;
  }
  if (prevCursorHome === undefined) {
    delete process.env.CURSOR_CONFIG_DIR;
  } else {
    process.env.CURSOR_CONFIG_DIR = prevCursorHome;
  }
}
