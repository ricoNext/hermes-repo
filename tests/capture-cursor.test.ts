import {
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
import { runCapture } from "../src/capture/runCapture.js";
import { routeCapture } from "../src/capture/router.js";
import { loadRepoContext } from "../src/config/readConfig.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "tests", "fixtures");

const tempDirs: string[] = [];

function makeRepo(assistants: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-cursor-cap-"));
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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("capture cursor", () => {
  it("cursor-only uses HERMES_CURSOR_SESSION without Claude", async () => {
    const dir = makeRepo(["cursor"]);
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const prevCursor = process.env.HERMES_CURSOR_SESSION;
    const prevClaude = process.env.HERMES_SESSION_JSONL;
    const prevClaudeHome = process.env.CLAUDE_CONFIG_DIR;
    process.env.HERMES_CURSOR_SESSION = fixture;
    delete process.env.HERMES_SESSION_JSONL;
    process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), "empty-claude-"));
    tempDirs.push(process.env.CLAUDE_CONFIG_DIR);

    const result = await runCapture({ cwd: dir });

    if (prevCursor === undefined) {
      delete process.env.HERMES_CURSOR_SESSION;
    } else {
      process.env.HERMES_CURSOR_SESSION = prevCursor;
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

    expect(result.written).toBe(true);
    // v2: 不再维护 sessions/index.json（assistant 字段不可用）
    const rawDir = join(dir, ".memory", "captures", "raw");
    const mdFiles = require("node:fs").readdirSync(rawDir).filter((f: string) => f.endsWith(".md"));
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it("routes Claude hook stdin to claude branch when both assistants enabled", async () => {
    const dir = makeRepo(["claude-code", "cursor"]);
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const ctx = loadRepoContext(dir);
    expect(ctx).not.toBeNull();

    const result = await routeCapture(ctx!, {
      hookInput: { transcriptPath: fixture, hookEventName: "Stop" },
    });
    expect(result.written).toBe(true);
  });

  it("routes Cursor stop hook to cursor branch", async () => {
    const dir = makeRepo(["cursor"]);
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const ctx = loadRepoContext(dir);
    expect(ctx).not.toBeNull();

    const prev = process.env.HERMES_CURSOR_SESSION;
    process.env.HERMES_CURSOR_SESSION = fixture;

    const result = await routeCapture(ctx!, {
      hookInput: {
        hookEventName: "stop",
        sessionId: "sess-1",
        status: "completed",
      },
    });

    if (prev === undefined) {
      delete process.env.HERMES_CURSOR_SESSION;
    } else {
      process.env.HERMES_CURSOR_SESSION = prev;
    }

    expect(result.written).toBe(true);
  });

  it("cursor-only does not write when no session", async () => {
    const dir = makeRepo(["cursor"]);
    const prev = process.env.HERMES_CURSOR_SESSION;
    const prevHome = process.env.CURSOR_CONFIG_DIR;
    delete process.env.HERMES_CURSOR_SESSION;
    const empty = mkdtempSync(join(tmpdir(), "empty-cursor-"));
    tempDirs.push(empty);
    mkdirSync(join(empty, "projects"), { recursive: true });
    process.env.CURSOR_CONFIG_DIR = empty;

    const result = await runCapture({ cwd: dir });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/no cursor session/i);

    if (prev === undefined) {
      delete process.env.HERMES_CURSOR_SESSION;
    } else {
      process.env.HERMES_CURSOR_SESSION = prev;
    }
    if (prevHome === undefined) {
      delete process.env.CURSOR_CONFIG_DIR;
    } else {
      process.env.CURSOR_CONFIG_DIR = prevHome;
    }
  });
});
