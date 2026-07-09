import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureDebugLogging,
  DEBUG_LOG_DIR,
  DEBUG_LOG_FILES,
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
  it("appends capture logs to .memory/logs/capture.log when debug enabled", () => {
    const repo = makeRepo(true);
    const logPath = memoryPath(repo, DEBUG_LOG_DIR, DEBUG_LOG_FILES.capture);

    configureDebugLogging(repo, true);
    debugLog(true, "capture", "skip: no session jsonl found");

    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, "utf8");
    expect(content).toContain("hermes-repo [capture]");
    expect(content).toContain("skip: no session jsonl found");
  });

  it("does not create log file when debug disabled", () => {
    const repo = makeRepo(false);
    const logPath = memoryPath(repo, DEBUG_LOG_DIR, DEBUG_LOG_FILES.capture);

    configureDebugLogging(repo, false);
    debugLog(false, "capture", "should not appear");

    expect(existsSync(logPath)).toBe(false);
  });

  it("routes flush and consolidate logs to separate files", () => {
    const repo = makeRepo(true);
    const flushLogPath = memoryPath(repo, DEBUG_LOG_DIR, DEBUG_LOG_FILES.flush);
    const consolidateLogPath = memoryPath(repo, DEBUG_LOG_DIR, DEBUG_LOG_FILES.consolidate);

    configureDebugLogging(repo, true);
    debugLog(true, "flush", "start");
    debugLog(true, "consolidate", "lock acquired");
    debugLog(true, "llm", "request");

    const flushLog = readFileSync(flushLogPath, "utf8");
    const consolidateLog = readFileSync(consolidateLogPath, "utf8");
    expect(flushLog).toContain("hermes-repo [flush] start");
    expect(flushLog).not.toContain("lock acquired");
    expect(consolidateLog).toContain("hermes-repo [consolidate] lock acquired");
    expect(consolidateLog).toContain("hermes-repo [llm] request");
  });
});
