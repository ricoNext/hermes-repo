import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RepoContext } from "./types.js";
import { memoryPath } from "../init/paths.js";

export const DEBUG_LOG_FILE = "hermes-debug.log";

let logFilePath: string | null = null;

export function configureDebugLogging(
  repoRoot: string | null,
  enabled: boolean,
): void {
  if (!enabled || !repoRoot) {
    logFilePath = null;
    return;
  }
  logFilePath = memoryPath(repoRoot, DEBUG_LOG_FILE);
}

function formatLine(phase: string, message: string): string {
  return `${new Date().toISOString()} hermes-repo [${phase}] ${message}`;
}

function writeToLogFile(line: string): void {
  if (!logFilePath) {
    return;
  }
  mkdirSync(dirname(logFilePath), { recursive: true });
  appendFileSync(logFilePath, `${line}\n`, "utf8");
}

export function debugLog(
  enabled: boolean,
  phase: string,
  message: string,
): void {
  if (!enabled) {
    return;
  }
  const line = formatLine(phase, message);
  console.error(line);
  writeToLogFile(line);
}

export function debugFromContext(
  ctx: RepoContext | null | undefined,
  phase: string,
  message: string,
): void {
  debugLog(ctx?.config.debug === true, phase, message);
}
