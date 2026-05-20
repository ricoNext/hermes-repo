import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureDebugLogging,
  DEBUG_LOG_FILE,
  debugLog,
} from "../src/config/debugLog.js";
import { memoryPath } from "../src/init/paths.js";

const tempDirs: string[] = [];

function makeRepo(debug: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-debug-log-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      version: 1,
      storage: { backend: "file" },
      assistants: ["claude-code"],
      debug,
    })}\n`,
    "utf8",
  );
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("debug log file", () => {
  it("appends to .memory/hermes-debug.log when debug enabled", () => {
    const repo = makeRepo(true);
    const logPath = memoryPath(repo, DEBUG_LOG_FILE);

    configureDebugLogging(repo, true);
    debugLog(true, "capture", "skip: no session jsonl found");

    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, "utf8");
    expect(content).toContain("hermes-repo [capture]");
    expect(content).toContain("skip: no session jsonl found");
  });

  it("does not create log file when debug disabled", () => {
    const repo = makeRepo(false);
    const logPath = memoryPath(repo, DEBUG_LOG_FILE);

    configureDebugLogging(repo, false);
    debugLog(false, "capture", "should not appear");

    expect(existsSync(logPath)).toBe(false);
  });
});
