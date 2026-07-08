import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  encodeClaudeProjectDir,
  resolveSessionJsonlPath,
} from "../src/capture/claude-code/resolveSession.js";

const tempDirs: string[] = [];
let prevClaudeConfigDir: string | undefined;
let prevHermesJsonl: string | undefined;
let prevSessionId: string | undefined;

beforeEach(() => {
  prevClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  prevHermesJsonl = process.env.HERMES_SESSION_JSONL;
  prevSessionId = process.env.CLAUDE_SESSION_ID;
  // Clear session ID to allow tests to find any jsonl file
  delete process.env.CLAUDE_SESSION_ID;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.SESSION_ID;
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (prevClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = prevClaudeConfigDir;
  }
  if (prevHermesJsonl === undefined) {
    delete process.env.HERMES_SESSION_JSONL;
  } else {
    process.env.HERMES_SESSION_JSONL = prevHermesJsonl;
  }
  if (prevSessionId === undefined) {
    delete process.env.CLAUDE_SESSION_ID;
  } else {
    process.env.CLAUDE_SESSION_ID = prevSessionId;
  }
});

function setupClaudeProjectsLayout(repoRoot: string): {
  claudeHome: string;
  jsonlPath: string;
} {
  const claudeHome = mkdtempSync(join(tmpdir(), "hermes-claude-home-"));
  tempDirs.push(claudeHome);
  process.env.CLAUDE_CONFIG_DIR = claudeHome;
  delete process.env.HERMES_SESSION_JSONL;

  const projectDirName = encodeClaudeProjectDir(repoRoot);
  const projectDir = join(claudeHome, "projects", projectDirName);
  mkdirSync(projectDir, { recursive: true });
  const jsonlPath = join(projectDir, "session-abc.jsonl");
  writeFileSync(jsonlPath, '{"type":"user","message":{"content":"约定"}}\n', "utf8");
  return { claudeHome, jsonlPath };
}

describe("resolveSessionJsonlPath", () => {
  it("encodeClaudeProjectDir matches Claude projects folder naming", () => {
    expect(encodeClaudeProjectDir("/Users/ricolee/Desktop/rico")).toBe(
      "-Users-ricolee-Desktop-rico",
    );
  });

  it("finds jsonl under projects/<encoded-cwd>/*.jsonl (official layout)", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "hermes-repo-"));
    tempDirs.push(repoRoot);
    const { jsonlPath } = setupClaudeProjectsLayout(repoRoot);

    const resolved = resolveSessionJsonlPath(repoRoot, { cwd: repoRoot });
    expect(resolved).toBe(resolve(jsonlPath));
  });

  it("prefers transcriptPath from hook input", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "hermes-repo-"));
    tempDirs.push(repoRoot);
    const hookJsonl = join(repoRoot, "hook-session.jsonl");
    writeFileSync(hookJsonl, '{"type":"user","message":{"content":"test"}}\n', "utf8");
    setupClaudeProjectsLayout(repoRoot);

    const resolved = resolveSessionJsonlPath(repoRoot, {
      cwd: repoRoot,
      transcriptPath: hookJsonl,
    });
    expect(resolved).toBe(resolve(hookJsonl));
  });

  it("falls back to legacy projects/<name>/sessions/*.jsonl", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "hermes-repo-"));
    tempDirs.push(repoRoot);
    const claudeHome = mkdtempSync(join(tmpdir(), "hermes-claude-home-"));
    tempDirs.push(claudeHome);
    process.env.CLAUDE_CONFIG_DIR = claudeHome;
    delete process.env.HERMES_SESSION_JSONL;

    const projectDirName = encodeClaudeProjectDir(repoRoot);
    const sessionsDir = join(claudeHome, "projects", projectDirName, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const jsonlPath = join(sessionsDir, "legacy.jsonl");
    writeFileSync(jsonlPath, '{"type":"user","message":{"content":"x"}}\n', "utf8");

    const resolved = resolveSessionJsonlPath(repoRoot, { cwd: repoRoot });
    expect(resolved).toBe(resolve(jsonlPath));
  });
});
