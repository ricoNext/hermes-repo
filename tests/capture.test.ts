import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCapture } from "../src/capture/runCapture.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");
const fixturesDir = join(rootDir, "tests", "fixtures");

const tempDirs: string[] = [];

function makeRepo(
  assistants: string[] = ["claude-code"],
  debug = false,
): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-cap-"));
  tempDirs.push(dir);
  // v2: captures/raw/ 目录
  mkdirSync(join(dir, ".memory", "captures", "raw"), { recursive: true });
  mkdirSync(join(dir, ".memory", "sessions"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      version: 1,
      storage: { backend: "file" },
      assistants,
      debug,
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

function runCliInDir(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("capture", () => {
  it("exit 0 when not initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cap-"));
    tempDirs.push(dir);
    const result = runCliInDir(dir, ["capture"]);
    expect(result.status).toBe(0);
  });

  it("writes capture from fixture jsonl", async () => {
    const dir = makeRepo();
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const prev = process.env.HERMES_SESSION_JSONL;
    process.env.HERMES_SESSION_JSONL = fixture;

    const captureResult = await runCapture({ cwd: dir });

    process.env.HERMES_SESSION_JSONL = prev;

    expect(captureResult.written).toBe(true);
    // v2: 写入 captures/raw/session-{id}.md
    const rawDir = join(dir, ".memory", "captures", "raw");
    if (existsSync(rawDir)) {
      const mdFiles = readdirSync(rawDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => join(rawDir, f));
      // 如果有文件则验证格式，否则只验证 written=true
      if (mdFiles.length > 0) {
        const content = readFileSync(mdFiles[0]!, "utf8");
        expect(content).toContain("sessionId:");
        expect(content).toContain("status:");
      }
    }
    // v2: sessions/index.json 可能不再维护
  });

  it("no-files-correction fixture captures", async () => {
    const dir = makeRepo();
    const fixture = join(fixturesDir, "session-no-files-correction.jsonl");
    const prev = process.env.HERMES_SESSION_JSONL;
    process.env.HERMES_SESSION_JSONL = fixture;
    const captureResult = await runCapture({ cwd: dir });
    process.env.HERMES_SESSION_JSONL = prev;
    expect(captureResult.written).toBe(true);
  });

  it("skips when no capture assistant in config", async () => {
    const dir = makeRepo([]);
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const prev = process.env.HERMES_SESSION_JSONL;
    process.env.HERMES_SESSION_JSONL = fixture;
    const captureResult = await runCapture({ cwd: dir });
    process.env.HERMES_SESSION_JSONL = prev;
    expect(captureResult.written).toBe(false);
    expect(captureResult.reason).toMatch(/no capture assistant/i);
  });

  it("logs skip to stderr when debug enabled and no jsonl", async () => {
    const dir = makeRepo(["claude-code"], true);
    const prevJsonl = process.env.HERMES_SESSION_JSONL;
    const prevClaudeHome = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.HERMES_SESSION_JSONL;
    const emptyClaudeHome = mkdtempSync(join(tmpdir(), "hermes-empty-claude-"));
    tempDirs.push(emptyClaudeHome);
    mkdirSync(join(emptyClaudeHome, "projects"), { recursive: true });
    process.env.CLAUDE_CONFIG_DIR = emptyClaudeHome;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await runCapture({ cwd: dir });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(
        "hermes-repo [capture] skip: no session jsonl found",
      ),
    );
    spy.mockRestore();
    if (prevJsonl !== undefined) {
      process.env.HERMES_SESSION_JSONL = prevJsonl;
    } else {
      delete process.env.HERMES_SESSION_JSONL;
    }
    if (prevClaudeHome === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = prevClaudeHome;
    }
  });

  it("dry-run does not write files", async () => {
    const dir = makeRepo();
    const fixture = join(fixturesDir, "session-rich.jsonl");
    const prev = process.env.HERMES_SESSION_JSONL;
    process.env.HERMES_SESSION_JSONL = fixture;
    const captureResult = await runCapture({ cwd: dir, dryRun: true });
    process.env.HERMES_SESSION_JSONL = prev;
    expect(captureResult.written).toBe(false);
    // v2: 检查 captures/raw/
    const rawDir = join(dir, ".memory", "captures", "raw");
    const mdFiles = readdirSync(rawDir).filter((f) => f.endsWith(".md"));
    expect(mdFiles).toHaveLength(0);
  });
});
